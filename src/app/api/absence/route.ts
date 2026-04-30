import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { adjustForAbsence, canSelfCancel, reverseCascadeSpeakerShift } from '@/lib/absence-logic';

// POST /api/absence - Create an absence request (+ auto-adjust schedule)
// [3] Wrapped in prisma.$transaction for atomicity
// [5/6] Stores originalSpeaker and previousAttendanceStatus snapshots
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, type, note } = body;

    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!targetSession) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    // [3] All operations in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // [5] Snapshot: was this user the speaker?
      const isSpeaker = targetSession.speakerId === session.user.id;

      // [6] Snapshot: current attendance status (if exists)
      const existingAttendance = await tx.attendance.findUnique({
        where: { sessionId_userId: { sessionId, userId: session.user.id } },
      });
      const prevStatus = existingAttendance?.status ?? null;

      // Disallow duplicate absence request for same user/session
      const existing = await tx.absenceRequest.findFirst({
        where: { sessionId, userId: session.user.id },
      });

      let absenceRequest;
      if (existing) {
        absenceRequest = await tx.absenceRequest.update({
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
        absenceRequest = await tx.absenceRequest.create({
          data: {
            userId: session.user.id,
            sessionId,
            type,
            note: note || null,
            originalSpeaker: isSpeaker,
            previousAttendanceStatus: prevStatus,
          },
        });
      }

      // Attendance mirror
      const attStatus =
        type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early';
      await tx.attendance.upsert({
        where: { sessionId_userId: { sessionId, userId: session.user.id } },
        update: { status: attStatus, reportedAt: new Date() },
        create: { sessionId, userId: session.user.id, status: attStatus, reportedAt: new Date() },
      });

      // Auto-adjustment (full phase, both speaker/commentator, minimum attendance enforcement)
      const report = await adjustForAbsence(sessionId, session.user.id, tx);

      return { absenceRequest, report };
    });

    return NextResponse.json(
      { request: result.absenceRequest, adjustment: result.report },
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
// [5] Reverse cascade shift if original speaker
// [6] Restore previous attendance status
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

    // Cutoff: previous day 23:59:59 JST of session date (admins can override)
    if (userRole !== 'admin' && !canSelfCancel(req.session.date)) {
      return NextResponse.json(
        { error: '取消し可能期限（前日23:59）を過ぎています。運営にご連絡ください。' },
        { status: 400 }
      );
    }

    let cascadeReversed = false;

    await prisma.$transaction(async (tx) => {
      // [5] Reverse cascade shift if user was the original speaker
      if (req.originalSpeaker) {
        await reverseCascadeSpeakerShift(req.sessionId, req.userId, tx);
        cascadeReversed = true;
      }

      // Delete the absence request
      await tx.absenceRequest.delete({ where: { id } });

      // [6] Restore attendance status from snapshot
      const restoreStatus = req.previousAttendanceStatus || 'present';
      await tx.attendance.updateMany({
        where: { sessionId: req.sessionId, userId: req.userId },
        data: { status: restoreStatus, reportedAt: new Date() },
      });
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
