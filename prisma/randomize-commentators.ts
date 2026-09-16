/**
 * randomize-commentators.ts — 未来の応答者（コメンテーター）を完全ランダムに引き直す。
 *
 * 背景: 7月の一括生成時、Phase2 の応答者は「等級順の輪番」で仮設定されていた
 *       （extend-phase2-to-1231.ts / full-schedule.ts）。このため特定の人に
 *       応答者が偏っていた。等級は一切関係させず、毎回フラットな抽選に置き換える。
 *
 * 対象: 「本日(JST 7:00 区切り)より後」の予定セッションのうち Phase2 以降のもの。
 *       過去・当日は実績として一切触らない。棚卸し回・中止回も対象外。
 *
 * 抽選ルール（等級は不使用 / src/lib/absence-logic.ts の pickCommentators と同じ）:
 *   - 候補 = 朝礼参加対象(choreiStatus:'active')かつ未削除のメンバー
 *   - その回の発話者は除外
 *   - 欠席申請済み／欠席扱いの人は除外
 *   - 直前の回の応答者は除外（2回続けて同じ人にならないようにする。候補が尽きる場合のみ緩和）
 *   - 残った候補のうち「これまでの担当回数が最少の人」を選ぶ。同数はランダム。
 *     （過去の等級順輪番でついた偏りを、未来分で埋め戻すため）
 *
 * ※ 実行のたびに引き直されます（冪等ではありません）。
 *
 *   npx tsx prisma/randomize-commentators.ts --dry-run
 *   npx tsx prisma/randomize-commentators.ts
 */
import { PrismaClient } from '@prisma/client';
import { getTodayStr } from '../src/lib/constants';
import { getUnavailableUserIds, PHASE2_3_MIN_COMMENTATORS } from '../src/lib/absence-logic';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const isReview = (note: string | null) => !!note && /棚卸し|振り返り/.test(note);

/** 偏りのない Fisher–Yates シャッフル（入力は変更しない）。 */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const today = getTodayStr();
  console.log(`🎲 応答者の完全ランダム再抽選 ${DRY ? '(DRY-RUN: 変更しません)' : '(本反映)'} / 本日=${today}\n`);

  const members = await prisma.user.findMany({
    where: { choreiStatus: 'active', deletedAt: null },
    select: { id: true, name: true },
  });
  if (members.length === 0) throw new Error('現役メンバーがいません');

  // 直前回の応答者を知るため、全期間の非中止セッションを日付順に走査する。
  const sessions = await prisma.session.findMany({
    where: { status: { not: 'cancelled' } },
    orderBy: { date: 'asc' },
    include: {
      phase: { select: { phaseNumber: true } },
      speaker: { select: { name: true } },
      commentators: { select: { id: true, name: true } },
    },
  });

  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  for (const m of members) {
    before.set(m.id, 0);
    after.set(m.id, 0);
  }

  let prevCommentatorIds: string[] = [];
  let changed = 0;
  let targets = 0;

  for (const s of sessions) {
    for (const c of s.commentators) {
      if (before.has(c.id)) before.set(c.id, before.get(c.id)! + 1);
    }

    const isTarget =
      ymd(s.date) > today &&
      s.status === 'scheduled' &&
      s.phase.phaseNumber !== 1 &&
      !isReview(s.adminNote);

    if (!isTarget) {
      // 過去・当日・Phase1 はそのまま。直前回の窓だけ進める。
      for (const c of s.commentators) {
        if (after.has(c.id)) after.set(c.id, after.get(c.id)! + 1);
      }
      prevCommentatorIds = s.commentators.map((c) => c.id);
      continue;
    }

    targets++;
    const desired = Math.max(s.commentators.length, PHASE2_3_MIN_COMMENTATORS);
    const unavailable = await getUnavailableUserIds(s.id, prisma);

    // 発話者・欠席者を除外 → さらに直前回の応答者を避ける（尽きたら緩和）。
    const available = members.filter((m) => m.id !== s.speakerId && !unavailable.has(m.id));
    const prevSet = new Set(prevCommentatorIds);
    const preferred = available.filter((m) => !prevSet.has(m.id));
    const pool = preferred.length >= desired ? preferred : available;

    // 先にシャッフルしてから担当回数の昇順に並べる＝同数の中では一様ランダム。
    // 回数は「その回より前の実績＋ここまでに割り当てた未来分」で数える。
    const ranked = shuffle(pool).sort((a, b) => (after.get(a.id) ?? 0) - (after.get(b.id) ?? 0));
    const selected = ranked.slice(0, Math.min(desired, ranked.length));

    const beforeNames = s.commentators.map((c) => c.name).join('、') || '(なし)';
    const afterNames = selected.map((u) => u.name).join('、') || '(なし)';
    const mark = beforeNames === afterNames ? '=' : '~';
    console.log(
      `   ${mark} ${ymd(s.date)}(${DOW[s.date.getUTCDay()]}) id=${s.id} 発話=${s.speaker?.name ?? '(空)'} 応答: ${beforeNames} → ${afterNames}`
    );

    if (!DRY && beforeNames !== afterNames) {
      await prisma.session.update({
        where: { id: s.id },
        data: {
          commentators: { set: selected.map((u) => ({ id: u.id })) },
          commentatorsUpdatedAt: new Date(),
        },
      });
    }
    if (beforeNames !== afterNames) changed++;

    for (const u of selected) after.set(u.id, (after.get(u.id) ?? 0) + 1);
    prevCommentatorIds = selected.map((u) => u.id);
  }

  console.log(`\n対象 ${targets} 件 / 変更 ${changed} 件`);
  console.log('\n--- 応答者 回数（全期間: 再抽選前 → 再抽選後）---');
  for (const m of members) {
    console.log(`   ${nameOf.get(m.id)}: ${before.get(m.id)} → ${after.get(m.id)}`);
  }

  console.log(DRY ? '\n✅ DRY-RUN 完了（DBは未変更）。' : '\n🎉 完了。');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.stack : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
