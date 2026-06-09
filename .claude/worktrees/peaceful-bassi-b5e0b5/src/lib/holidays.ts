import { prisma } from './prisma';

/**
 * Check if a given date is a holiday
 */
export async function isHoliday(date: Date): Promise<boolean> {
  const dateOnly = new Date(date.toISOString().split('T')[0]);
  const holiday = await prisma.holiday.findFirst({
    where: {
      date: dateOnly,
      isActive: true,
    },
  });
  return !!holiday;
}

/**
 * Get all holidays for a given year
 */
export async function getHolidaysForYear(year: number) {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  return prisma.holiday.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Get holidays for a date range
 */
export async function getHolidaysForRange(start: Date, end: Date) {
  return prisma.holiday.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
      isActive: true,
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Toggle holiday active status (admin override)
 */
export async function toggleHoliday(holidayId: number, isActive: boolean) {
  return prisma.holiday.update({
    where: { id: holidayId },
    data: { isActive },
  });
}
