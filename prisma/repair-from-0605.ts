/**
 * repair-from-0605.ts  — 1回限りのスケジュール修復スクリプト
 *
 * 背景: 旧 cascadeSpeakerShift のバグで
 *   (a) 6/5 の発話者が空欄
 *   (b) Phase1 の「自動順送りによる追加枠」が 7/2・7/3・7/7 (Phase2 と同日) に生成
 * という不整合が発生した。これを修復する。
 *
 *   - 6/4 以前は一切変更しない（正常稼働中）。
 *   - 7/1 以降の Phase1 スピルオーバー枠を削除（Phase2 はクリーンに保つ）。
 *   - 6/5〜6/30 の Phase1 を、レビュー済みの確定割当（下表 ASSIGNMENTS）へ再構成。
 *
 * 実行:
 *   npx tsx prisma/repair-from-0605.ts --dry-run   # 変更内容の確認のみ
 *   npx tsx prisma/repair-from-0605.ts             # 本反映
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// レビュー済みの確定割当（日付=UTC midnight → 発話者氏名）。6/4 以前は対象外。
const ASSIGNMENTS: Record<string, string> = {
  '2026-06-05': '篠原 俊伍',
  '2026-06-09': '水谷 友哉',
  '2026-06-11': '栗田 駿人',
  '2026-06-12': '日髙 恕保',
  '2026-06-16': '佐藤 翼',
  '2026-06-18': '佐藤 駿',
  '2026-06-19': '氏家 浩則',
  '2026-06-23': '篠原 俊伍',
  '2026-06-25': '門田 美由紀',
  '2026-06-26': '水谷 友哉',
  '2026-06-30': '篠原 俊伍',
};

const ymd = (d: Date) => d.toISOString().split('T')[0];

async function main() {
  console.log(`🛠  スケジュール修復 ${DRY_RUN ? '(DRY-RUN: 変更しません)' : '(本反映)'}\n`);

  const users = await prisma.user.findMany();
  const nameToId = new Map(users.map((u) => [u.name, u.id]));
  const idToName = new Map(users.map((u) => [u.id, u.name]));

  for (const name of new Set(Object.values(ASSIGNMENTS))) {
    if (!nameToId.has(name)) throw new Error(`ユーザーが見つかりません: 「${name}」`);
  }

  const phase1 = await prisma.phase.findUnique({ where: { phaseNumber: 1 } });
  if (!phase1) throw new Error('Phase 1 が見つかりません');

  /* ── 1. 7/1 以降の Phase1 スピルオーバー枠を削除 ───────────────── */
  const spillover = await prisma.session.findMany({
    where: { phaseId: phase1.id, date: { gte: new Date('2026-07-01T00:00:00.000Z') } },
    orderBy: { date: 'asc' },
  });
  console.log(`── 削除対象（Phase1 / 7月以降の追加枠）: ${spillover.length}件 ──`);
  for (const s of spillover) {
    console.log(`   ✗ ${ymd(s.date)} spk=${s.speakerId ? idToName.get(s.speakerId) : '(空)'} note=${s.adminNote ?? ''}`);
  }
  if (!DRY_RUN) {
    const ids = spillover.map((s) => s.id);
    if (ids.length) {
      // FK 子レコードを先に削除
      await prisma.notification.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.commentatorView.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.absenceRequest.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.attendance.deleteMany({ where: { sessionId: { in: ids } } });
      await prisma.session.deleteMany({ where: { id: { in: ids } } });
    }
  }

  /* ── 2. 6/5〜6/30 の発話者を確定割当へ再構成 ───────────────────── */
  console.log(`\n── 再割当（Phase1 / 6/5〜6/30）──`);
  for (const [dateStr, speakerName] of Object.entries(ASSIGNMENTS)) {
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const sess = await prisma.session.findFirst({
      where: { phaseId: phase1.id, date: { gte: dayStart, lt: dayEnd } },
    });
    if (!sess) {
      console.log(`   ⚠ ${dateStr}: セッションが見つかりません（スキップ）`);
      continue;
    }

    const newId = nameToId.get(speakerName)!;
    const before = sess.speakerId ? idToName.get(sess.speakerId) : '(空)';
    const mark = sess.speakerId === newId ? '＝' : '→';
    console.log(`   ${dateStr}: ${before} ${mark} ${speakerName}`);

    if (!DRY_RUN && sess.speakerId !== newId) {
      await prisma.session.update({
        where: { id: sess.id },
        data: {
          speakerId: newId,
          adminNote: '欠席により繰り上げ再構成',
        },
      });
      await prisma.notification.create({
        data: {
          userId: newId,
          sessionId: sess.id,
          type: 'speaker_change',
          message: `${dayStart.getUTCMonth() + 1}月${dayStart.getUTCDate()}日 の発話担当になりました（スケジュール再構成）`,
        },
      });
    }
  }

  /* ── 3. 結果サマリー（Phase1 全体の登壇回数） ───────────────────── */
  console.log(`\n── ${DRY_RUN ? '反映後（予測）' : '反映後'} の Phase1 登壇回数 ──`);
  const all = await prisma.session.findMany({
    where: { phaseId: phase1.id },
    orderBy: { date: 'asc' },
  });
  // dry-run では割当をメモリ上で反映して数える
  const counts = new Map<string, number>();
  for (const s of all) {
    // 7/1 以降の Phase1 枠は削除対象なので集計から除外（dry-run でも実反映後の数を表示）。
    if (s.date >= new Date('2026-07-01T00:00:00.000Z')) continue;
    let spk = s.speakerId;
    if (DRY_RUN) {
      const a = ASSIGNMENTS[ymd(s.date)];
      if (a) spk = nameToId.get(a)!;
    }
    if (spk) counts.set(spk, (counts.get(spk) ?? 0) + 1);
  }
  for (const u of users) {
    console.log(`   ${u.name}: ${counts.get(u.id) ?? 0} 回`);
  }

  console.log(`\n${DRY_RUN ? '✅ DRY-RUN 完了（DBは未変更）。本反映は --dry-run なしで実行。' : '🎉 修復完了。'}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ エラー:', e);
    prisma.$disconnect();
    process.exit(1);
  });
