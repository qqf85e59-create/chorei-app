import { NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/api-auth';
import { healFutureSpeakers, listSessionDates, getWeekNumber } from '@/lib/rotation';
import { prisma } from '@/lib/prisma';
import { ensureHolidaysForRange } from '@/lib/holidays';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rotation/generate  { until: 'YYYY-MM-DD' }
 *
 * 朝礼の予定を `until` まで延長する（admin のみ）。
 *   - 既存の最終回の翌日から `until` までの開催日（火・金／祝日・お盆・年末年始を除く）に
 *     セッションを作る。主題は持たせない（テーマは廃止）。
 *   - 発話者は空欄で作り、最後に healFutureSpeakers() が回数の均等と
 *     「なか4回」を満たすように埋める。
 *   - 出席レコード（全員present）も作る。
 *
 * 既に予定がある日は作らないので、同じ範囲で2回実行しても増えない。
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => null);
    const until = typeof body?.until === 'string' ? body.until.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return NextResponse.json(
        { error: '終了日（until: YYYY-MM-DD）が必要です' },
        { status: 400 }
      );
    }
    const untilDate = new Date(`${until}T00:00:00.000Z`);
    if (Number.isNaN(untilDate.getTime())) {
      return NextResponse.json({ error: '終了日の形式が不正です' }, { status: 400 });
    }

    const last = await prisma.session.findFirst({
      orderBy: { date: 'desc' },
      include: { phase: { select: { id: true, startDate: true } } },
    });
    if (!last) {
      return NextResponse.json({ error: '基準となる既存の回がありません' }, { status: 400 });
    }
    if (untilDate <= last.date) {
      return NextResponse.json(
        { error: `現在の最終回（${last.date.toISOString().slice(0, 10)}）より後の日付を指定してください` },
        { status: 400 }
      );
    }
    // 作りすぎ防止（誤入力で数千件作らないためのガード）。
    const maxUntil = new Date(last.date);
    maxUntil.setUTCFullYear(maxUntil.getUTCFullYear() + 2);
    if (untilDate > maxUntil) {
      return NextResponse.json(
        { error: '最終回から2年より先は一度に作成できません' },
        { status: 400 }
      );
    }

    // 作る範囲の祝日・お盆・年末年始を先に登録しておく（未登録だと祝日に予定が入る）。
    const ensured = await ensureHolidaysForRange(new Date(last.date), untilDate);

    const holidays = await prisma.holiday.findMany({
      where: { isActive: true },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    const from = new Date(last.date);
    from.setUTCDate(from.getUTCDate() + 1);
    const dates = listSessionDates(from, untilDate, holidaySet);

    const members = await prisma.user.count({ where: { choreiStatus: 'active', deletedAt: null } });
    const users = await prisma.user.findMany({
      where: { choreiStatus: 'active', deletedAt: null },
      select: { id: true },
    });

    const created: number[] = [];
    for (let k = 0; k < dates.length; k++) {
      const date = dates[k];
      const exists = await prisma.session.findFirst({
        where: { date: { gte: date, lt: new Date(date.getTime() + 86400000) } },
        select: { id: true },
      });
      if (exists) continue;

      const s = await prisma.session.create({
        data: {
          date,
          phaseId: last.phaseId,
          weekNumber: getWeekNumber(date, last.phase.startDate),
          topicId: null,
          speakerId: null, // heal が均等に埋める
          startTime: last.startTime,
          endTime: last.endTime,
          status: 'scheduled',
          roundNumber: last.roundNumber + Math.floor(k / Math.max(1, members)) + 1,
        },
      });
      await prisma.attendance.createMany({
        data: users.map((u) => ({ sessionId: s.id, userId: u.id, status: 'present' as const })),
        skipDuplicates: true,
      });
      created.push(s.id);
    }

    const heal = await healFutureSpeakers();

    return NextResponse.json(
      {
        created: created.length,
        from: dates[0]?.toISOString().slice(0, 10) ?? null,
        to: dates[dates.length - 1]?.toISOString().slice(0, 10) ?? null,
        holidaysAdded: ensured,
        heal,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
