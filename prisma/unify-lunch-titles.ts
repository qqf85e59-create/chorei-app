/**
 * unify-lunch-titles.ts — 既存ランチ会のタイトルを標準フォーマットへ統一
 *
 * 標準: `仙台Synergy Bites <YYYY> <英語月名>`（第1回踏襲）。
 * 月は confirmedDate を優先し、無ければ createdAt の月で判定する。
 * 既に標準形のものは変更しない（冪等）。
 *
 * 実行:
 *   npx tsx prisma/unify-lunch-titles.ts --dry-run
 *   npx tsx prisma/unify-lunch-titles.ts
 */
import { PrismaClient } from '@prisma/client';
import { lunchTitleForMonth } from '../src/lib/lunch-title';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`🍴 タイトル統一 ${DRY_RUN ? '(DRY-RUN)' : '(本反映)'}\n`);
  const events = await prisma.lunchEvent.findMany({ orderBy: { id: 'asc' } });

  for (const e of events) {
    const basis = e.confirmedDate ?? e.createdAt;
    const desired = lunchTitleForMonth(basis.getFullYear(), basis.getMonth());
    if (e.title === desired) {
      console.log(`  id=${e.id}: 「${e.title}」 ＝ 変更なし`);
      continue;
    }
    console.log(`  id=${e.id}: 「${e.title}」 → 「${desired}」`);
    if (!DRY_RUN) {
      await prisma.lunchEvent.update({ where: { id: e.id }, data: { title: desired } });
    }
  }
  console.log(`\n${DRY_RUN ? '✅ DRY-RUN 完了' : '🎉 統一完了'}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
