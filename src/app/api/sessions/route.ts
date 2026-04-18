import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/sessions - Get sessions with optional filters
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const phaseId = searchParams.get('phaseId');
  const speakerId = searchParams.get('speakerId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};

  if (date) {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    where.date = {
      gte: targetDate,
      lt: nextDate,
    };
  }

  if (phaseId) where.phaseId = parseInt(phaseId);
  if (speakerId) where.speakerId = speakerId;
  if (status) where.status = status;

  const sessions = await prisma.session.findMany({
    where,
    include: {
      speaker: { select: { id: true, name: true, grade: true } },
      responder: { select: { id: true, name: true, grade: true } },
      topic: { select: { id: true, topicText: true, weekNumber: true } },
      phase: { select: { id: true, name: true, phaseNumber: true } },
    },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json(sessions);
}

// PUT /api/sessions - Update a session
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;

  const updated = await prisma.session.update({
    where: { id },
    data,
    include: {
      speaker: { select: { id: true, name: true, grade: true } },
      topic: { select: { id: true, topicText: true, weekNumber: true } },
    },
  });

  return NextResponse.json(updated);
}
