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
 *   - Clear speaker on current session
 *   - Pull subsequent speakers forward by 1
 *   - Append a new session at the end for the displaced (absent) speaker
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

  // 1. Remove speaker from the target (today)
  await prisma.session.update({
    where: { id: target.id },
    data: {
      speakerId: null,
      adminNote: target.adminNote
        ? `${target.adminNote} / 欠席により発表順延`
        : '欠席により発表順延',
    },
  });

  if (futureSessions.length > 1) {
    // 2. Shift speakerId/topicId forward along the chain
    let prevSpeakerId = futureSessions[0].speakerId;
    let prevTopicId = futureSessions[0].topicId;

    for (let i = 1; i < futureSessions.length; i++) {
      const s = futureSessions[i];
      const currSpeakerId = s.speakerId;
      const currTopicId = s.topicId;

      await prisma.session.update({
        where: { id: s.id },
        data: {
          speakerId: prevSpeakerId,
          topicId: prevTopicId,
          adminNote: s.adminNote ?? '自動順送り（スケジュール再割当）',
        },
      });

      prevSpeakerId = currSpeakerId;
      prevTopicId = currTopicId;
    }

    // 3. Create a new session at the end for the displaced (absent) speaker
    const lastSession = futureSessions[futureSessions.length - 1];
    const holidays = await prisma.holiday.findMany({ where: { isActive: true } });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    const nextStartDate = new Date(lastSession.date);
    nextStartDate.setDate(nextStartDate.getDate() + 1);
    const nextDates = getSessionDates(nextStartDate, 1, holidaySet);

    if (nextDates.length > 0 && prevSpeakerId) {
      const newDate = nextDates[0];
      const weekNum = getWeekNumber(newDate, new Date(futureSessions[0].date));

      await prisma.session.create({
        data: {
          date: newDate,
          phaseId: lastSession.phaseId,
          weekNumber: weekNum,
          topicId: prevTopicId,
          speakerId: prevSpeakerId,
          startTime: lastSession.startTime,
          endTime: lastSession.endTime,
          status: 'scheduled',
          roundNumber: lastSession.roundNumber,
          adminNote: '自動順送りによる追加枠',
        },
      });
    }
  }

  // Silence unused var warning (absentUserId is reserved for audit/log extension)
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
    report.reasons.push('発話者不在のため後続セッションを繰り上げ、末尾に新枠を追加');
  }

  // 2) Commentator absence in Phase 2/3: re-select to backfill
  if (!isSpeaker && isCommentator && phaseNumber !== 1) {
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
