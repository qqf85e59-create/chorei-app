import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST /api/sessions/mark-viewed
// Body: { sessionId: number }
// Upserts a CommentatorView record (userId, sessionId) with current timestamp.
// Dismisses the "changed" diff highlight for this user/session.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sessionId } = body;
  if (typeof sessionId !== 'number') {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  const now = new Date();
  await prisma.commentatorView.upsert({
    where: { userId_sessionId: { userId: session.user.id, sessionId } },
    update: { seenAt: now },
    create: { userId: session.user.id, sessionId, seenAt: now },
  });

  return NextResponse.json({ ok: true, seenAt: now });
}
