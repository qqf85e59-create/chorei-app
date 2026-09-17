/**
 * revert-to-phase1-from-0918.ts — 1回限り: 9/18 以降を「フェーズ1の回し方・テーマなし」に戻す。
 *
 * 前提: schema.prisma で Session.topicId を任意(Int?)にし、`npx prisma db push` 済みであること。
 *
 * やること（--dry-run 対応・再実行しても結果が変わらない）:
 *   (1) 2027年1〜9月の祝日を登録（開催日の算出用）。
 *   (2) フェーズ期間: Phase2(中間接続期) は 9/17 で終了、Phase1(個人理解期) を 2027-09-30 まで延長。
 *       Phase3(議論期) は予定ごと削除（セッション0件のフェーズのみ削除）。
 *   (3) 9/18 以降の予定セッション: Phase1 へ付け替え、テーマを外す(topicId=null)、
 *       応答者を外す。週番号/巡目は Phase1 基準で振り直す。時間枠(9:00〜9:15)と発話者はそのまま。
 *   (4) 既存の最終回の翌開催日〜2027-09-30 の火・木・金（祝日除く）にセッションを追加
 *       （発話者は空欄で作成し heal が均等に割当。出席レコードは全員present）。
 *   (5) どのセッションからも参照されなくなったテーマを削除（過去回のテーマは履歴として残す）。
 *   (6) healFutureSpeakers() で発話者を補充。
 *
 *   npx tsx prisma/revert-to-phase1-from-0918.ts --dry-run
 *   npx tsx prisma/revert-to-phase1-from-0918.ts
 */
import { PrismaClient } from '@prisma/client';
import { SESSION_DAYS } from '../src/lib/constants';
import { getWeekNumber, healFutureSpeakers } from '../src/lib/rotation';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const FROM = '2026-09-18';
const PHASE2_END = '2026-09-17';
const GEN_END = '2027-09-30';
const START_TIME = '09:00';
const END_TIME = '09:15';

const HOLIDAYS_2027 = [
  { date: '2027-01-01', name: '元日' },
  { date: '2027-01-11', name: '成人の日' },
  { date: '2027-02-11', name: '建国記念の日' },
  { date: '2027-02-23', name: '天皇誕生日' },
  { date: '2027-03-21', name: '春分の日' },
  { date: '2027-03-22', name: '振替休日' },
  { date: '2027-04-29', name: '昭和の日' },
  { date: '2027-05-03', name: '憲法記念日' },
  { date: '2027-05-04', name: 'みどりの日' },
  { date: '2027-05-05', name: 'こどもの日' },
  { date: '2027-07-19', name: '海の日' },
  { date: '2027-08-11', name: '山の日' },
  { date: '2027-09-20', name: '敬老の日' },
  { date: '2027-09-23', name: '秋分の日' },
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

async function main() {
  console.log(`🔁 9/18以降をフェーズ1方式・テーマなしへ ${DRY ? '(DRY-RUN: 変更しません)' : '(本反映)'}\n`);

  const phase1 = await prisma.phase.findUnique({ where: { phaseNumber: 1 } });
  const phase2 = await prisma.phase.findUnique({ where: { phaseNumber: 2 } });
  const phase3 = await prisma.phase.findUnique({
    where: { phaseNumber: 3 },
    include: { _count: { select: { sessions: true, topics: true } } },
  });
  if (!phase1 || !phase2) throw new Error('Phase1/Phase2 が見つかりません');

  const members = await prisma.user.count({ where: { choreiStatus: 'active', deletedAt: null } });
  const lastP1Round = (
    await prisma.session.findFirst({
      where: { phaseId: phase1.id, date: { lt: utc(FROM) } },
      orderBy: { date: 'desc' },
      select: { roundNumber: true },
    })
  )?.roundNumber ?? 0;

  /* ── (1) 祝日 ── */
  console.log('── (1) 2027年の祝日 ──');
  for (const h of HOLIDAYS_2027) console.log(`   ${h.date}(${DOW[utc(h.date).getUTCDay()]}) ${h.name}`);
  const existingHol = await prisma.holiday.findMany({ where: { isActive: true }, select: { date: true } });
  const holidaySet = new Set([...existingHol.map((h) => ymd(h.date)), ...HOLIDAYS_2027.map((h) => h.date)]);

  /* ── (2) フェーズ ── */
  console.log('\n── (2) フェーズ期間 ──');
  console.log(`   Phase1 ${phase1.name}: ${ymd(phase1.startDate)}〜${ymd(phase1.endDate)} → 〜${GEN_END}（15分枠）`);
  console.log(`   Phase2 ${phase2.name}: ${ymd(phase2.startDate)}〜${ymd(phase2.endDate)} → 〜${PHASE2_END}`);
  if (phase3) {
    console.log(`   Phase3 ${phase3.name}: 削除（sessions=${phase3._count.sessions}, topics=${phase3._count.topics}）`);
    if (phase3._count.sessions > 0) throw new Error('Phase3 にセッションがあるため削除できません');
  }

  /* ── (3) 既存の未来セッション ── */
  const future = await prisma.session.findMany({
    where: { date: { gte: utc(FROM) }, status: 'scheduled' },
    orderBy: { date: 'asc' },
    include: { speaker: { select: { name: true } }, commentators: { select: { id: true } } },
  });
  console.log(`\n── (3) ${FROM} 以降の既存セッション ${future.length} 件 → Phase1・テーマなし・応答者なし ──`);

  /* ── (4) 追加セッション ── */
  const lastDate = future.length > 0 ? future[future.length - 1].date : utc(PHASE2_END);
  const newDates: Date[] = [];
  const cur = new Date(lastDate);
  for (;;) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (cur > utc(GEN_END)) break;
    if (!(SESSION_DAYS as readonly number[]).includes(cur.getUTCDay())) continue;
    if (holidaySet.has(ymd(cur))) continue;
    newDates.push(new Date(cur));
  }
  console.log(`\n── (4) 追加: ${newDates.length > 0 ? `${ymd(newDates[0])}〜${ymd(newDates[newDates.length - 1])}` : '-'} で ${newDates.length} 件 ──`);

  const round = (k: number) => lastP1Round + 1 + Math.floor(k / Math.max(1, members));
  console.log(`   巡目: ${round(0)}巡目〜${round(future.length + newDates.length - 1)}巡目（${members}名で1巡）`);

  if (DRY) {
    const shown = future.slice(0, 5);
    for (const s of shown) {
      console.log(`   例 ${ymd(s.date)}(${DOW[s.date.getUTCDay()]}) 発話=${s.speaker?.name ?? '(空)'} 週${getWeekNumber(s.date, phase1.startDate)}`);
    }
    console.log('\n✅ DRY-RUN 完了（DBは未変更）。');
    return;
  }

  /* ============ 本反映 ============ */
  for (const h of HOLIDAYS_2027) {
    await prisma.holiday.upsert({
      where: { date: utc(h.date) },
      update: { isActive: true },
      create: { date: utc(h.date), name: h.name, isActive: true },
    });
  }

  await prisma.phase.update({
    where: { id: phase1.id },
    data: {
      endDate: utc(GEN_END),
      sessionDurationMinutes: 15,
      description: phase1.description?.replace('発話者が主題について自由に話し', '発話者がテーマを設けず自由に話し'),
    },
  });
  await prisma.phase.update({ where: { id: phase2.id }, data: { endDate: utc(PHASE2_END) } });

  for (let k = 0; k < future.length; k++) {
    const s = future[k];
    await prisma.session.update({
      where: { id: s.id },
      data: {
        phaseId: phase1.id,
        topicId: null,
        weekNumber: getWeekNumber(s.date, phase1.startDate),
        roundNumber: round(k),
        commentators: { set: [] },
        commentatorsPreset: false,
        commentatorsUpdatedAt: null,
      },
    });
  }
  console.log(`   ✔ 既存 ${future.length} 件を付け替え`);

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  let created = 0;
  for (let k = 0; k < newDates.length; k++) {
    const date = newDates[k];
    const exists = await prisma.session.findFirst({
      where: { date: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    if (exists) continue;
    const s = await prisma.session.create({
      data: {
        date,
        phaseId: phase1.id,
        weekNumber: getWeekNumber(date, phase1.startDate),
        topicId: null,
        speakerId: null,
        startTime: START_TIME,
        endTime: END_TIME,
        status: 'scheduled',
        roundNumber: round(future.length + k),
      },
    });
    await prisma.attendance.createMany({
      data: allUsers.map((u) => ({ sessionId: s.id, userId: u.id, status: 'present' as const })),
      skipDuplicates: true,
    });
    created++;
  }
  console.log(`   ✔ 新規 ${created} 件を作成`);

  if (phase3) {
    await prisma.topic.deleteMany({ where: { phaseId: phase3.id } });
    await prisma.phase.delete({ where: { id: phase3.id } });
    console.log('   ✔ Phase3 を削除');
  }

  const orphan = await prisma.topic.deleteMany({ where: { sessions: { none: {} } } });
  console.log(`   ✔ 未使用テーマ ${orphan.count} 件を削除`);

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
