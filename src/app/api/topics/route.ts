import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/topics - Get topics with optional phase filter
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phaseId = searchParams.get('phaseId');
  const search = searchParams.get('search');

  const where: Record<string, unknown> = {};

  if (phaseId) where.phaseId = parseInt(phaseId);
  if (search) {
    where.topicText = { contains: search };
  }

  const topics = await prisma.topic.findMany({
    where,
    include: {
      phase: { select: { id: true, name: true, phaseNumber: true } },
    },
    orderBy: { weekNumber: 'asc' },
  });

  return NextResponse.json(topics);
}

// POST /api/topics - Create a new topic (admin only)
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { phaseId, weekNumber, topicText } = body;

  const topic = await prisma.topic.create({
    data: {
      phaseId,
      weekNumber,
      topicText,
    },
  });

  return NextResponse.json(topic, { status: 201 });
}

// PUT /api/topics - Update a topic (admin only)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;

  const topic = await prisma.topic.update({
    where: { id },
    data,
  });

  return NextResponse.json(topic);
}
