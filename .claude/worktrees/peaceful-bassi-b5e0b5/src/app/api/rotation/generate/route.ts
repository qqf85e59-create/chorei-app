import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateRotation } from '@/lib/rotation';
import { prisma } from '@/lib/prisma';

// POST /api/rotation/generate - Generate rotation schedule
export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { phaseId, roundNumber, startDate } = body;

  try {
    const sessions = await generateRotation(
      phaseId,
      roundNumber,
      new Date(startDate)
    );

    // Create sessions in database
    const created = [];
    for (const sessionData of sessions) {
      const newSession = await prisma.session.create({
        data: sessionData,
        include: {
          speaker: { select: { id: true, name: true, grade: true } },
          topic: { select: { id: true, topicText: true, weekNumber: true } },
        },
      });
      created.push(newSession);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Rotation generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate rotation' },
      { status: 500 }
    );
  }
}
