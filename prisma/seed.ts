import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.absenceRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.user.deleteMany();

  // Hash password
  const defaultPassword = await bcrypt.hash('chorei2026', 10);

  // Create users (8 members)
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: '鈴木 太郎',
        grade: 'E5',
        email: 'suzuki@example.com',
        password: defaultPassword,
        role: 'admin',
      },
    }),
    prisma.user.create({
      data: {
        name: '佐藤 花子',
        grade: 'E4p',
        email: 'sato@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '田中 一郎',
        grade: 'E4',
        email: 'tanaka@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '伊藤 美咲',
        grade: 'E3a',
        email: 'ito@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '渡辺 健太',
        grade: 'E3b',
        email: 'watanabe@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '高橋 由美',
        grade: 'E3c',
        email: 'takahashi@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '山本 翔太',
        grade: 'E2a',
        email: 'yamamoto@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
    prisma.user.create({
      data: {
        name: '中村 あゆみ',
        grade: 'E2b',
        email: 'nakamura@example.com',
        password: defaultPassword,
        role: 'member',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create phases
  const phase1 = await prisma.phase.create({
    data: {
      phaseNumber: 1,
      name: '個人理解期',
      startDate: new Date('2026-05-07'),
      endDate: new Date('2026-06-30'),
      sessionDurationMinutes: 10,
      description:
        '仙台事務所メンバー同士の「関係性の質」を高めるための第一段階。個人の背景や関心事を共有し、お互いをよく知ることを目的とする。発話者が主題について自由に話し、聴取者は「関心を持った一点」を述べる形式。',
    },
  });

  const phase2 = await prisma.phase.create({
    data: {
      phaseNumber: 2,
      name: '中間接続期',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
      sessionDurationMinutes: 15,
      description:
        '第一フェーズで築いた個人理解を基盤に、メンバー間の接続を深める段階。発話者と応答者のペアリングを導入し、双方向のコミュニケーションを促進する。',
    },
  });

  await prisma.phase.create({
    data: {
      phaseNumber: 3,
      name: '議論期',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-12-31'),
      sessionDurationMinutes: 20,
      description:
        '関係性の質が十分に高まった段階で、業務に関連する議論を行う。率直な意見交換ができる関係性を活かし、建設的な対話を実現する。',
    },
  });

  console.log('✅ Created 3 phases');

  // Create topics for Phase 1 (8 weeks)
  const topicTexts = [
    '最近気になっている景色や場所',
    '休日に時間を使っている対象',
    '最近ちょっといいなと思ったもの',
    '子どもの頃に夢中だったこと',
    '最近小さく困っていること',
    '自分がよく行く店',
    '最近考えている問い（業務外）',
    '最後に読んだ本・観た作品・聴いた音楽',
  ];

  const topics = await Promise.all(
    topicTexts.map((text, index) =>
      prisma.topic.create({
        data: {
          phaseId: phase1.id,
          weekNumber: index + 1,
          topicText: text,
        },
      })
    )
  );

  console.log(`✅ Created ${topics.length} topics`);

  // Create holidays for 2026 (Japanese public holidays)
  const holidays = [
    { date: new Date('2026-01-01'), name: '元日' },
    { date: new Date('2026-01-12'), name: '成人の日' },
    { date: new Date('2026-02-11'), name: '建国記念の日' },
    { date: new Date('2026-02-23'), name: '天皇誕生日' },
    { date: new Date('2026-03-20'), name: '春分の日' },
    { date: new Date('2026-04-29'), name: '昭和の日' },
    { date: new Date('2026-05-03'), name: '憲法記念日' },
    { date: new Date('2026-05-04'), name: 'みどりの日' },
    { date: new Date('2026-05-05'), name: 'こどもの日' },
    { date: new Date('2026-05-06'), name: '振替休日' },
    { date: new Date('2026-07-20'), name: '海の日' },
    { date: new Date('2026-08-11'), name: '山の日' },
    { date: new Date('2026-09-21'), name: '敬老の日' },
    { date: new Date('2026-09-22'), name: '国民の休日' },
    { date: new Date('2026-09-23'), name: '秋分の日' },
    { date: new Date('2026-10-12'), name: 'スポーツの日' },
    { date: new Date('2026-11-03'), name: '文化の日' },
    { date: new Date('2026-11-23'), name: '勤労感謝の日' },
  ];

  await Promise.all(
    holidays.map((h) =>
      prisma.holiday.create({
        data: h,
      })
    )
  );

  console.log(`✅ Created ${holidays.length} holidays`);

  // Generate Phase 1, Round 1 sessions
  // Sort by grade: E2a, E2b, E3a, E3b, E3c, E4, E4p, E5 (lower to upper)
  const gradeOrder = ['E2a', 'E2b', 'E3a', 'E3b', 'E3c', 'E4', 'E4p', 'E5'];
  const sortedUsers = [...users].sort(
    (a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade)
  );

  // Generate session dates (Tue, Thu, Fri) starting from 2026-05-07
  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split('T')[0])
  );

  function getSessionDates(
    startDate: Date,
    count: number,
    holidaySet: Set<string>
  ): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    const targetDays = [2, 4, 5]; // Tue=2, Thu=4, Fri=5

    while (dates.length < count) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      if (targetDays.includes(dayOfWeek) && !holidaySet.has(dateStr)) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // 8 sessions for round 1 + 1 review session = 9 total
  const sessionDates = getSessionDates(new Date('2026-05-07'), 9, holidayDates);

  // Assign topics based on week number
  function getWeekNumber(date: Date, startDate: Date): number {
    const msPerDay = 86400000;
    const daysDiff = Math.floor(
      (date.getTime() - startDate.getTime()) / msPerDay
    );
    return Math.floor(daysDiff / 7) + 1;
  }

  for (let i = 0; i < sessionDates.length; i++) {
    const date = sessionDates[i];
    const weekNum = getWeekNumber(date, new Date('2026-05-07'));

    if (i < 8) {
      // Regular sessions with speakers
      const topicIndex = Math.min(weekNum - 1, topics.length - 1);
      await prisma.session.create({
        data: {
          date: date,
          phaseId: phase1.id,
          weekNumber: weekNum,
          topicId: topics[topicIndex].id,
          speakerId: sortedUsers[i].id,
          startTime: '09:00',
          endTime: '09:10',
          status: 'scheduled',
          roundNumber: 1,
        },
      });
    } else {
      // 9th session: review (運営内棚卸し)
      await prisma.session.create({
        data: {
          date: date,
          phaseId: phase1.id,
          weekNumber: weekNum,
          topicId: topics[0].id, // placeholder topic
          speakerId: users[0].id, // admin as placeholder
          startTime: '09:00',
          endTime: '09:10',
          status: 'scheduled',
          roundNumber: 1,
          adminNote: '運営内棚卸し（1巡目終了後の振り返り）',
        },
      });
    }
  }

  console.log(`✅ Created ${sessionDates.length} sessions for Phase 1 Round 1`);

  // Create default attendance records (all present) for future sessions
  for (let i = 0; i < Math.min(sessionDates.length, 8); i++) {
    const sessions = await prisma.session.findMany({
      where: { date: sessionDates[i] },
    });
    for (const session of sessions) {
      for (const user of users) {
        await prisma.attendance.create({
          data: {
            sessionId: session.id,
            userId: user.id,
            status: 'present',
          },
        });
      }
    }
  }

  console.log('✅ Created default attendance records');
  console.log('🎉 Seeding completed!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin: suzuki@example.com / chorei2026');
  console.log('   Members: [lastname]@example.com / chorei2026');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
