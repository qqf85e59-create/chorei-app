/**
 * tue-fri-only.ts — 1回限り: 今後の開催日を「火・金のみ（祝日・お盆・年末年始を除く）」にする。
 *
 * やること（--dry-run 対応・再実行しても結果が変わらない）:
 *   (1) お盆（8/13〜8/16）・年末年始（12/29〜1/3）を Holiday に登録（朝礼なしの日として扱う）。
 *   (2) 本日より後の予定セッションのうち「火・金以外」または「祝日/お盆/年末年始」に当たる回を削除
 *       （まだ実施していない未来回のみ。関連する出席・欠席申請・閲覧・通知レコードも削除）。
 *   (3) 残った回へ、元の発話者の並び順をそのまま前詰めで割り当て直す
 *       （順序を保つので「なか4回」は崩れない。末尾で溢れた分は 2027/9/30 の枠外として落ちる）。
 *   (4) healFutureSpeakers() で念のため検証・補充。
 *
 *   npx tsx prisma/tue-fri-only.ts --dry-run
 *   npx tsx prisma/tue-fri-only.ts
 */
import { PrismaClient } from '@prisma/client';
import { SESSION_DAYS, getTodayStr } from '../src/lib/constants';
import { healFutureSpeakers } from '../src/lib/rotation';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

/** 休暇期間（Holiday へ1日ずつ登録）。 */
const BREAKS: { from: string; to: string; name: string }[] = [
  { from: '2026-12-29', to: '2027-01-03', name: '年末年始休暇' },
  { from: '2027-08-13', to: '2027-08-16', name: '夏季休暇（お盆）' },
];

function breakDays(): { date: string; name: string }[] {
  const out: { date: string; name: string }[] = [];
  for (const b of BREAKS) {
    for (const d = utc(b.from); d <= utc(b.to); d.setUTCDate(d.getUTCDate() + 1)) {
      out.push({ date: ymd(d), name: b.name });
    }
  }
  return out;
}

async function main() {
  const today = getTodayStr();
  console.log(`📅 開催日を火・金のみへ ${DRY ? '(DRY-RUN: 変更しません)' : '(本反映)'} / 本日=${today}\n`);

  const breaks = breakDays();
  const holidays = await prisma.holiday.findMany({ where: { isActive: true }, select: { date: true } });
  const off = new Set([...holidays.map((h) => ymd(h.date)), ...breaks.map((b) => b.date)]);

  const future = await prisma.session.findMany({
    where: { date: { gt: utc(today) }, status: 'scheduled' },
    orderBy: { date: 'asc' },
    include: {
      speaker: { select: { name: true } },
      absenceRequests: { select: { user: { select: { name: true } } } },
    },
  });

  const isOpen = (d: Date) =>
    (SESSION_DAYS as readonly number[]).includes(d.getUTCDay()) && !off.has(ymd(d));
  const keep = future.filter((s) => isOpen(s.date));
  const drop = future.filter((s) => !isOpen(s.date));

  // 元の発話者の並び（空欄は除く）を残す回へ前詰め。
  const queue = future.map((s) => s.speakerId).filter((id): id is string => id !== null);
  const names = new Map(future.filter((s) => s.speakerId).map((s) => [s.speakerId!, s.speaker!.name]));

  console.log(`対象: 未来の予定 ${future.length} 件 → 残す ${keep.length} 件 / 削除 ${drop.length} 件`);
  const dropReasons = { thu: 0, off: 0 };
  for (const s of drop) (off.has(ymd(s.date)) ? dropReasons.off++ : dropReasons.thu++);
  console.log(`   削除内訳: 火・金以外 ${dropReasons.thu} 件 / 祝日・休暇 ${dropReasons.off} 件`);
  const withAbsence = drop.filter((s) => s.absenceRequests.length > 0);
  for (const s of withAbsence) {
    console.log(`   ⚠ ${ymd(s.date)} に欠席申請あり: ${s.absenceRequests.map((a) => a.user.name).join('、')}（回ごと削除）`);
  }
  console.log('\n先頭10回（変更後）:');
  for (let i = 0; i < Math.min(10, keep.length); i++) {
    const s = keep[i];
    console.log(`   ${ymd(s.date)}(${DOW[s.date.getUTCDay()]}) ${s.speaker?.name ?? '(空)'} → ${names.get(queue[i]) ?? '(空)'}`);
  }
  console.log(`最終回: ${ymd(keep[keep.length - 1].date)}`);

  if (DRY) {
    console.log('\n✅ DRY-RUN 完了（DBは未変更）。');
    return;
  }

  /* ============ 本反映 ============ */
  for (const b of breaks) {
    await prisma.holiday.upsert({
      where: { date: utc(b.date) },
      update: { isActive: true },
      create: { date: utc(b.date), name: b.name, isActive: true },
    });
  }

  const dropIds = drop.map((s) => s.id);
  if (dropIds.length > 0) {
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { sessionId: { in: dropIds } } }),
      prisma.absenceRequest.deleteMany({ where: { sessionId: { in: dropIds } } }),
      prisma.commentatorView.deleteMany({ where: { sessionId: { in: dropIds } } }),
      prisma.notification.deleteMany({ where: { sessionId: { in: dropIds } } }),
      prisma.session.deleteMany({ where: { id: { in: dropIds } } }),
    ]);
  }
  console.log(`   ✔ ${dropIds.length} 件を削除`);

  let changed = 0;
  for (let i = 0; i < keep.length; i++) {
    const next = queue[i] ?? null;
    if (keep[i].speakerId !== next) {
      await prisma.session.update({ where: { id: keep[i].id }, data: { speakerId: next } });
      changed++;
    }
  }
  console.log(`   ✔ 発話者を前詰め: ${changed} 件更新`);

  const heal = await healFutureSpeakers();
  console.log(`   🔧 heal: filled=${heal.filled} reassigned=${heal.reassigned}`);
  console.log('\n🎉 完了。');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.stack : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
