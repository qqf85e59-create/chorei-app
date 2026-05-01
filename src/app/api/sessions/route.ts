import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/sessions - Get sessions with optional filters
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date      = searchParams.get('date');
    const phaseId   = searchParams.get('phaseId');
    const speakerId = searchParams.get('speakerId');
    const status    = searchParams.get('status');
    const after     = searchParams.get('after');   // YYYY-MM-DD: 指定日より後のみ
    const limitStr  = searchParams.get('limit');
    const take      = limitStr ? parseInt(limitStr) : undefined;

    const where: Record<string, unknown> = {};

    if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      where.date = { gte: targetDate, lt: nextDate };
    }

    if (after) {
      const afterDate = new Date(`${after}T00:00:00.000Z`);
      afterDate.setUTCDate(afterDate.getUTCDate() + 1); // strict >
      where.date = { ...(where.date as object ?? {}), gte: afterDate };
    }

    if (phaseId)   where.phaseId   = parseInt(phaseId);
    if (speakerId) where.speakerId = speakerId;
    if (status)    where.status    = status;

    const sessions = await prisma.session.findMany({
      where,
      take,
      include: {
        speaker:      { select: { id: true, name: true, grade: true } },
        commentators: { select: { id: true, name: true, grade: true } },
        topic:        { select: { id: true, topicText: true, weekNumber: true } },
        phase:        { select: { id: true, name: true, phaseNumber: true } },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(sessions);
  } catch (err) {
    console.error('[GET /api/sessions]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/sessions - Update a session
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, speakerId, topicId, status, adminNote } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ error: 'id (number) is required' }, { status: 400 });
    }

    // Build update object with only whitelisted fields
    const data: Record<string, unknown> = {};
    if (speakerId !== undefined) data.speakerId = speakerId;
    if (topicId !== undefined) data.topicId = topicId;
    if (status !== undefined) data.status = status;
    if (adminNote !== undefined) data.adminNote = adminNote;

    const updated = await prisma.session.update({
      where: { id },
      data,
      include: {
        speaker: { select: { id: true, name: true, grade: true } },
        topic: { select: { id: true, topicText: true, weekNumber: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PUT /api/sessions]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
