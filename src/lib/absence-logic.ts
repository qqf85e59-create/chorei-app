import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma';

// Type for transaction client or regular prisma client
type TxClient = Prisma.TransactionClient | PrismaClient;

// Minimum attendance rules
// Phase 1: total attendance (speaker + listeners) must be >= 3
// Phase 2/3: at least 1 commentator (respondent) required; absentees trigger auto re-selection.
export const PHASE1_MIN_TOTAL = 3;
export const PHASE2_3_MIN_COMMENTATORS = 1; // Phase 2 は応答者1名（欠席時は自動再選）

/** Unbiased Fisher–Yates shuffle (does not mutate the input). */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type AdjustmentReport = {
  speakerCascaded: boolean;
  commentatorReassigned: boolean;
  sessionCancelled: boolean;
  reasons: string[];
};

/**
 * Determine phase number for a session via its phase relation.
 */
async function getPhaseNumber(phaseId: number, tx: TxClient = prisma): Promise<number> {
  const phase = await tx.phase.findUnique({ where: { id: phaseId } });
  return phase?.phaseNumber ?? 1;
}

/**
 * Collect user IDs that are declared absent (AbsenceRequest) or marked absent/left_early/unspoken in Attendance
 * for a given session.
 */
export async function getUnavailableUserIds(sessionId: number, tx: TxClient = prisma): Promise<Set<string>> {
  // NOTE: Sequential queries — Prisma interactive transactions do not support
  // concurrent queries on the same transaction client (single connection).
  const attendances = await tx.attendance.findMany({
    where: {
      sessionId,
      status: { in: ['absent', 'left_early', 'unspoken'] },
    },
  });
  const requests = await tx.absenceRequest.findMany({ where: { sessionId } });
  return new Set<string>([
    ...attendances.map((a) => a.userId),
    ...requests.map((r) => r.userId),
  ]);
}

/**
 * Format a date as a Japanese-style date string (e.g. "5月12日").
 */
function formatDateJP(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * Reflow speakers across the remaining scheduled sessions of a phase ("繰り上げ").
 *
 * Pure re-assignment over EXISTING sessions — no new slots are appended (this is
 * what previously caused makeup slots to spill past the phase end and collide with
 * the next phase's dates).
 *
 * Algorithm:
 *   1. Take the current speakers of the scheduled sessions on/after `fromDate`,
 *      in date order, as a queue.
 *   2. Walk the dates; for each, assign the first queued speaker who is NOT
 *      unavailable (absent / left_early / unspoken) on that date.
 *   3. An unavailable speaker stays at the front of the queue and is deferred to
 *      the next date they can attend — i.e. "次回へ送る（次回も欠席なら次々回へ…）".
 *   4. If nobody in the queue can attend a date, that session is left with no speaker.
 *
 * Notifies a speaker whenever their assigned date changes.
 * Returns the number of sessions whose speaker changed.
 */
export async function reflowSpeakers(
  phaseId: number,
  fromDate: Date,
  tx: TxClient = prisma
): Promise<number> {
  const sessions = await tx.session.findMany({
    where: { phaseId, status: 'scheduled', date: { gte: fromDate } },
    orderBy: { date: 'asc' },
  });
  if (sessions.length === 0) return 0;

  // Queue of speakers to place, preserving current rotation order (skip empties).
  const queue: string[] = sessions
    .map((s) => s.speakerId)
    .filter((id): id is string => id !== null);

  // Unavailable user set per session (sequential — interactive tx is single-connection).
  const unavailableBySession = new Map<number, Set<string>>();
  for (const s of sessions) {
    unavailableBySession.set(s.id, await getUnavailableUserIds(s.id, tx));
  }

  let changed = 0;
  for (const s of sessions) {
    const unavailable = unavailableBySession.get(s.id)!;
    const pickIdx = queue.findIndex((uid) => !unavailable.has(uid));
    const newSpeaker = pickIdx >= 0 ? queue[pickIdx] : null;
    if (pickIdx >= 0) queue.splice(pickIdx, 1);

    if (s.speakerId === newSpeaker) continue;

    await tx.session.update({
      where: { id: s.id },
      data: { speakerId: newSpeaker },
    });
    changed++;

    if (newSpeaker) {
      await tx.notification.create({
        data: {
          userId: newSpeaker,
          sessionId: s.id,
          type: 'speaker_change',
          message: `${formatDateJP(s.date)} の発話担当になりました（欠席による繰り上げ）`,
        },
      });
    }
  }

  return changed;
}

/**
 * Re-select commentators for a session, replacing unavailable users.
 * Target commentator count defaults to what's currently set (or 4 if not set).
 */
export async function reselectCommentators(sessionId: number, tx: TxClient = prisma): Promise<number> {
  const targetSession = await tx.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!targetSession) return 0;

  const desiredCount = Math.max(targetSession.commentators.length, PHASE2_3_MIN_COMMENTATORS);

  const unavailable = await getUnavailableUserIds(sessionId, tx);

  // 朝礼参加対象（choreiStatus: 'active'）かつ未削除のメンバーのみを候補にする。
  const candidateUsers = await tx.user.findMany({
    where: {
      deletedAt: null,
      choreiStatus: 'active',
      ...(targetSession.speakerId ? { id: { not: targetSession.speakerId } } : {}),
    },
  });
  const availableUsers = candidateUsers.filter((u) => !unavailable.has(u.id));

  // Shuffle and select
  const shuffled = shuffle(availableUsers);
  const selected = shuffled.slice(0, Math.min(desiredCount, shuffled.length));

  await tx.session.update({
    where: { id: sessionId },
    data: {
      commentators: { set: selected.map((u) => ({ id: u.id })) },
      commentatorsUpdatedAt: new Date(),
    },
  });

  return selected.length;
}

/**
 * Check minimum attendance and auto-cancel the session if below threshold.
 * Returns true if the session was cancelled.
 */
export async function enforceMinimumAttendance(sessionId: number, tx: TxClient = prisma): Promise<{
  cancelled: boolean;
  reason?: string;
}> {
  const target = await tx.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!target) return { cancelled: false };

  const phaseNumber = await getPhaseNumber(target.phaseId, tx);

  const unavailable = await getUnavailableUserIds(sessionId, tx);
  const allUsers = await tx.user.findMany({ select: { id: true } });
  const availableTotal = allUsers.filter((u) => !unavailable.has(u.id)).length;

  if (phaseNumber === 1) {
    if (availableTotal < PHASE1_MIN_TOTAL) {
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'cancelled',
          adminNote: target.adminNote
            ? `${target.adminNote} / 参加者不足により自動中止（出席${availableTotal}名<最低${PHASE1_MIN_TOTAL}名）`
            : `参加者不足により自動中止（出席${availableTotal}名<最低${PHASE1_MIN_TOTAL}名）`,
        },
      });
      return {
        cancelled: true,
        reason: `参加者不足により自動中止（出席${availableTotal}名<最低${PHASE1_MIN_TOTAL}名）`,
      };
    }
  } else {
    // Phase 2/3: require >= 4 commentators
    const availableCommentators = target.commentators.filter((c) => !unavailable.has(c.id)).length;
    if (availableCommentators < PHASE2_3_MIN_COMMENTATORS) {
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'cancelled',
          adminNote: target.adminNote
            ? `${target.adminNote} / 応答者不足により自動中止（応答者${availableCommentators}名<最低${PHASE2_3_MIN_COMMENTATORS}名）`
            : `応答者不足により自動中止（応答者${availableCommentators}名<最低${PHASE2_3_MIN_COMMENTATORS}名）`,
        },
      });
      return {
        cancelled: true,
        reason: `応答者不足により自動中止（応答者${availableCommentators}名<最低${PHASE2_3_MIN_COMMENTATORS}名）`,
      };
    }
  }

  return { cancelled: false };
}

/**
 * Orchestrate absence-driven adjustments.
 * Call after creating an AbsenceRequest and updating Attendance.
 */
export async function adjustForAbsence(
  sessionId: number,
  absentUserId: string,
  tx: TxClient = prisma
): Promise<AdjustmentReport> {
  const report: AdjustmentReport = {
    speakerCascaded: false,
    commentatorReassigned: false,
    sessionCancelled: false,
    reasons: [],
  };

  const target = await tx.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!target) return report;

  const phaseNumber = await getPhaseNumber(target.phaseId, tx);
  const isSpeaker = target.speakerId === absentUserId;

  // 1) Speaker absence: reflow subsequent speakers forward (all phases).
  //    The absent speaker is deferred to their next attendable session; no new
  //    slot is appended.
  if (isSpeaker) {
    await reflowSpeakers(target.phaseId, target.date, tx);
    report.speakerCascaded = true;
    report.reasons.push('発話者不在のため後続セッションを繰り上げ');
    // Phase 2/3: the incoming speaker may already be a commentator → re-select
    if (phaseNumber !== 1) {
      await reselectCommentators(sessionId, tx);
      report.commentatorReassigned = true;
      report.reasons.push('発話者変更に伴い応答者を再抽選');
    }
  }

  // 2) Non-speaker absence in Phase 2/3: re-select to backfill regardless of commentator status
  if (!isSpeaker && phaseNumber !== 1) {
    await reselectCommentators(sessionId, tx);
    report.commentatorReassigned = true;
    report.reasons.push('応答者不在のため代替応答者を再抽選');
  }

  // 3) Enforce minimum attendance after adjustments
  const enforcement = await enforceMinimumAttendance(sessionId, tx);
  if (enforcement.cancelled) {
    report.sessionCancelled = true;
    if (enforcement.reason) report.reasons.push(enforcement.reason);
  }

  return report;
}

/**
 * Determine whether a session is still within the self-cancel window.
 * Cutoff: previous day 23:59:59 JST (Asia/Tokyo).
 * Uses JST-fixed calculation so Vercel (UTC) and local (JST) produce identical results.
 */
export function canSelfCancel(sessionDate: Date, now: Date = new Date()): boolean {
  // Convert sessionDate to JST date string (YYYY-MM-DD format)
  const jstDateStr = sessionDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  // Session midnight JST = sessionDate's date at 00:00:00 JST
  const sessionMidnightJST = new Date(`${jstDateStr}T00:00:00+09:00`);
  // Cutoff = previous day 23:59:59 JST = session midnight JST - 1 second
  const cutoff = new Date(sessionMidnightJST.getTime() - 1000);

  // Both cutoff and now are absolute UTC timestamps, safe to compare
  return now <= cutoff;
}
