import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import bcrypt from 'bcryptjs';

// GET /api/users - Get all users (admin only sees all, members see limited)
export async function GET() {
  try {
    const session = await requireUser();
    const userRole = session.user.role;

    if (userRole === 'admin') {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          grade: true,
          email: true,
          role: true,
          lunchStatus: true,
          choreiStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json(users);
    } else {
      // Members see only names and grades (for display purposes)
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          grade: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json(users);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: Request) {
  try {
    await requireAdmin();

  const body = await request.json();
  const { name, grade, email, role, password, lunchStatus, choreiStatus } = body;

  const hashedPassword = await bcrypt.hash(password || 'chorei2026', 10);

  const user = await prisma.user.create({
    data: {
      name,
      grade,
      email,
      role: role || 'member',
      lunchStatus: lunchStatus || 'active',
      choreiStatus: choreiStatus || 'active',
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      grade: true,
      email: true,
      role: true,
      lunchStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/users - Update a user (admin only)
export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, password, ...data } = body;

    const updateData: any = { ...data };
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (updateData.email === '') updateData.email = null;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        grade: true,
        email: true,
        role: true,
        lunchStatus: true,
        choreiStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/users - Delete a user (admin only)
export async function DELETE(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        choreiStatus: 'inactive',
        lunchStatus: 'inactive',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
