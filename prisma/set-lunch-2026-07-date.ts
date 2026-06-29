/**
 * set-lunch-2026-07-date.ts — 1回限り: 2026年7月ランチ会(id=9)の日程を設定
 *
 *   - confirmedDate = 2026-07-21（UTC 0:00 = JST 7/21）
 *   - status は planning のまま（場所は未定のため）。
 *
 * 冪等: 既に同じ日付なら何もしない。
 *
 * 実行:
 *   npx tsx prisma/set-lunch-2026-07-date.ts --dry-run
 *   npx tsx prisma/set-lunch-2026-07-date.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

const TITLE = '2026年7月ランチ会';
const DATE = new Date('2026-07-21T00:00:00.000Z');

async function main() {
  console.log(`📅 日程設定 ${DRY_RUN ? '(DRY-RUN)' : '(本反映)'}\n`);

  const event = await prisma.lunchEvent.findFirst({
    where: { title: TITLE, status: { in: ['planning', 'scheduled'] } },
    orderBy: { id: 'desc' },
  });
  if (!event) throw new Error(`イベントが見つかりません: 「${TITLE}」`);

  console.log(`対象: id=${event.id} status=${event.status}`);
  console.log(`現在の日程: ${event.confirmedDate?.toISOString() ?? '未定'}`);
  console.log(`設定後の日程: ${DATE.toISOString()} (JST 2026/7/21)\n`);

  if (event.confirmedDate && event.confirmedDate.getTime() === DATE.getTime()) {
    console.log('✅ 既に同じ日程。変更なし。');
    return;
  }
  if (DRY_RUN) {
    console.log('✅ DRY-RUN 完了（DBは未変更）。');
    return;
  }

  await prisma.lunchEvent.update({
    where: { id: event.id },
    data: { confirmedDate: DATE },
  });
  console.log('🎉 日程を 2026/7/21 に設定しました。');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
