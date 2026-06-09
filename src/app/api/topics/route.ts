import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';

// GET /api/topics - Get topics with optional phase filter
export async function GET(request: Request) {
  try {
    await requireUser();

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
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/topics - Create a new topic (admin only)
export async function POST(request: Request) {
  try {
    await requireAdmin();

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
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/topics - Update a topic (admin only)
export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { id, ...data } = body;

    const topic = await prisma.topic.update({
      where: { id },
      data,
    });

    return NextResponse.json(topic);
  } catch (error) {
    return handleApiError(error);
  }
}
