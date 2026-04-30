import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/users - Get all users (admin only sees all, members see limited)
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = session.user.role;

  if (userRole === 'admin') {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  } else {
    // Members see only names and grades (for display purposes)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(users);
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, grade, email, role, password } = body;

  const hashedPassword = await bcrypt.hash(password || 'chorei2026', 10);

  const user = await prisma.user.create({
    data: {
      name,
      grade,
      email,
      role: role || 'member',
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      grade: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}

// PUT /api/users - Update a user (admin only)
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, password, ...data } = body;

  const updateData: Record<string, unknown> = { ...data };
  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      grade: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user);
}

// DELETE /api/users - Delete a user (admin only)
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'User ID is required' },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
