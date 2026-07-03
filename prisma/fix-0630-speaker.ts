/**
 * fix-0630-speaker.ts — 1回限り: 6/30(id=222) の発話者を実績どおり門田へ修正
 * 実際に登壇したのは門田 美由紀。heal が過去回を氏家へ書き換えていたため戻す。
 * 冪等: 既に門田なら何もしない。
 *   npx tsx prisma/fix-0630-speaker.ts --dry-run
 *   npx tsx prisma/fix-0630-speaker.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const KADOTA = 'cmojdwqqc00047osc1w6o6k7a'; // 門田 美由紀

async function main() {
  const s = await prisma.session.findFirst({
    where: { date: { gte: new Date('2026-06-30T00:00:00Z'), lt: new Date('2026-07-01T00:00:00Z') } },
    include: { speaker: { select: { name: true } } },
  });
  if (!s) throw new Error('6/30 のセッションが見つかりません');
  const kadota = await prisma.user.findUnique({ where: { id: KADOTA }, select: { name: true } });
  if (!kadota) throw new Error('門田さんのユーザーが見つかりません');

  console.log(`対象: id=${s.id} 現在の発話者=${s.speaker?.name ?? '未定'} → ${kadota.name}`);
  if (s.speakerId === KADOTA) { console.log('✅ 既に門田。変更なし。'); return; }
  if (DRY) { console.log('DRY-RUN: 変更しません。'); return; }

  await prisma.session.update({ where: { id: s.id }, data: { speakerId: KADOTA } });
  console.log('🎉 6/30 の発話者を門田 美由紀 に修正しました。');
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error('❌', e instanceof Error ? e.message : e); return prisma.$disconnect().finally(() => process.exit(1)); });
