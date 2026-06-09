import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';

// GET /api/attendance - Get attendance records
export async function GET(request: Request) {
  const session = await requireUser();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userId = searchParams.get('userId');
  const userRole = session.user.role;

  const where: Record<string, unknown> = {};

  if (sessionId) where.sessionId = parseInt(sessionId);

  // Members can only see their own attendance
  if (userRole !== 'admin') {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, grade: true } },
      session: {
        include: {
          topic: { select: { topicText: true } },
        },
      },
    },
    orderBy: { session: { date: 'desc' } },
  });

  return NextResponse.json(records);
}

// PUT /api/attendance - Update attendance
export async function PUT(request: Request) {
  const session = await requireAdmin();

  const body = await request.json();
  const { id, ...data } = body;

  const updated = await prisma.attendance.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
