import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { adjustForAbsence, canSelfCancel } from '@/lib/absence-logic';

// POST /api/absence - Create an absence request (+ auto-adjust schedule)
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, type, note } = body;

  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!targetSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Disallow duplicate absence request for same user/session
  const existing = await prisma.absenceRequest.findFirst({
    where: { sessionId, userId: session.user.id },
  });

  let absenceRequest;
  if (existing) {
    absenceRequest = await prisma.absenceRequest.update({
      where: { id: existing.id },
      data: { type, note: note || null, requestedAt: new Date() },
    });
  } else {
    absenceRequest = await prisma.absenceRequest.create({
      data: {
        userId: session.user.id,
        sessionId,
        type,
        note: note || null,
      },
    });
  }

  // Attendance mirror
  const attStatus =
    type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early';
  await prisma.attendance.upsert({
    where: { sessionId_userId: { sessionId, userId: session.user.id } },
    update: { status: attStatus, reportedAt: new Date() },
    create: { sessionId, userId: session.user.id, status: attStatus, reportedAt: new Date() },
  });

  // Auto-adjustment (full phase, both speaker/commentator, minimum attendance enforcement)
  const report = await adjustForAbsence(sessionId, session.user.id);

  return NextResponse.json(
    { request: absenceRequest, adjustment: report },
    { status: 201 }
  );
}

// GET /api/absence - List absence requests
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userRole = (session.user as { role: string }).role;

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
}

// DELETE /api/absence?id=xxx - Self-cancel absence declaration before previous day 23:59
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');
  if (!idParam) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  const id = parseInt(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const req = await prisma.absenceRequest.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!req) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const userRole = (session.user as { role: string }).role;
  if (req.userId !== session.user.id && userRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cutoff: previous day 23:59 of session date (admins can override)
  if (userRole !== 'admin' && !canSelfCancel(req.session.date)) {
    return NextResponse.json(
      { error: '取消し可能期限（前日23:59）を過ぎています。運営にご連絡ください。' },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.absenceRequest.delete({ where: { id } }),
    prisma.attendance.updateMany({
      where: { sessionId: req.sessionId, userId: req.userId },
      data: { status: 'present', reportedAt: new Date() },
    }),
  ]);

  // NOTE: cascade-shift reversal is intentionally not automated.
  // If the caller was a speaker whose session was already cascade-shifted,
  // the schedule change remains and requires admin adjustment via /rotation.
  return NextResponse.json({
    ok: true,
    note:
      '欠席申請を取消ししました。スケジュールが自動順送りされていた場合、元に戻すには運営による調整が必要です。',
  });
}
