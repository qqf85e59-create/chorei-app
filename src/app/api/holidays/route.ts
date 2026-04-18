import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/holidays - Get holidays
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');

  const where: Record<string, unknown> = {};

  if (year) {
    where.date = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return NextResponse.json(holidays);
}

// PUT /api/holidays - Toggle holiday active status (admin only)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, isActive } = body;

  const holiday = await prisma.holiday.update({
    where: { id },
    data: { isActive },
  });

  return NextResponse.json(holiday);
}
