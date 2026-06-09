import { prisma } from './prisma';

export const CONFIG_KEYS = {
  MEETING_URL: 'meeting_url',
  LUNCH_PARTICIPANT_COUNT: 'lunch_participant_count',
} as const;

export const DEFAULT_MEETING_URL = 'https://teams.microsoft.com/meet/4994985303963?p=2rYMBuP8rBv9EtKEKD';

export const DEFAULT_LUNCH_PARTICIPANT_COUNT = 3;

/** ランチ選定人数（主催者を除く抽選人数）。1以上の整数。未設定時は既定値。 */
export async function getLunchParticipantCount(): Promise<number> {
  const raw = await getConfigValue(
    CONFIG_KEYS.LUNCH_PARTICIPANT_COUNT,
    String(DEFAULT_LUNCH_PARTICIPANT_COUNT)
  );
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_LUNCH_PARTICIPANT_COUNT;
}

/**
 * Get a config value by key. Returns default if not set.
 */
export async function getConfigValue(
  key: string,
  defaultValue: string
): Promise<string> {
  const config = await prisma.config.findUnique({ where: { key } });
  return config?.value ?? defaultValue;
}

/**
 * Set a config value and record history.
 */
export async function setConfigValue(
  key: string,
  newValue: string,
  userId: string
): Promise<void> {
  const existing = await prisma.config.findUnique({ where: { key } });
  const oldValue = existing?.value ?? null;

  if (oldValue === newValue) return;

  await prisma.$transaction([
    prisma.config.upsert({
      where: { key },
      update: { value: newValue, updatedBy: userId },
      create: { key, value: newValue, updatedBy: userId },
    }),
    prisma.configHistory.create({
      data: {
        configKey: key,
        oldValue,
        newValue,
        changedBy: userId,
      },
    }),
  ]);
}

export async function getConfigHistory(key: string, limit = 50) {
  return prisma.configHistory.findMany({
    where: { configKey: key },
    include: {
      changedByUser: { select: { id: true, name: true, grade: true } },
    },
    orderBy: { changedAt: 'desc' },
    take: limit,
  });
}
