import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/phases - Get all phases
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const phases = await prisma.phase.findMany({
    include: {
      topics: {
        orderBy: { weekNumber: 'asc' },
      },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
    orderBy: { phaseNumber: 'asc' },
  });

  return NextResponse.json(phases);
}

// PUT /api/phases - Update a phase (admin only)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;

  const phase = await prisma.phase.update({
    where: { id },
    data,
  });

  return NextResponse.json(phase);
}
