import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { generateRotation } from '@/lib/rotation';
import { prisma } from '@/lib/prisma';

// POST /api/rotation/generate - Generate rotation schedule
export async function POST(request: Request) {
  try {
    await requireAdmin();

    // 引数が無いまま呼ばれると以前は 500 になっていたため、明示的に 400 で返す。
    const body = await request.json().catch(() => null);
    const phaseId = Number(body?.phaseId);
    const roundNumber = Number(body?.roundNumber);
    const startDate = body?.startDate;
    if (!Number.isInteger(phaseId) || !Number.isInteger(roundNumber) || !startDate) {
      return NextResponse.json(
        { error: 'phaseId / roundNumber / startDate が必要です' },
        { status: 400 }
      );
    }

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
    return handleApiError(error);
  }
}
