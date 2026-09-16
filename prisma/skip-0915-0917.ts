/**
 * skip-0915-0917.ts — 1回限り: 9/15(火)・9/17(木) の朝礼スキップに伴う輪番の後ろ倒し。
 *
 * やること（冪等・--dry-run 対応）:
 *   (1) 9/15(火) と 9/17(木) を「中止(cancelled)」にし、発話者を空欄(null)にする。
 *   (2) 9/18(金) 以降の予定セッションの発話者を「2つ後ろ」へずらす。
 *       = 9/18 ← 9/15 の元発話者 / 9/24 ← 9/17 の元発話者 / 9/25 ← 9/18 の元発話者 …
 *       日付ごとの主題・週番号・round は動かさない（発話者の並びだけを送る）。
 *   (3) ずらしで 12/31 の枠から押し出される 2 名分のために、年明け最初の開催日
 *       （火・木・金、祝日除外。元日は祝日として登録する）にセッションを 2 回追加する。
 *       追加分は Phase2 として作成し、Phase2 の終了日と Phase3 の開始日を後ろ倒しする。
 *
 * 発話者の相対順序は保存されるため「なか4回」制約は破れず、heal は本割当を尊重する。
 * 応答者（コメンテーター）はこのスクリプトでは触らない
 * （randomize-commentators.ts で完全ランダムに引き直す）。
 *
 *   npx tsx prisma/skip-0915-0917.ts --dry-run
 *   npx tsx prisma/skip-0915-0917.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { SESSION_DAYS } from '../src/lib/constants';
import { getWeekNumber } from '../src/lib/rotation';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const SKIP_DATES = ['2026-09-15', '2026-09-17'] as const; // 中止にする回
const SHIFT_FROM = '2026-09-18'; // この日以降を後ろ倒し
/** 年明けの追加回で考慮する祝日（DB に無ければ登録する）。 */
const EXTRA_HOLIDAYS = [{ date: '2027-01-01', name: '元日' }] as const;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const isReview = (note: string | null) => !!note && /棚卸し|振り返り/.test(note);

async function main() {
  console.log(`📅 9/15・9/17 スキップ＋後ろ倒し ${DRY ? '(DRY-RUN: 変更しません)' : '(本反映)'}\n`);

  /* ── 対象セッションの取得 ───────────────────────── */
  const skipSessions = [];
  for (const d of SKIP_DATES) {
    const s = await prisma.session.findFirst({
      where: { date: { gte: utc(d), lt: new Date(utc(d).getTime() + 86400000) } },
      include: { speaker: { select: { name: true } } },
    });
    if (!s) throw new Error(`${d} のセッションが見つかりません`);
    skipSessions.push(s);
  }

  // 冪等ガード：両方とも中止済みなら適用済みとみなす。
  if (skipSessions.every((s) => s.status === 'cancelled')) {
    console.log('✅ 9/15・9/17 は既に中止済み。適用済みとみなして終了します。');
    return;
  }

  // 9/18 以降の予定セッション（棚卸し回は輪番外なので除外）。
  const future = (
    await prisma.session.findMany({
      where: { date: { gte: utc(SHIFT_FROM) }, status: 'scheduled' },
      orderBy: { date: 'asc' },
      include: { speaker: { select: { name: true } } },
    })
  ).filter((s) => !isReview(s.adminNote));
  if (future.length === 0) throw new Error('9/18 以降の予定セッションが見つかりません');

  const nameById = new Map<string, string>();
  for (const s of [...skipSessions, ...future]) {
    if (s.speakerId && s.speaker) nameById.set(s.speakerId, s.speaker.name);
  }
  const nameOf = (id: string | null) => (id ? nameById.get(id) ?? id : '(空欄)');

  /* ── 発話者キュー（元の並びをそのまま後ろへ送る） ── */
  const queue: (string | null)[] = [
    ...skipSessions.map((s) => s.speakerId),
    ...future.map((s) => s.speakerId),
  ];
  const overflow = queue.slice(future.length).filter((id): id is string => id !== null);

  /* ── 年明け追加回の日付を算出 ───────────────────── */
  const holidays = await prisma.holiday.findMany({ where: { isActive: true }, select: { date: true } });
  const holidaySet = new Set(holidays.map((h) => ymd(h.date)));
  for (const h of EXTRA_HOLIDAYS) holidaySet.add(h.date);

  const last = future[future.length - 1];
  const appendDates: Date[] = [];
  const cur = new Date(last.date);
  while (appendDates.length < overflow.length) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (!(SESSION_DAYS as readonly number[]).includes(cur.getUTCDay())) continue;
    if (holidaySet.has(ymd(cur))) continue;
    appendDates.push(new Date(cur));
  }

  /* ── 変更計画の表示 ─────────────────────────────── */
  console.log('── (1) スキップ ──');
  for (const s of skipSessions) {
    if (s.status === 'cancelled') {
      console.log(`   ✅ ${ymd(s.date)} (id=${s.id}) は既に中止済み`);
    } else {
      console.log(
        `   ✗ ${ymd(s.date)}(${DOW[s.date.getUTCDay()]}) (id=${s.id}) : ${nameOf(s.speakerId)} → 中止・発話者空欄`
      );
    }
  }

  console.log(`\n── (2) ${SHIFT_FROM} 以降の後ろ倒し（${future.length} 件）──`);
  for (let i = 0; i < future.length; i++) {
    const s = future[i];
    const mark = s.speakerId === queue[i] ? '=' : '~';
    console.log(
      `   ${mark} ${ymd(s.date)}(${DOW[s.date.getUTCDay()]}) id=${s.id} : ${nameOf(s.speakerId)} → ${nameOf(queue[i])}`
    );
  }

  console.log(`\n── (3) 押し出された ${overflow.length} 名の追加回 ──`);
  const phase2 = await prisma.phase.findUnique({ where: { id: last.phaseId } });
  const phase3 = await prisma.phase.findFirst({ where: { phaseNumber: 3 } });
  if (!phase2) throw new Error('Phase が見つかりません');
  for (let k = 0; k < appendDates.length; k++) {
    const d = appendDates[k];
    console.log(
      `   + ${ymd(d)}(${DOW[d.getUTCDay()]}) 発話=${nameOf(overflow[k])} phase=${phase2.id} 週${getWeekNumber(d, phase2.startDate)} r${last.roundNumber}`
    );
  }
  const newP2End = appendDates.length > 0 ? appendDates[appendDates.length - 1] : phase2.endDate;
  if (appendDates.length > 0) {
    console.log(`   Phase${phase2.phaseNumber} endDate: ${ymd(phase2.endDate)} → ${ymd(newP2End)}`);
    if (phase3 && phase3.startDate <= newP2End) {
      console.log(
        `   Phase3 startDate: ${ymd(phase3.startDate)} → ${ymd(new Date(newP2End.getTime() + 86400000))}`
      );
    }
  }

  if (DRY) {
    console.log('\n✅ DRY-RUN 完了（DBは未変更）。本反映は --dry-run なしで実行してください。');
    return;
  }

  /* ============ 本反映 ============ */
  // 祝日（元日）を登録。
  for (const h of EXTRA_HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { date: utc(h.date) },
      update: { isActive: true },
      create: { date: utc(h.date), name: h.name, isActive: true },
    });
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const s of skipSessions) {
    if (s.status !== 'cancelled') {
      ops.push(
        prisma.session.update({ where: { id: s.id }, data: { status: 'cancelled', speakerId: null } })
      );
    }
  }
  for (let i = 0; i < future.length; i++) {
    if (future[i].speakerId !== queue[i]) {
      ops.push(prisma.session.update({ where: { id: future[i].id }, data: { speakerId: queue[i] } }));
    }
  }
  await prisma.$transaction(ops);
  console.log(`\n🔁 ${ops.length} 件のセッションを更新しました。`);

  // 追加回（既存があれば作らない）。
  const topics = await prisma.topic.findMany({
    where: { phaseId: phase2.id },
    orderBy: { weekNumber: 'asc' },
    select: { id: true, weekNumber: true },
  });
  const topicIdForWeek = (wn: number) =>
    (topics.find((t) => t.weekNumber === wn) ?? topics[topics.length - 1]).id;
  const allUsers = await prisma.user.findMany({ select: { id: true } });

  for (let k = 0; k < appendDates.length; k++) {
    const date = appendDates[k];
    const exists = await prisma.session.findFirst({
      where: { date: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    if (exists) {
      console.log(`   = ${ymd(date)} は既に存在(id=${exists.id})。作成しません。`);
      continue;
    }
    const wn = getWeekNumber(date, phase2.startDate);
    const created = await prisma.session.create({
      data: {
        date,
        phaseId: phase2.id,
        weekNumber: wn,
        topicId: topicIdForWeek(wn),
        speakerId: overflow[k],
        startTime: last.startTime,
        endTime: last.endTime,
        status: 'scheduled',
        roundNumber: last.roundNumber,
      },
    });
    await prisma.attendance.createMany({
      data: allUsers.map((u) => ({ sessionId: created.id, userId: u.id, status: 'present' as const })),
      skipDuplicates: true,
    });
    console.log(`   + ${ymd(date)} を作成(id=${created.id}) 発話=${nameOf(overflow[k])}`);
  }

  // フェーズ期間の後ろ倒し。
  if (appendDates.length > 0) {
    if (phase2.endDate < newP2End) {
      await prisma.phase.update({ where: { id: phase2.id }, data: { endDate: newP2End } });
    }
    if (phase3 && phase3.startDate <= newP2End) {
      await prisma.phase.update({
        where: { id: phase3.id },
        data: { startDate: new Date(newP2End.getTime() + 86400000) },
      });
    }
  }

  console.log('\n🎉 完了。');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌', e instanceof Error ? e.stack : e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
