import { prisma } from './prisma';

/**
 * Check consecutive absences for a given user
 * Returns the count of consecutive absences up to the most recent session
 */
export async function getConsecutiveAbsences(userId: string): Promise<number> {
  const attendances = await prisma.attendance.findMany({
    where: { userId },
    include: { session: true },
    orderBy: { session: { date: 'desc' } },
    take: 10,
  });

  let count = 0;
  for (const att of attendances) {
    if (att.status === 'absent') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Get all users with their consecutive absence counts
 */
export async function getAllAbsenceAlerts(): Promise<
  Array<{
    userId: string;
    userName: string;
    grade: string;
    consecutiveAbsences: number;
    alertLevel: 'none' | 'warning' | 'danger';
  }>
> {
  const users = await prisma.user.findMany();
  const alerts = [];

  for (const user of users) {
    const count = await getConsecutiveAbsences(user.id);
    let alertLevel: 'none' | 'warning' | 'danger' = 'none';
    if (count >= 3) {
      alertLevel = 'danger';
    } else if (count >= 2) {
      alertLevel = 'warning';
    }

    if (count >= 2) {
      alerts.push({
        userId: user.id,
        userName: user.name,
        grade: user.grade,
        consecutiveAbsences: count,
        alertLevel,
      });
    }
  }

  return alerts;
}
