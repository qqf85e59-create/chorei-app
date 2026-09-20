import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';

/** 45日以上あいたところで区切り、実際に開催している期間を返す。 */
function toPeriods(dates: Date[]): { start: string; end: string }[] {
  if (dates.length === 0) return [];
  const GAP_MS = 45 * 86400000;
  const periods: { start: string; end: string }[] = [];
  let start = dates[0];
  let prev = dates[0];
  for (const d of dates.slice(1)) {
    if (d.getTime() - prev.getTime() > GAP_MS) {
      periods.push({ start: start.toISOString(), end: prev.toISOString() });
      start = d;
    }
    prev = d;
  }
  periods.push({ start: start.toISOString(), end: prev.toISOString() });
  return periods;
}

// GET /api/phases - Get all phases
export async function GET() {
  await requireUser();

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

  // 第1フェーズのように中断をはさんで再開したフェーズがあるため、
  // 表示用の期間は「実際に回がある日」から組み立てる（開始〜終了日だけだと
  // 他フェーズの期間と重なって見えてしまう）。
  const sessions = await prisma.session.findMany({
    where: { status: { not: 'cancelled' } },
    select: { phaseId: true, date: true },
    orderBy: { date: 'asc' },
  });
  const byPhase = new Map<number, Date[]>();
  for (const s of sessions) {
    const arr = byPhase.get(s.phaseId) ?? [];
    arr.push(s.date);
    byPhase.set(s.phaseId, arr);
  }

  return NextResponse.json(
    phases.map((p) => ({ ...p, periods: toPeriods(byPhase.get(p.id) ?? []) }))
  );
}

// PUT /api/phases - Update a phase (admin only)
export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => null);
    const { id, ...data } = body ?? {};
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
    }

    const phase = await prisma.phase.update({
      where: { id },
      data,
    });

    return NextResponse.json(phase);
  } catch (e) {
    return handleApiError(e);
  }
}
