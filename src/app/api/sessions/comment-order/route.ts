import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { drawCommentOrder, getCommentOrder } from '@/lib/comment-order';

/**
 * GET /api/sessions/comment-order?sessionId=N
 *
 * Phase 1 のコメント順を返す。
 * - 抽選済み（当日7時の Cron または管理者の抽選）なら、その並びを返す
 * - 未抽選ならセッションIDをシードにした仮の並び（誰が見ても同じ）を返し、drawn=false を付ける
 * - 欠席・聴講のみ の人は commentPosition = null（コメントしない）
 * - 途中退出は commentPosition あり（参加中にコメント）
 * 抽選ロジックは src/lib/comment-order.ts に集約している。
 */
export async function GET(request: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const sessionIdStr = searchParams.get('sessionId');
    if (!sessionIdStr) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 });
    }
    const sessionId = parseInt(sessionIdStr);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: '無効な sessionId です' }, { status: 400 });
    }

    const result = await getCommentOrder(sessionId);
    if (!result) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/sessions/comment-order  { sessionId }
 *
 * 管理者がコメント順を引き直す（完全ランダム・その時点の出席者のみ）。
 * 当日の急な欠席に合わせて朝礼中に引き直せるようにするための操作。
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const sessionId = Number(body?.sessionId);
    if (!Number.isInteger(sessionId)) {
      return NextResponse.json({ error: '有効な sessionId が必要です' }, { status: 400 });
    }

    const target = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { phase: { select: { phaseNumber: true } } },
    });
    if (!target) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }
    // Phase2 以降は応答者（コメンテーター）で管理するため、コメント順の抽選は行わない。
    if (target.phase.phaseNumber !== 1) {
      return NextResponse.json(
        { error: 'このフェーズにはコメント順の抽選がありません' },
        { status: 400 }
      );
    }

    await drawCommentOrder(sessionId);
    return NextResponse.json(await getCommentOrder(sessionId));
  } catch (err) {
    return handleApiError(err);
  }
}
