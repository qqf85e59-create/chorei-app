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

  // 発話者: 全メンバー等級昇順（門田含む）
  const speakers = [...allUsers]
    .sort((a, b) => {
      const ai = GRADE_ORDER.indexOf(a.grade);
      const bi = GRADE_ORDER.indexOf(b.grade);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  console.log(`👥 発話者 ${speakers.length} 名: ${speakers.map(u => u.name).join(' / ')}`);

  /* ── 2. 既存セッション関連データを削除 ──────────── */
  console.log('\n🗑  既存データをクリア中...');
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
  // 全メンバー8名 × 3ラウンド = 24セッション（レビュー枠なし）
  const P1_START_STR = '2026-05-07';
  const p1Start = new Date(P1_START_STR);
  const p1Dates = getSessionDates(P1_START_STR, '2026-06-30', holidaySet);
  const ROUND_SIZE = speakers.length; // = 8

  for (let i = 0; i < p1Dates.length; i++) {
    const date   = p1Dates[i];
    const wn     = weekNum(date, p1Start);
    const roundNo = Math.floor(i / ROUND_SIZE) + 1;
    const speaker = speakers[i % ROUND_SIZE];
    const topicId = p1Topics[Math.min(wn - 1, p1Topics.length - 1)].id;

    const s = await prisma.session.create({
      data: {
        date,
        phaseId:    phase1.id,
        weekNumber: wn,
        topicId,
        speakerId:  speaker.id,
        startTime:  '09:00',
        endTime:    '09:10',
        status:     'scheduled',
        roundNumber: roundNo,
        commentatorsPreset: false,
      },
    });
    createdSessionIds.push(s.id);
  }
  console.log(`✅ Phase 1 セッション ${p1Dates.length} 件作成（${p1Dates.length / ROUND_SIZE} ラウンド）`);

  // ── Phase 2: 2026-07-01 〜 2026-09-30 ──
  // 応答者（コメンテーター）= 発話者の次の人（等級順で1つ上）を事前設定
  const P2_START_STR = '2026-07-01';
  const p2Start = new Date(P2_START_STR);
  const p2Dates = getSessionDates(P2_START_STR, '2026-09-30', holidaySet);

  for (let i = 0; i < p2Dates.length; i++) {
    const date       = p2Dates[i];
    const wn         = weekNum(date, p2Start);
    const roundNo    = Math.floor(i / speakers.length) + 1;
    const speakerIdx  = i % speakers.length;
    const respondentIdx = (i + 1) % speakers.length; // 次の人が応答者
    const speaker    = speakers[speakerIdx];
    const respondent = speakers[respondentIdx];
    const topicId    = p2Topics[Math.min(wn - 1, p2Topics.length - 1)].id;

    const s = await prisma.session.create({
      data: {
        date,
        phaseId:    phase2.id,
        weekNumber: wn,
        topicId,
        speakerId:  speaker.id,
        startTime:  '09:00',
        endTime:    '09:15',
        status:     'scheduled',
        roundNumber: roundNo,
        // 応答者を事前設定（欠席時は absence-logic が再抽選）
        commentators:        { connect: { id: respondent.id } },
        commentatorsPreset:  true,
        commentatorsUpdatedAt: new Date(),
      },
    });
    createdSessionIds.push(s.id);
  }
  console.log(`✅ Phase 2 セッション ${p2Dates.length} 件作成（応答者事前設定済み）`);

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
  console.log('\n📋 Phase 1 発話順（1ラウンド）:');
  speakers.forEach((s, i) => console.log(`   ${i + 1}. ${s.name}（${s.grade}）`));
  console.log('\n📋 Phase 2 最初の8セッション（発話者 → 応答者）:');
  speakers.forEach((s, i) => {
    const respondent = speakers[(i + 1) % speakers.length];
    console.log(`   ${s.name} → 応答: ${respondent.name}`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ エラー:', e);
    prisma.$disconnect();
    process.exit(1);
  });
