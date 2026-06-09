import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = 'https://teams.microsoft.com/meet/4994985303963?p=2rYMBuP8rBv9EtKEKD';
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!admin) { console.error('No admin user found'); return; }

  await prisma.config.upsert({
    where: { key: 'meeting_url' },
    update: { value: url, updatedBy: admin.id },
    create: { key: 'meeting_url', value: url, updatedBy: admin.id },
  });
  console.log('✅ meeting_url set:', url);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
