import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import {
  GRADE_ORDER,
  SESSION_DAYS,
  ROTATION_FIXED_UNTIL,
  ROTATION_NO_REPEAT_WINDOW,
} from './constants';

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
 *   直近 (ROTATION_NO_REPEAT_WINDOW - 1) 回に登壇した人を除外したうえで、
 *   「これまでの発話回数が最も少ない」現役メンバーを選ぶ（同点はランダム）。
 *   これにより連続する ROTATION_NO_REPEAT_WINDOW 回に同一発話者が出ない。
 *   （候補が枯渇する小規模時のみ、除外を緩めて回数最少を優先する。）
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

  // クールダウン窓：直近 (window - 1) スロット分の発話者（nullスロットも1枠として保持）。
  const cooldown = Math.max(0, ROTATION_NO_REPEAT_WINDOW - 1);
  const recent: (string | null)[] = [];
  const pushRecent = (id: string | null) => {
    recent.push(id);
    while (recent.length > cooldown) recent.shift();
  };

  // 固定セッション（cutoff まで）で基準回数を積み上げ、直近発話者の窓を作る。
  for (const s of sessions) {
    if (s.date.getTime() > cutoff) continue;
    if (isReviewSession(s.adminNote)) continue;
    if (s.speakerId && memberIds.has(s.speakerId)) {
      counts.set(s.speakerId, (counts.get(s.speakerId) ?? 0) + 1);
    }
    pushRecent(s.speakerId ?? null);
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

    // 直近 (window - 1) 回の発話者は除外。除外で候補が無くなる小規模時のみ全員から選ぶ。
    const blocked = new Set(recent.filter((id): id is string => id !== null));
    const pool = members.filter((m) => !blocked.has(m.id));
    const candidates = pool.length > 0 ? pool : members;

    // (発話回数 昇順, ランダム) で最少回数の1名を選ぶ。
    let best: string | null = null;
    let bestKey: [number, number] | null = null;
    for (const m of candidates) {
      const key: [number, number] = [counts.get(m.id) ?? 0, rnd.get(m.id)!];
      if (
        bestKey === null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && key[1] < bestKey[1])
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
    pushRecent(best);
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

export type HealResult = { filled: number; reassigned: number };

/**
 * 未来の発話輪番を自動で整える（補充＋なか4回違反の修復）。
 *
 * cutoff「まで」の固定セッション・中止・棚卸し回は一切変更しない。
 * cutoff より後の予定セッションについて、各回を date 順に見ていき：
 *   - 発話者が「現役メンバー」かつ「直近 (ROTATION_NO_REPEAT_WINDOW - 1) 回に
 *     登壇していない」かつ「その回に欠席でない」＝正しい割当なら尊重する（変更しない）。
 *   - 発話者が null（未定）／非現役／直近窓と被る（なか4回違反）／その回に欠席なら、
 *     直近窓の登壇者と当日欠席者を除外したうえで発話回数が最少の現役メンバーへ割当直す。
 *
 * これにより「未定が残らない」「連続する ROTATION_NO_REPEAT_WINDOW 回に同一発話者が
 * 出ない」「欠席者を発話者にしない」を保証する。正しい割当は触らないため冪等で、
 * 毎朝Cron／ページ表示時に呼んでも余計なバタつきが起きない。
 * （登壇可能者が皆無の回のみ未定のまま残す＝最低人数割れで自動中止される想定。）
 *
 * 計画用の自動処理のため個別通知は発行しない（当日分の繰り上げは daily-finalize が担当）。
 */
export async function healFutureSpeakers(
  cutoffStr: string = ROTATION_FIXED_UNTIL,
  tx: TxClient = prisma
): Promise<HealResult> {
  const cutoff = new Date(`${cutoffStr}T23:59:59.999Z`).getTime();

  const members = await tx.user.findMany({
    where: { choreiStatus: 'active', deletedAt: null },
  });
  if (members.length === 0) return { filled: 0, reassigned: 0 };
  const memberIds = new Set(members.map((m) => m.id));

  const sessions = await tx.session.findMany({
    where: { status: { not: 'cancelled' } },
    orderBy: { date: 'asc' },
  });

  // 付け替え対象（cutoff より後の予定セッション）の欠席者をまとめて取得する。
  // 欠席 = AbsenceRequest あり、または Attendance が absent/left_early/unspoken。
  const cutoffMs = cutoff;
  const targetIds = sessions
    .filter((s) => s.date.getTime() > cutoffMs && s.status === 'scheduled' && !isReviewSession(s.adminNote))
    .map((s) => s.id);
  const unavailableBySession = new Map<number, Set<string>>();
  if (targetIds.length > 0) {
    const [reqs, atts] = await Promise.all([
      tx.absenceRequest.findMany({ where: { sessionId: { in: targetIds } }, select: { sessionId: true, userId: true } }),
      tx.attendance.findMany({
        where: { sessionId: { in: targetIds }, status: { in: ['absent', 'left_early', 'unspoken'] } },
        select: { sessionId: true, userId: true },
      }),
    ]);
    for (const r of [...reqs, ...atts]) {
      const set = unavailableBySession.get(r.sessionId) ?? new Set<string>();
      set.add(r.userId);
      unavailableBySession.set(r.sessionId, set);
    }
  }

  // 全体の発話回数（過去＋割当済み未来）。割当の偏りを抑えるため全期間で集計。
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.id, 0);
  for (const s of sessions) {
    if (isReviewSession(s.adminNote)) continue;
    if (s.speakerId && memberIds.has(s.speakerId)) {
      counts.set(s.speakerId, (counts.get(s.speakerId) ?? 0) + 1);
    }
  }

  const rnd = new Map<string, number>();
  for (const m of members) rnd.set(m.id, Math.random());

  const cooldown = Math.max(0, ROTATION_NO_REPEAT_WINDOW - 1);
  const recent: (string | null)[] = [];
  const pushRecent = (id: string | null) => {
    recent.push(id);
    while (recent.length > cooldown) recent.shift();
  };

  let filled = 0;
  let reassigned = 0;
  for (const s of sessions) {
    // 棚卸し回・固定範囲・未来でない予定はそのまま（窓だけ進める）。
    const isFutureScheduled = s.date.getTime() > cutoff && s.status === 'scheduled';
    if (isReviewSession(s.adminNote) || !isFutureScheduled) {
      pushRecent(s.speakerId ?? null);
      continue;
    }

    const blocked = new Set(recent.filter((id): id is string => id !== null));
    const unavailable = unavailableBySession.get(s.id) ?? new Set<string>();
    const curr = s.speakerId;
    const currValid =
      !!curr && memberIds.has(curr) && !blocked.has(curr) && !unavailable.has(curr);

    // 正しい割当はそのまま尊重。
    if (currValid) {
      pushRecent(curr);
      continue;
    }

    // 当日欠席者は必ず除外。そのうえで直近窓の登壇者も除外（なか4回飛ばす）。
    // 候補が枯渇したら窓制約だけ緩める（欠席除外は維持）。
    const available = members.filter((m) => !unavailable.has(m.id));
    const preferred = available.filter((m) => !blocked.has(m.id));
    const candidates = preferred.length > 0 ? preferred : available;

    let best: string | null = null;
    let bestKey: [number, number] | null = null;
    for (const m of candidates) {
      const key: [number, number] = [counts.get(m.id) ?? 0, rnd.get(m.id)!];
      if (
        bestKey === null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && key[1] < bestKey[1])
      ) {
        best = m.id;
        bestKey = key;
      }
    }
    if (!best) {
      // 登壇可能者が皆無。欠席者を残さないため未定(null)にする（最低人数割れで自動中止される想定）。
      if (curr) {
        if (memberIds.has(curr)) counts.set(curr, Math.max(0, (counts.get(curr) ?? 0) - 1));
        await tx.session.update({ where: { id: s.id }, data: { speakerId: null } });
        reassigned++;
      }
      pushRecent(null);
      continue;
    }

    // 付け替え：旧発話者が現役なら回数を戻し、新発話者に加算。
    if (curr && memberIds.has(curr)) {
      counts.set(curr, Math.max(0, (counts.get(curr) ?? 0) - 1));
    }
    counts.set(best, (counts.get(best) ?? 0) + 1);

    await tx.session.update({ where: { id: s.id }, data: { speakerId: best } });
    if (curr) reassigned++;
    else filled++;
    pushRecent(best);
  }

  return { filled, reassigned };
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
