import { prisma } from './prisma';
import { getSessionDates, getWeekNumber } from './rotation';

// Minimum attendance rules
// Phase 1: total attendance (speaker + listeners) must be >= 3
// Phase 2/3: commentators count must be >= 4
export const PHASE1_MIN_TOTAL = 3;
export const PHASE2_3_MIN_COMMENTATORS = 4;

export type AdjustmentReport = {
  speakerCascaded: boolean;
  commentatorReassigned: boolean;
  sessionCancelled: boolean;
  reasons: string[];
};

/**
 * Determine phase number for a session via its phase relation.
 */
async function getPhaseNumber(phaseId: number): Promise<number> {
  const phase = await prisma.phase.findUnique({ where: { id: phaseId } });
  return phase?.phaseNumber ?? 1;
}

/**
 * Collect user IDs that are declared absent (AbsenceRequest) or marked absent/left_early/unspoken in Attendance
 * for a given session.
 */
export async function getUnavailableUserIds(sessionId: number): Promise<Set<string>> {
  const [attendances, requests] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        sessionId,
        status: { in: ['absent', 'left_early', 'unspoken'] },
      },
    }),
    prisma.absenceRequest.findMany({ where: { sessionId } }),
  ]);
  return new Set<string>([
    ...attendances.map((a) => a.userId),
    ...requests.map((r) => r.userId),
  ]);
}

/**
 * Cascade speaker shift when the scheduled speaker is absent:
 *   - Pull subsequent speakers forward by 1 (A→D0, B→D1, …)
 *   - Place the absent speaker at the last existing slot in the chain
 * Works for any phase where speakerId drives rotation.
 */
export async function cascadeSpeakerShift(sessionId: number, absentUserId: string) {
  const target = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!target) return;

  const futureSessions = await prisma.session.findMany({
    where: {
      phaseId: target.phaseId,
      date: { gte: target.date },
    },
    orderBy: { date: 'asc' },
  });
  if (futureSessions.length === 0) return;

  const absentSpeakerId = futureSessions[0].speakerId; // the absent user (X)
  const absentTopicId = futureSessions[0].topicId;

  if (futureSessions.length === 1) {
    // Only this session exists — clear the speaker, create a new slot for X
    await prisma.session.update({
      where: { id: target.id },
      data: {
        speakerId: null,
        adminNote: target.adminNote
          ? `${target.adminNote} / 欠席により発表順延`
          : '欠席により発表順延',
      },
    });

    const holidays = await prisma.holiday.findMany({ where: { isActive: true } });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));
    const nextStart = new Date(target.date);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextDates = getSessionDates(nextStart, 1, holidaySet);
    if (nextDates.length > 0 && absentSpeakerId) {
      await prisma.session.create({
        data: {
          date: nextDates[0],
          phaseId: target.phaseId,
          weekNumber: getWeekNumber(nextDates[0], new Date(target.date)),
          topicId: absentTopicId,
          speakerId: absentSpeakerId,
          startTime: target.startTime,
          endTime: target.endTime,
          status: 'scheduled',
          roundNumber: target.roundNumber,
          adminNote: '自動順送りによる追加枠',
        },
      });
    }
    return;
  }

  // Pull everyone forward: futureSessions[i] gets futureSessions[i+1]'s speaker.
  // The last slot in the chain receives the absent speaker (X), so no one speaks twice.
  for (let i = 0; i < futureSessions.length - 1; i++) {
    const next = futureSessions[i + 1];
    await prisma.session.update({
      where: { id: futureSessions[i].id },
      data: {
        speakerId: next.speakerId,
        topicId: next.topicId,
        adminNote:
          i === 0
            ? futureSessions[i].adminNote
              ? `${futureSessions[i].adminNote} / 欠席により発表順延`
              : '欠席により発表順延'
            : (futureSessions[i].adminNote ?? '自動順送り（スケジュール再割当）'),
      },
    });
  }

  // Place absent speaker (X) at the tail of the existing chain
  const last = futureSessions[futureSessions.length - 1];
  await prisma.session.update({
    where: { id: last.id },
    data: {
      speakerId: absentSpeakerId,
      topicId: absentTopicId,
      adminNote: last.adminNote ?? '自動順送りによる末尾追加',
    },
  });

  // Silence unused var warning (absentUserId reserved for future audit/log extension)
  void absentUserId;
}

/**
 * Re-select commentators for a session, replacing unavailable users.
 * Target commentator count defaults to what's currently set (or 4 if not set).
 */
export async function reselectCommentators(sessionId: number): Promise<number> {
  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!targetSession) return 0;

  const desiredCount = Math.max(targetSession.commentators.length, PHASE2_3_MIN_COMMENTATORS);

  const unavailable = await getUnavailableUserIds(sessionId);

  const candidateUsers = await prisma.user.findMany({
    where: targetSession.speakerId ? { id: { not: targetSession.speakerId } } : undefined,
  });
  const availableUsers = candidateUsers.filter((u) => !unavailable.has(u.id));

  // Shuffle and select
  const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(desiredCount, shuffled.length));

  await prisma.session.update({
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
export async function enforceMinimumAttendance(sessionId: number): Promise<{
  cancelled: boolean;
  reason?: string;
}> {
  const target = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!target) return { cancelled: false };

  const phaseNumber = await getPhaseNumber(target.phaseId);

  const unavailable = await getUnavailableUserIds(sessionId);
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const availableTotal = allUsers.filter((u) => !unavailable.has(u.id)).length;

  if (phaseNumber === 1) {
    if (availableTotal < PHASE1_MIN_TOTAL) {
      await prisma.session.update({
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
      await prisma.session.update({
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
  absentUserId: string
): Promise<AdjustmentReport> {
  const report: AdjustmentReport = {
    speakerCascaded: false,
    commentatorReassigned: false,
    sessionCancelled: false,
    reasons: [],
  };

  const target = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { commentators: { select: { id: true } } },
  });
  if (!target) return report;

  const phaseNumber = await getPhaseNumber(target.phaseId);
  const isSpeaker = target.speakerId === absentUserId;
  const isCommentator = target.commentators.some((c) => c.id === absentUserId);

  // 1) Speaker absence: cascade shift (all phases)
  if (isSpeaker) {
    await cascadeSpeakerShift(sessionId, absentUserId);
    report.speakerCascaded = true;
    report.reasons.push('発話者不在のため後続セッションを繰り上げ、末尾に追加');
    // Phase 2/3: after cascade the new speaker may overlap existing commentators → re-select
    if (phaseNumber !== 1) {
      await reselectCommentators(sessionId);
      report.commentatorReassigned = true;
      report.reasons.push('発話者変更に伴い応答者を再抽選');
    }
  }

  // 2) Commentator absence in Phase 2/3: re-select to backfill
  if (!isSpeaker && phaseNumber !== 1) {
    await reselectCommentators(sessionId);
    report.commentatorReassigned = true;
    report.reasons.push('応答者不在のため代替応答者を再抽選');
  }

  // 3) Enforce minimum attendance after adjustments
  const enforcement = await enforceMinimumAttendance(sessionId);
  if (enforcement.cancelled) {
    report.sessionCancelled = true;
    if (enforcement.reason) report.reasons.push(enforcement.reason);
  }

  return report;
}

/**
 * Determine whether a session is still within the self-cancel window.
 * Cutoff: previous day 23:59 (local time of the server).
 */
export function canSelfCancel(sessionDate: Date, now: Date = new Date()): boolean {
  const cutoff = new Date(sessionDate);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setMinutes(cutoff.getMinutes() - 1); // = previous day 23:59
  return now <= cutoff;
}
