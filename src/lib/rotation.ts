import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { GRADE_ORDER, SESSION_DAYS, ROTATION_FIXED_UNTIL } from './constants';

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * 運営内棚卸し（振り返り）回などの特別セッションかどうか。
 * これらは通常の発話輪番ではないため、均等化の対象から除外する。
 */
function isReviewSession(adminNote: string | null): boolean {
  return !!adminNote && /棚卸し|振り返り/.test(adminNote);
}

export type SpeakerCount = {
  id: string;
  name: string;
  grade: string;
  total: number;
};

export type RebalanceResult = {
  changed: number;
  cutoff: string;
  counts: SpeakerCount[];
};

/**
 * 発話回数を均等化する再調整。
 *
 * - `cutoffStr`（既定 = ROTATION_FIXED_UNTIL）「まで」のセッションは確定済みとして
 *   発話者を一切変更しない（過去の輪番は固定）。
 * - 翌日以降の status='scheduled' のセッションについて、発話者を貪欲法で再割当する：
 *   各回で「これまでの発話回数が最も少ない」現役メンバーを選ぶ。
 *   回数が同点の場合は「直前の発話者」を避けることで連続登壇（集中）を防ぐ。
 * - 棚卸し回など特別セッション（adminNote に「棚卸し/振り返り」を含む）は対象外。
 *
 * 計画用の操作のため、個別の通知は発行しない（当日分の繰り上げは daily-finalize が担当）。
 */
export async function rebalanceFutureSpeakers(
  cutoffStr: string = ROTATION_FIXED_UNTIL,
  tx: TxClient = prisma
): Promise<RebalanceResult> {
  // セッション date は UTC 0:00 で保存。cutoff 当日いっぱい（その日まで）を固定とする。
  const cutoff = new Date(`${cutoffStr}T23:59:59.999Z`).getTime();

  const members = await tx.user.findMany({
    where: { choreiStatus: 'active', deletedAt: null },
  });
  const memberIds = new Set(members.map((m) => m.id));

  const sessions = await tx.session.findMany({
    where: { status: { not: 'cancelled' } },
    orderBy: { date: 'asc' },
  });

  // 現役メンバーの発話回数を 0 で初期化。
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.id, 0);

  // 固定セッション（cutoff まで）で基準回数を積み上げ、直前発話者を求める。
  let prevSpeaker: string | null = null;
  for (const s of sessions) {
    if (s.date.getTime() > cutoff) continue;
    if (isReviewSession(s.adminNote)) continue;
    if (s.speakerId && memberIds.has(s.speakerId)) {
      counts.set(s.speakerId, (counts.get(s.speakerId) ?? 0) + 1);
    }
    if (s.speakerId) prevSpeaker = s.speakerId;
  }

  // 同点時の並びを散らすためのランダムキー（メンバーごとに固定）。
  const rnd = new Map<string, number>();
  for (const m of members) rnd.set(m.id, Math.random());

  // 再調整対象：cutoff より後の予定セッション（棚卸し回は除く）。
  const future = sessions.filter(
    (s) =>
      s.date.getTime() > cutoff &&
      s.status === 'scheduled' &&
      !isReviewSession(s.adminNote)
  );

  let changed = 0;
  for (const s of future) {
    if (members.length === 0) break;

    // (発話回数 昇順, 直前発話者は後回し, ランダム) で最良の1名を選ぶ。
    let best: string | null = null;
    let bestKey: [number, number, number] | null = null;
    for (const m of members) {
      const key: [number, number, number] = [
        counts.get(m.id) ?? 0,
        m.id === prevSpeaker ? 1 : 0,
        rnd.get(m.id)!,
      ];
      if (
        bestKey === null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
        (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
      ) {
        best = m.id;
        bestKey = key;
      }
    }
    if (!best) break;

    counts.set(best, (counts.get(best) ?? 0) + 1);
    if (s.speakerId !== best) {
      await tx.session.update({ where: { id: s.id }, data: { speakerId: best } });
      changed++;
    }
    prevSpeaker = best;
  }

  const result: SpeakerCount[] = members
    .map((m) => ({
      id: m.id,
      name: m.name,
      grade: m.grade,
      total: counts.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { changed, cutoff: cutoffStr, counts: result };
}

/**
 * Generate rotation schedule for Phase 1
 */
export async function generateRotation(
  phaseId: number,
  roundNumber: number,
  startDate: Date
) {
  // Get all members who are active for morning assembly
  const users = await prisma.user.findMany({
    where: { choreiStatus: 'active', deletedAt: null }
  });

  // Get holidays
  const holidays = await prisma.holiday.findMany({
    where: { isActive: true },
  });
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split('T')[0])
  );

  // Sort users based on round
  let sortedUsers;
  if (roundNumber === 1) {
    // Round 1: Lower grade first (E2a → E5)
    sortedUsers = [...users].sort(
      (a, b) =>
        GRADE_ORDER.indexOf(a.grade as (typeof GRADE_ORDER)[number]) -
        GRADE_ORDER.indexOf(b.grade as (typeof GRADE_ORDER)[number])
    );
  } else {
    // Round 2, 3: Random order (Fisher-Yates)
    sortedUsers = [...users];
    for (let i = sortedUsers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sortedUsers[i], sortedUsers[j]] = [sortedUsers[j], sortedUsers[i]];
    }
  }

  // Get topics for the phase
  const topics = await prisma.topic.findMany({
    where: { phaseId },
    orderBy: { weekNumber: 'asc' },
  });

  // Generate session dates (Tue, Thu, Fri, skip holidays)
  const sessionDates = getSessionDates(
    startDate,
    sortedUsers.length + 1, // +1 for review session
    holidayDates
  );

  const sessions = [];

  for (let i = 0; i < sessionDates.length; i++) {
    const date = sessionDates[i];
    const weekNum = getWeekNumber(date, startDate);
    const topicIndex = Math.min(weekNum - 1, topics.length - 1);

    if (i < sortedUsers.length) {
      sessions.push({
        date,
        phaseId,
        weekNumber: weekNum,
        topicId: topics[topicIndex >= 0 ? topicIndex : 0].id,
        speakerId: sortedUsers[i].id,
        startTime: '09:00',
        endTime: '09:10',
        status: 'scheduled',
        roundNumber,
      });
    } else {
      // Review session
      sessions.push({
        date,
        phaseId,
        weekNumber: weekNum,
        topicId: topics[0].id,
        speakerId: users.find((u) => u.role === 'admin')?.id || users[0].id,
        startTime: '09:00',
        endTime: '09:10',
        status: 'scheduled',
        roundNumber,
        adminNote: `運営内棚卸し（${roundNumber}巡目終了後の振り返り）`,
      });
    }
  }

  return sessions;
}


export function getSessionDates(
  startDate: Date,
  count: number,
  holidaySet: Set<string>
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  // UTC-based throughout so results are identical on Vercel (UTC) and locally (JST).
  // (Previously mixed local getDay() with UTC toISOString(), which could shift days.)
  while (dates.length < count) {
    const dayOfWeek = current.getUTCDay();
    const dateStr = current.toISOString().split('T')[0];

    if (
      SESSION_DAYS.includes(dayOfWeek as (typeof SESSION_DAYS)[number]) &&
      !holidaySet.has(dateStr)
    ) {
      dates.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function getWeekNumber(date: Date, startDate: Date): number {
  const msPerDay = 86400000;
  const daysDiff = Math.floor(
    (date.getTime() - startDate.getTime()) / msPerDay
  );
  return Math.floor(daysDiff / 7) + 1;
}
