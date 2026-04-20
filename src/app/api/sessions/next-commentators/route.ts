import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { reselectCommentators, PHASE2_3_MIN_COMMENTATORS } from '@/lib/absence-logic';

// GET /api/sessions/next-commentators
// Returns the next scheduled session (future, status=scheduled) with its commentators,
// plus a "changed" flag indicating whether the set changed since the user last viewed it.
// For Phase 2/3 sessions that haven't been preset, auto-generates commentators (暫定).
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Today at 00:00 - include today's session if not yet done
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Find the next upcoming session for the CURRENT session's user (global view - just the next one)
  let next = await prisma.session.findFirst({
    where: {
      date: { gte: todayStart },
      status: 'scheduled',
    },
    orderBy: { date: 'asc' },
    include: {
      phase: { select: { phaseNumber: true } },
      speaker: { select: { id: true, name: true, grade: true } },
      topic: { select: { topicText: true } },
      commentators: { select: { id: true, name: true, grade: true } },
    },
  });

  if (!next) {
    return NextResponse.json({ session: null });
  }

  // If Phase 2/3 and commentators are empty, auto-generate as tentative (暫定)
  if (
    next.phase.phaseNumber !== 1 &&
    next.commentators.length < PHASE2_3_MIN_COMMENTATORS &&
    next.speakerId
  ) {
    await reselectCommentators(next.id);
    await prisma.session.update({
      where: { id: next.id },
      data: { commentatorsPreset: true },
    });
    next = await prisma.session.findUnique({
      where: { id: next.id },
      include: {
        phase: { select: { phaseNumber: true } },
        speaker: { select: { id: true, name: true, grade: true } },
        topic: { select: { topicText: true } },
        commentators: { select: { id: true, name: true, grade: true } },
      },
    });
  }

  if (!next) {
    return NextResponse.json({ session: null });
  }

  // Determine diff flag vs user's last CommentatorView
  const view = await prisma.commentatorView.findUnique({
    where: { userId_sessionId: { userId: session.user.id, sessionId: next.id } },
  });

  const updatedAt = next.commentatorsUpdatedAt;
  const changed =
    updatedAt !== null &&
    (view === null || view.seenAt.getTime() < updatedAt.getTime());

  return NextResponse.json({
    session: {
      id: next.id,
      date: next.date,
      startTime: next.startTime,
      endTime: next.endTime,
      phaseNumber: next.phase.phaseNumber,
      speaker: next.speaker,
      topic: next.topic,
      commentators: next.commentators,
      commentatorsUpdatedAt: next.commentatorsUpdatedAt,
      commentatorsPreset: next.commentatorsPreset,
    },
    changed,
    lastSeenAt: view?.seenAt ?? null,
  });
}
