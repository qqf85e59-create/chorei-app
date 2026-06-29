/**
 * add-lunch-2026-07.ts — 1回限りのランチ会作成スクリプト
 *
 * 通常のアプリフローは「主催者＝ログイン本人／参加者＝ランダム選定」のため、
 * 主催者・参加者を指名した作成ができない。これを直接投入する。
 *
 *   - タイトル: 2026年7月ランチ会
 *   - 主催者:   篠原 俊伍
 *   - 参加者:   栗田 駿人 / 佐藤 翼 / 佐藤 駿
 *   - 場所/日程: 未定（status=planning, confirmedDate=null, restaurantId=null）
 *
 * 冪等性: 同名(planning/scheduled)イベントが既にあれば作成せず中断する。
 *
 * 実行:
 *   npx tsx prisma/add-lunch-2026-07.ts --dry-run   # 確認のみ（DB未変更）
 *   npx tsx prisma/add-lunch-2026-07.ts             # 本反映
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const TITLE = '2026年7月ランチ会';
const ORGANIZER_NAME = '篠原 俊伍';
const PARTICIPANT_NAMES = ['栗田 駿人', '佐藤 翼', '佐藤 駿'];

const norm = (s: string) => s.replace(/\s+/g, '');

async function resolveUserId(name: string): Promise<string> {
  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  const matches = users.filter((u) => norm(u.name) === norm(name));
  if (matches.length === 0) throw new Error(`ユーザーが見つかりません: 「${name}」`);
  if (matches.length > 1) throw new Error(`ユーザー名が複数一致: 「${name}」（${matches.map((m) => m.id).join(', ')}）`);
  return matches[0].id;
}

async function main() {
  console.log(`🍴 ランチ会作成 ${DRY_RUN ? '(DRY-RUN: 変更しません)' : '(本反映)'}\n`);

  // 重複ガード（API と同条件）
  const existing = await prisma.lunchEvent.findFirst({
    where: { title: TITLE, status: { in: ['planning', 'scheduled'] } },
  });
  if (existing) {
    throw new Error(`同名イベントが既に存在します（id=${existing.id}, status=${existing.status}）。作成を中断。`);
  }

  const organizerId = await resolveUserId(ORGANIZER_NAME);
  const participantIds = await Promise.all(PARTICIPANT_NAMES.map(resolveUserId));

  console.log(`タイトル: ${TITLE}`);
  console.log(`主催者:   ${ORGANIZER_NAME} (${organizerId})`);
  PARTICIPANT_NAMES.forEach((n, i) => console.log(`参加者:   ${n} (${participantIds[i]})`));
  console.log(`場所/日程: 未定 (status=planning)\n`);

  if (DRY_RUN) {
    console.log('✅ DRY-RUN 完了（DBは未変更）。本反映は --dry-run なしで実行。');
    return;
  }

  // Neon serverless では interactive trx が不安定なため逐次実行。
  const event = await prisma.lunchEvent.create({
    data: { title: TITLE, organizerId, status: 'planning' },
  });
  await prisma.participation.create({
    data: { eventId: event.id, userId: organizerId, isOrganizer: true },
  });
  for (const userId of participantIds) {
    await prisma.participation.create({
      data: { eventId: event.id, userId, isOrganizer: false },
    });
  }

  console.log(`🎉 作成完了: lunchEvent id=${event.id}（参加者 ${participantIds.length + 1} 名）`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
