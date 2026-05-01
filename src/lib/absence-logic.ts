import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getSessionDates, getWeekNumber } from './rotation';

// Type for transaction client or regular prisma client
type TxClient = Prisma.TransactionClient | PrismaClient;

// Minimum attendance rules
// Phase 1: total attendance (speaker + listeners) must be >= 3
// Phase 2/3: commentators count must be >= 4
export const PHASE1_MIN_TOTAL = 3;
export const PHASE2_3_MIN_COMMENTATORS = 1; // Phase 2 は応答者1名（欠席時は自動再選）

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
 * Cascade speaker shift when the scheduled speaker is absent:
 *   - Clear speaker on current session
 *   - Pull subsequent speakers forward by 1
 *   - Append a new session at the end for the displaced (absent) speaker
 * Works for any phase where speakerId drives rotation.
 * Also creates Notification records for each affected speaker [9].
 */
export async function cascadeSpeakerShift(sessionId: number, absentUserId: string, tx: TxClient = prisma) {
  const target = await tx.session.findUnique({ where: { id: sessionId } });
  if (!target || !absentUserId) return;

  // 1. Clear the absent speaker from the target session (no speaker on this day)
  await tx.session.update({
    where: { id: target.id },
    data: {
      speakerId: null,
      adminNote: target.adminNote
        ? `${target.adminNote} / 欠席により発表順延`
        : '欠席により発表順延',
    },
  });

  // 2. Find the last session in this phase to append after
  const lastSession = await tx.session.findFirst({
    where: { phaseId: target.phaseId, status: 'scheduled' },
    orderBy: { date: 'desc' },
  });
  if (!lastSession) return;

  // 3. Generate the next available session date after the last session
  const holidays = await tx.holiday.findMany({ where: { isActive: true } });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

  const nextStartDate = new Date(lastSession.date);
  nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
  const nextDates = getSessionDates(nextStartDate, 1, holidaySet);
  if (nextDates.length === 0) return;

  const newDate = nextDates[0];
  const weekNum = getWeekNumber(newDate, new Date(target.date));

  // 4. Append a new session at the end for the absent speaker
  const newSession = await tx.session.create({
    data: {
      date: newDate,
      phaseId: target.phaseId,
      weekNumber: weekNum,
      topicId: target.topicId,
      speakerId: absentUserId,
      startTime: target.startTime,
      endTime: target.endTime,
      status: 'scheduled',
      roundNumber: target.roundNumber,
      adminNote: '自動順送りによる追加枠',
    },
  });

  // 5. Notify the absent speaker of their new date
  await tx.notification.create({
    data: {
      userId: absentUserId,
      sessionId: newSession.id,
      type: 'speaker_change',
      message: `${formatDateJP(newDate)} に発話が順延されました（欠席による自動振替）`,
    },
  });
}

/**
 * Reverse a cascade speaker shift when an absence is cancelled.
 * - Shifts speakers/topics backward by 1 (opposite of cascade)
 * - Deletes the trailing auto-appended session
 * - Restores the original speaker on the target session
 */
export async function reverseCascadeSpeakerShift(
  sessionId: number,
  originalUserId: string,
  tx: TxClient = prisma
) {
  const target = await tx.session.findUnique({ where: { id: sessionId } });
  if (!target) return;

  // 1. Find and delete the auto-appended session for this user
  //    (the session created at the end by cascadeSpeakerShift)
  const appendedSession = await tx.session.findFirst({
    where: {
      phaseId: target.phaseId,
      speakerId: originalUserId,
      adminNote: { contains: '自動順送りによる追加枠' },
    },
    orderBy: { date: 'desc' },
  });
  if (appendedSession) {
    await tx.session.delete({ where: { id: appendedSession.id } });
  }

  // 2. Restore the original speaker on the target session
  await tx.session.update({
    where: { id: target.id },
    data: {
      speakerId: originalUserId,
      adminNote: target.adminNote
        ? target.adminNote.replace(/ ?\/ ?欠席により発表順延/, '').trim() || null
        : null,
    },
  });
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

  const candidateUsers = await tx.user.findMany({
    where: targetSession.speakerId ? { id: { not: targetSession.speakerId } } : undefined,
  });
  const availableUsers = candidateUsers.filter((u) => !unavailable.has(u.id));

  // Shuffle and select
  const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
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
  const isCommentator = target.commentators.some((c) => c.id === absentUserId);

  // 1) Speaker absence: cascade shift (all phases)
  if (isSpeaker) {
    await cascadeSpeakerShift(sessionId, absentUserId, tx);
    report.speakerCascaded = true;
    report.reasons.push('発話者不在のため後続セッションを繰り上げ、末尾に新枠を追加');
  }

  // 2) Commentator absence in Phase 2/3: re-select to backfill
  if (!isSpeaker && isCommentator && phaseNumber !== 1) {
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
