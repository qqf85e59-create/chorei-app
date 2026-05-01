import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { adjustForAbsence, canSelfCancel, reverseCascadeSpeakerShift } from '@/lib/absence-logic';

// POST /api/absence - Create an absence request (+ auto-adjust schedule)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

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

    // Auto-adjustment (cascade shift, re-select commentators, minimum attendance check)
    // Errors here are logged but do not block the response — the absence itself is already saved.
    let report;
    try {
      report = await adjustForAbsence(sessionId, userId);
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
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

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
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

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

    let cascadeReversed = false;

    // Reverse cascade shift if user was the original speaker
    if (req.originalSpeaker) {
      await reverseCascadeSpeakerShift(req.sessionId, req.userId);
      cascadeReversed = true;
    }

    // Delete the absence request
    await prisma.absenceRequest.delete({ where: { id } });

    // Restore attendance status from snapshot
    const restoreStatus = req.previousAttendanceStatus || 'present';
    await prisma.attendance.updateMany({
      where: { sessionId: req.sessionId, userId: req.userId },
      data: { status: restoreStatus, reportedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      cascadeReversed,
      note: cascadeReversed
        ? '欠席申請を取消し、スケジュールを元に戻しました。'
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
