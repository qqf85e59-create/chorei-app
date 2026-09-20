import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { holidaysBetween } from './japanese-holidays';

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * from〜to の祝日・全社休み（お盆・年末年始）が Holiday テーブルに入っていることを保証する。
 * 予定を先の日付まで作る前に呼ぶ。既にある日付は名前を変えない（手動の調整を尊重する）。
 * 戻り値は新しく登録した件数。
 */
export async function ensureHolidaysForRange(
  from: Date,
  to: Date,
  tx: TxClient = prisma
): Promise<number> {
  const defs = holidaysBetween(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
  const existing = await tx.holiday.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true },
  });
  const known = new Set(existing.map((h) => h.date.toISOString().slice(0, 10)));

  const missing = defs.filter((d) => !known.has(d.date));
  for (const d of missing) {
    await tx.holiday.create({
      data: { date: new Date(`${d.date}T00:00:00.000Z`), name: d.name, isActive: true },
    });
  }
  return missing.length;
}

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
