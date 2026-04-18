import { prisma } from './prisma';
import { GRADE_ORDER, SESSION_DAYS } from './constants';

/**
 * Generate rotation schedule for Phase 1
 */
export async function generateRotation(
  phaseId: number,
  roundNumber: number,
  startDate: Date
) {
  // Get all members
  const users = await prisma.user.findMany();

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
    // Round 2, 3: Random order
    sortedUsers = [...users].sort(() => Math.random() - 0.5);
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

/**
 * Handle absence rescheduling for Round 1
 */
export async function rescheduleForAbsence(
  sessionId: number,
  absentUserId: string
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { speaker: true },
  });

  if (!session) return null;

  // For Round 1: Push absent speaker to end of round
  if (session.roundNumber === 1) {
    // Check if speaker is E2a or E2b at the beginning (exception case)
    if (
      ['E2a', 'E2b'].includes(session.speaker.grade) &&
      session.weekNumber <= 1
    ) {
      // Return null - admin should handle manually
      return null;
    }

    // Find remaining sessions in this round after this one
    const remainingSessions = await prisma.session.findMany({
      where: {
        phaseId: session.phaseId,
        roundNumber: session.roundNumber,
        date: { gt: session.date },
        status: 'scheduled',
      },
      orderBy: { date: 'asc' },
    });

    // Shift speakers forward and add absent speaker at end
    if (remainingSessions.length > 0) {
      const speakers = remainingSessions.map((s) => s.speakerId);
      speakers.push(absentUserId);

      // Update current session's speaker to next in line
      // This shifts everyone forward
      return { action: 'shift', speakers, sessions: remainingSessions };
    }
  }

  return { action: 'manual' };
}

function getSessionDates(
  startDate: Date,
  count: number,
  holidaySet: Set<string>
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (dates.length < count) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    if (
      SESSION_DAYS.includes(dayOfWeek as (typeof SESSION_DAYS)[number]) &&
      !holidaySet.has(dateStr)
    ) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getWeekNumber(date: Date, startDate: Date): number {
  const msPerDay = 86400000;
  const daysDiff = Math.floor(
    (date.getTime() - startDate.getTime()) / msPerDay
  );
  return Math.floor(daysDiff / 7) + 1;
}
