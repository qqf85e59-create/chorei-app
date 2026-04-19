import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST /api/absence - Create an absence request
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, type, note } = body;

  // Verify the session exists
  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!targetSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Create absence request
  const absenceRequest = await prisma.absenceRequest.create({
    data: {
      userId: session.user.id,
      sessionId,
      type,
      note: note || null,
    },
  });

  // Update attendance record
  await prisma.attendance.upsert({
    where: {
      sessionId_userId: {
        sessionId,
        userId: session.user.id,
      },
    },
    update: {
      status: type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early',
      reportedAt: new Date(),
    },
    create: {
      sessionId,
      userId: session.user.id,
      status: type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early',
      reportedAt: new Date(),
    },
  });

  return NextResponse.json(absenceRequest, { status: 201 });
}

// GET /api/absence - Get absence requests
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

  // Members can only see their own requests
  if (userRole !== 'admin') {
    where.userId = session.user.id;
  }

  const requests = await prisma.absenceRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, grade: true } },
      session: {
        select: {
          date: true,
          topic: { select: { topicText: true } },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  return NextResponse.json(requests);
}
