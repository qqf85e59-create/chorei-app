import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  reflowSpeakers,
  reselectCommentators,
  getUnavailableUserIds,
  enforceMinimumAttendance,
} from '@/lib/absence-logic';
import { healFutureSpeakers } from '@/lib/rotation';

// Always run at request time (never prerender/cache this handler).
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/daily-finalize
 *
 * Invoked by Vercel Cron every day at 07:00 JST (22:00 UTC) to FINALISE the
 * current day's session(s):
 *   - Reflect absences declared up to the cutoff (previous day 23:59 JST).
 *   - If the day's speaker is absent, pull successors forward (reflowSpeakers).
 *   - Phase 2/3: re-select respondents to drop absentees and lock them in
 *     (commentatorsPreset = true).
 *   - Auto-cancel sessions that fall below the minimum attendance.
 *
 * Idempotent: a second run on the same day makes no further changes when no new
 * absences have been declared.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
 * header automatically when CRON_SECRET is set as a project env var.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Today's date in JST as the UTC-midnight Date that sessions are stored at.
    const jstDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    const dayStart = new Date(`${jstDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const todays = await prisma.session.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, status: 'scheduled' },
      include: {
        phase: { select: { phaseNumber: true } },
        commentators: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
    });

    const results: Array<Record<string, unknown>> = [];

    // Neon serverless on Vercel はインタラクティブtrxを安定維持できず500になるため、
    // $transaction(async tx) を使わず prisma で逐次実行する（ヘルパは prisma を受け取れる）。
    for (const s of todays) {
      const r = {
        sessionId: s.id,
        phase: s.phase.phaseNumber,
        speakerReflowed: false,
        commentatorsFinalised: false,
        cancelled: false,
      };

      const unavailable = await getUnavailableUserIds(s.id, prisma);

      // 1) Speaker absent → reflow successors forward for the remaining phase.
      if (s.speakerId && unavailable.has(s.speakerId)) {
        await reflowSpeakers(s.phaseId, s.date, prisma);
        r.speakerReflowed = true;
      }

      // 2) Phase 2/3 → lock in respondents, dropping any absentees.
      if (s.phase.phaseNumber !== 1) {
        const hasUnavailableCommentator = s.commentators.some((c) => unavailable.has(c.id));
        if (!s.commentatorsPreset || hasUnavailableCommentator) {
          await reselectCommentators(s.id, prisma);
          await prisma.session.update({
            where: { id: s.id },
            data: { commentatorsPreset: true },
          });
          r.commentatorsFinalised = true;
        }
      }

      // 3) Enforce minimum attendance (may auto-cancel).
      const enforcement = await enforceMinimumAttendance(s.id, prisma);
      if (enforcement.cancelled) r.cancelled = true;

      results.push(r);
    }

    // 4) 未来の発話輪番を自動で整える：未定(null)を補充し、なか4回違反（直近に
    //    出た人との重複）も修復する。正しい割当は変更しない。
    const heal = await healFutureSpeakers(undefined, prisma);

    return NextResponse.json({
      ok: true,
      date: jstDateStr,
      finalised: results.length,
      speakerHeal: heal,
      results,
    });
  } catch (err) {
    console.error('[GET /api/cron/daily-finalize]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
