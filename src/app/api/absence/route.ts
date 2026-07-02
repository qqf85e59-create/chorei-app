import { NextResponse } from 'next/server';
import { AttendanceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { adjustForAbsence, canSelfCancel, reflowSpeakers } from '@/lib/absence-logic';

// POST /api/absence - Create an absence request (+ auto-adjust schedule)
export async function POST(request: Request) {
  try {
    const session = await requireUser();

    const body = await request.json();
    const { sessionId, type, note } = body;

    if (!sessionId || !type) {
      return NextResponse.json({ error: 'sessionId と type は必須です' }, { status: 400 });
    }

    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!targetSession) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    const userId = session.user.id;
    const isSpeaker = targetSession.speakerId === userId;

    // Snapshot: current attendance status before this request
    const existingAttendance = await prisma.attendance.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    const prevStatus = existingAttendance?.status ?? null;

    // Create or update absence request (idempotent: update if already exists)
    const existing = await prisma.absenceRequest.findFirst({
      where: { sessionId, userId },
    });

    let absenceRequest;
    if (existing) {
      absenceRequest = await prisma.absenceRequest.update({
        where: { id: existing.id },
        data: {
          type,
          note: note || null,
          requestedAt: new Date(),
          originalSpeaker: isSpeaker,
          previousAttendanceStatus: prevStatus,
        },
      });
    } else {
      absenceRequest = await prisma.absenceRequest.create({
        data: {
          userId,
          sessionId,
          type,
          note: note || null,
          originalSpeaker: isSpeaker,
          previousAttendanceStatus: prevStatus,
        },
      });
    }

    // Mirror to Attendance table
    const attStatus =
      type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early';
    await prisma.attendance.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: { status: attStatus, reportedAt: new Date() },
      create: { sessionId, userId, status: attStatus, reportedAt: new Date() },
    });

    // Auto-adjustment (speaker reflow, re-select commentators, minimum attendance check).
    // Neon serverless on Vercel はインタラクティブtrxを安定維持できず500になるため、
    // $transaction(async tx) を使わず prisma で逐次実行する（cron / DELETE と同様）。
    // 以前は $transaction でラップしており、欠席申請時に応答者の再抽選が必ず失敗していた。
    // Errors here are logged but do not block the response — the absence itself is already saved.
    let report;
    try {
      report = await adjustForAbsence(sessionId, userId, prisma);
    } catch (adjustErr) {
      console.error('[POST /api/absence] adjustForAbsence error:', adjustErr);
      report = {
        speakerCascaded: false,
        commentatorReassigned: false,
        sessionCancelled: false,
        reasons: [],
      };
    }

    return NextResponse.json(
      { request: absenceRequest, adjustment: report },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/absence]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/absence - List absence requests
export async function GET(request: Request) {
  try {
    const session = await requireUser();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userRole = session.user.role;

    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = parseInt(sessionId);
    if (userRole !== 'admin') where.userId = session.user.id;

    const requests = await prisma.absenceRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, grade: true } },
        session: {
          select: {
            id: true,
            date: true,
            topic: { select: { topicText: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return NextResponse.json(requests);
  } catch (err) {
    console.error('[GET /api/absence]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/absence?id=xxx - Self-cancel absence declaration before previous day 23:59 JST
export async function DELETE(request: Request) {
  try {
    const session = await requireUser();

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam) {
      return NextResponse.json({ error: 'IDが指定されていません' }, { status: 400 });
    }
    const id = parseInt(idParam);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const req = await prisma.absenceRequest.findUnique({
      where: { id },
      include: { session: true },
    });
    if (!req) {
      return NextResponse.json({ error: '申告が見つかりません' }, { status: 404 });
    }

    const userRole = session.user.role;
    if (req.userId !== session.user.id && userRole !== 'admin') {
      return NextResponse.json({ error: 'この操作は許可されていません' }, { status: 403 });
    }

    if (userRole !== 'admin' && !canSelfCancel(req.session.date)) {
      return NextResponse.json(
        { error: '取消し可能期限（前日23:59）を過ぎています。運営にご連絡ください。' },
        { status: 400 }
      );
    }

    // previousAttendanceStatus は String? のまま保持しているため enum 型へ寄せる
    const restoreStatus = (req.previousAttendanceStatus || 'present') as AttendanceStatus;
    let cascadeReversed = false;

    // Neon serverless 互換: インタラクティブtrxを避け逐次実行する。
    // remove the absence, restore attendance, then reflow speakers so the now-available
    // user flows back into the rotation (反映の取消し).
    await prisma.absenceRequest.delete({ where: { id } });
    await prisma.attendance.updateMany({
      where: { sessionId: req.sessionId, userId: req.userId },
      data: { status: restoreStatus, reportedAt: new Date() },
    });
    // Reflow only matters when the cancelled absence affected the speaker rotation.
    if (req.originalSpeaker) {
      await reflowSpeakers(req.session.phaseId, req.session.date, prisma);
      cascadeReversed = true;
    }

    return NextResponse.json({
      ok: true,
      cascadeReversed,
      note: cascadeReversed
        ? '欠席申請を取消し、発話スケジュールを再調整しました。'
        : '欠席申請を取消ししました。',
    });
  } catch (err) {
    console.error('[DELETE /api/absence]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
