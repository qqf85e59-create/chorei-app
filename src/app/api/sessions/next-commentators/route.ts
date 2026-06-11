import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { getTodayStr } from '@/lib/constants';

// GET /api/sessions/next-commentators
// Returns the next scheduled session (future, status=scheduled) with its commentators,
// plus a "changed" flag indicating whether the set changed since the user last viewed it.
//
// Read-only: commentators are finalised by the daily 07:00 JST cron
// (/api/cron/daily-finalize), not lazily on read. Until then the UI shows 「未確定」.
export async function GET() {
  try {
    const session = await requireUser();

    // アプリ上の「今日」(JST 7:00 切り替え) の 0:00 UTC。
    // セッション date は UTC 0:00 で保存されているため、これと比較する
    const todayStart = new Date(`${getTodayStr()}T00:00:00.000Z`);

    // Find the next upcoming session (global view - just the next one)
    const next = await prisma.session.findFirst({
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
  } catch (err) {
    console.error('[GET /api/sessions/next-commentators]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
