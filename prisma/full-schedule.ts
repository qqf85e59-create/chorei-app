/**
 * full-schedule.ts
 * フルスケジュール生成スクリプト
 * Phase 1 (2026-05-07 〜 2026-06-30) + Phase 2 (2026-07-01 〜 2026-09-30)
 *
 * 実行: npx tsx prisma/full-schedule.ts
 *
 * ※ ユーザー・フェーズ・祝日データは削除しない。
 *    セッション・出席・欠席申請・通知・トピックのみリセットして再生成。
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 等級の昇順（低い等級 = 先に発話）
const GRADE_ORDER = ['E2a', 'E2b', 'E3a', 'E3b', 'E3c', 'E4', 'E4p', 'E5'];

/**
 * 指定期間内の火・木・金のうち祝日でない日を列挙。
 * タイムゾーンに依存しないよう UTC メソッドで統一。
 * startStr / endStr は 'YYYY-MM-DD' 形式（new Date('YYYY-MM-DD') = UTC midnight）
 */
function getSessionDates(startStr: string, endStr: string, holidaySet: Set<string>): Date[] {
  const dates: Date[] = [];
  const cur = new Date(startStr);   // UTC midnight
  const end = new Date(endStr);     // UTC midnight

  while (cur <= end) {
    const dow = cur.getUTCDay();    // 0=日 2=火 4=木 5=金（UTC 基準）
    const ds  = cur.toISOString().split('T')[0];
    if ([2, 4, 5].includes(dow) && !holidaySet.has(ds)) {
      dates.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/** フェーズ開始日からの週番号を返す（1始まり） */
function weekNum(date: Date, phaseStart: Date): number {
  const diff = Math.floor((date.getTime() - phaseStart.getTime()) / 86_400_000);
  return Math.floor(diff / 7) + 1;
}

async function main() {
  console.log('📅 フルスケジュール生成を開始します...\n');

  /* ── 1. ユーザー取得 ─────────────────────────────── */
  const allUsers = await prisma.user.findMany();
  if (allUsers.length === 0) throw new Error('ユーザーが存在しません。先に seed を実行してください。');

  // 発話者: 門田を除いた仙台在籍者、等級昇順
  const speakers = [...allUsers]
    .filter(u => u.email !== 'kadota@attax.co.jp')
    .sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

  // レビューセッション担当: 最上位等級のメンバー（ソート済み speakers の末尾）
  const adminUser = speakers[speakers.length - 1];

  console.log(`👥 発話者 ${speakers.length} 名: ${speakers.map(u => u.name).join(' / ')}`);
  console.log(`🔑 管理者（レビュー担当）: ${adminUser.name}\n`);

  /* ── 2. 既存セッション関連データを削除 ──────────── */
  console.log('🗑  既存データをクリア中...');
  await prisma.notification.deleteMany();
  await prisma.commentatorView.deleteMany();
  await prisma.absenceRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.topic.deleteMany();
  console.log('   完了\n');

  /* ── 3. フェーズ取得 ─────────────────────────────── */
  const phase1 = await prisma.phase.findUnique({ where: { phaseNumber: 1 } });
  const phase2 = await prisma.phase.findUnique({ where: { phaseNumber: 2 } });
  if (!phase1 || !phase2) throw new Error('Phase 1 / Phase 2 が見つかりません。seed を先に実行してください。');

  /* ── 4. 祝日セット取得 ───────────────────────────── */
  const holidays = await prisma.holiday.findMany();
  const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

  /* ── 5. トピック作成 ─────────────────────────────── */

  // Phase 1 トピック（8テーマ）
  const p1TopicTexts = [
    '最近気になっている景色や場所',
    '休日に時間を使っている対象',
    '最近ちょっといいなと思ったもの',
    '子どもの頃に夢中だったこと',
    '最近小さく困っていること',
    '自分がよく行く店',
    '最近考えている問い（業務外）',
    '最後に読んだ本・観た作品・聴いた音楽',
  ];

  const p1Topics = await Promise.all(
    p1TopicTexts.map((text, i) =>
      prisma.topic.create({ data: { phaseId: phase1.id, weekNumber: i + 1, topicText: text } })
    )
  );
  console.log(`✅ Phase 1 トピック ${p1Topics.length} 件作成`);

  // Phase 2 トピック（10テーマ）
  const p2TopicTexts = [
    '最近の業務で印象に残った出来事',
    '仕事のやりがいを感じる瞬間',
    'チームで大切にしたいこと',
    '最近学んだこと・気づいたこと',
    '仙台での仕事の特徴・良さ',
    '仕事で壁にぶつかった経験と乗り越え方',
    '自分の強みと弱み',
    '今後やってみたいこと・チャレンジ',
    '職場環境で改善できると思うこと',
    '半年間を振り返って',
  ];

  const p2Topics = await Promise.all(
    p2TopicTexts.map((text, i) =>
      prisma.topic.create({ data: { phaseId: phase2.id, weekNumber: i + 1, topicText: text } })
    )
  );
  console.log(`✅ Phase 2 トピック ${p2Topics.length} 件作成\n`);

  /* ── 6. セッション生成 ───────────────────────────── */
  const createdSessionIds: number[] = [];

  // ── Phase 1: 2026-05-07 〜 2026-06-30 ──
  const P1_START_STR = '2026-05-07';
  const p1Start = new Date(P1_START_STR);
  const p1Dates = getSessionDates(P1_START_STR, '2026-06-30', holidaySet);

  // 8セッションで1ラウンド（発話者7名 + レビュー1回）
  const ROUND_SIZE = speakers.length + 1; // = 8
  let speakerIdx = 0;

  for (let i = 0; i < p1Dates.length; i++) {
    const date    = p1Dates[i];
    const wn      = weekNum(date, p1Start);
    const posInRound = (i % ROUND_SIZE) + 1;  // 1..8
    const isReview   = posInRound === ROUND_SIZE;
    const roundNo    = Math.floor(i / ROUND_SIZE) + 1;

    let speakerId: string;
    let topicId: number;

    if (isReview) {
      speakerId = adminUser.id;
      topicId   = p1Topics[0].id;
    } else {
      speakerId = speakers[speakerIdx % speakers.length].id;
      topicId   = p1Topics[Math.min(wn - 1, p1Topics.length - 1)].id;
      speakerIdx++;
    }

    const s = await prisma.session.create({
      data: {
        date,
        phaseId:    phase1.id,
        weekNumber: wn,
        topicId,
        speakerId,
        startTime:  '09:00',
        endTime:    '09:10',
        status:     'scheduled',
        roundNumber: roundNo,
        commentatorsPreset: false,
        adminNote: isReview ? `運営内棚卸し（第${roundNo}巡目振り返り）` : null,
      },
    });
    createdSessionIds.push(s.id);
  }
  console.log(`✅ Phase 1 セッション ${p1Dates.length} 件作成（${p1Dates.length / ROUND_SIZE} ラウンド）`);

  // ── Phase 2: 2026-07-01 〜 2026-09-30 ──
  const P2_START_STR = '2026-07-01';
  const p2Start = new Date(P2_START_STR);
  const p2Dates = getSessionDates(P2_START_STR, '2026-09-30', holidaySet);

  speakerIdx = 0;
  for (let i = 0; i < p2Dates.length; i++) {
    const date    = p2Dates[i];
    const wn      = weekNum(date, p2Start);
    const roundNo = Math.floor(i / speakers.length) + 1;

    const speakerId = speakers[speakerIdx % speakers.length].id;
    const topicId   = p2Topics[speakerIdx % p2Topics.length].id;
    speakerIdx++;

    const s = await prisma.session.create({
      data: {
        date,
        phaseId:    phase2.id,
        weekNumber: wn,
        topicId,
        speakerId,
        startTime:  '09:00',
        endTime:    '09:15',
        status:     'scheduled',
        roundNumber: roundNo,
        commentatorsPreset: false,
      },
    });
    createdSessionIds.push(s.id);
  }
  console.log(`✅ Phase 2 セッション ${p2Dates.length} 件作成`);

  /* ── 7. 出席レコード一括作成（全員 present） ─────── */
  console.log('\n📋 出席レコードを作成中...');
  for (const sessionId of createdSessionIds) {
    for (const user of allUsers) {
      await prisma.attendance.create({
        data: { sessionId, userId: user.id, status: 'present' },
      });
    }
  }
  console.log(`✅ 出席レコード ${createdSessionIds.length * allUsers.length} 件作成`);

  /* ── 完了サマリー ────────────────────────────────── */
  console.log('\n🎉 フルスケジュール生成が完了しました！');
  console.log(`   Phase 1: ${p1Dates.length} セッション（2026-05-07 〜 2026-06-30）`);
  console.log(`   Phase 2: ${p2Dates.length} セッション（2026-07-01 〜 2026-09-30）`);
  console.log(`   合計   : ${createdSessionIds.length} セッション`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ エラー:', e);
    prisma.$disconnect();
    process.exit(1);
  });
