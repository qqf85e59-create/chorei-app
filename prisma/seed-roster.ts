const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const roster = [
  { employeeNumber: '4017', name: '氏家 浩則', kana: 'ウジイエ ヒロノリ', grade: '6', jobCode: 'mc', jobTitle: 'マネージングコンサルタント', email: 'ujiieh@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '3892', name: '篠原 俊伍', kana: 'シノハラ シュンゴ', grade: '4+', jobCode: 'mc', jobTitle: 'マネージングコンサルタント', email: 'shinohara@attax.co.jp', role: 'member', lunchRole: 'organizer' },
  { employeeNumber: '4048', name: '水谷 友哉', kana: 'ミズタニ ユウヤ', grade: '4', jobCode: 'c', jobTitle: 'コンサルタント', email: 'mizutaniyu@attax.co.jp', role: 'admin', lunchRole: 'organizer' },
  { employeeNumber: '4005', name: '門田 美由紀', kana: 'カドタ ミユキ', grade: '3+', jobCode: 'a', jobTitle: 'アナリスト', email: 'kadota@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '4109', name: '栗田 駿人', kana: 'クリタ ハヤト', grade: '3', jobCode: 'c', jobTitle: 'コンサルタント', email: 'kurita@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '4077', name: '笹原 蓮也', kana: 'ササハラ レンヤ', grade: '3', jobCode: 'c', jobTitle: 'コンサルタント', email: 'sasaharar@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '4168', name: '佐藤 翼', kana: 'サトウ ツバサ', grade: '3', jobCode: 'c', jobTitle: 'コンサルタント', email: 'satot@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '4128', name: '日高 怒保', kana: 'ヒダカ ユキホ', grade: '2', jobCode: 'c', jobTitle: 'コンサルタント', email: 'hidaka@attax.co.jp', role: 'member', lunchRole: 'participant' },
  { employeeNumber: '4171', name: '佐藤 駿', kana: 'サトウ シュン', grade: '2', jobCode: 'c', jobTitle: 'コンサルタント', email: 'satosh@attax.co.jp', role: 'member', lunchRole: 'participant' }
];

async function main() {
  console.log('Starting roster sync...');
  const initialPassword = await bcrypt.hash(process.env.INITIAL_PASSWORD || 'chorei2026', 10);
  
  const activeEmails = [];

  for (const u of roster) {
    activeEmails.push(u.email);
    console.log(`Upserting ${u.email}...`);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        employeeNumber: u.employeeNumber,
        name: u.name,
        kana: u.kana,
        grade: u.grade,
        jobCode: u.jobCode,
        jobTitle: u.jobTitle,
        role: u.role,
        lunchRole: u.lunchRole,
        choreiStatus: 'active',
        lunchStatus: 'active',
        deletedAt: null
      },
      create: {
        employeeNumber: u.employeeNumber,
        name: u.name,
        kana: u.kana,
        grade: u.grade,
        jobCode: u.jobCode,
        jobTitle: u.jobTitle,
        email: u.email,
        role: u.role,
        lunchRole: u.lunchRole,
        choreiStatus: 'active',
        lunchStatus: 'active',
        password: initialPassword
      }
    });
  }

  console.log('Soft-deleting remaining users...');
  const result = await prisma.user.updateMany({
    where: {
      email: { notIn: activeEmails },
      deletedAt: null
    },
    data: {
      deletedAt: new Date(),
      choreiStatus: 'inactive',
      lunchStatus: 'inactive'
    }
  });

  console.log(`Soft-deleted ${result.count} extra users.`);
  console.log('Roster sync complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
