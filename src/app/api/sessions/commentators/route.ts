import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { pickCommentators } from '@/lib/absence-logic';

// [12] Phase 1 sessions do not have the commentator concept
export async function POST(request: Request) {
  const session = await requireAdmin();

  const body = await request.json();
  const { sessionId, count = 2 } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    // 1. 対象セッションを取得（メイン発話者を知るため）+ Phase 情報
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { phase: { select: { phaseNumber: true } } },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // [12] Phase1 では応答者の概念がないため 400 エラー
    if (targetSession.phase.phaseNumber === 1) {
      return NextResponse.json(
        { error: 'Phase1セッションには応答者の概念がありません' },
        { status: 400 }
      );
    }

    // 2. 応答者を抽選する。
    //    発話者・欠席（申請/absent/left_early/unspoken）・直前回の応答者を除き、
    //    担当回数の少ない人からランダムに選ぶ（等級・職種は一切参照しない）。
    //    旧実装は sort(() => 0.5 - Math.random()) による偏ったシャッフル＋等級順の
    //    事前割当が残っており、特定メンバーに応答者が集中していた。
    const selected = await pickCommentators(targetSession, count, prisma);

    if (selected.length === 0) {
      return NextResponse.json({ error: 'No available candidates' }, { status: 400 });
    }

    // 3. DBを更新 (該当セッションとユーザーを紐付け)
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        commentators: {
          // すでに設定されているものを上書き（リセット）して紐付け
          set: selected.map(u => ({ id: u.id }))
        },
        commentatorsUpdatedAt: new Date(),
      },
      include: {
        commentators: { select: { id: true, name: true, grade: true } }
      }
    });

    return NextResponse.json(updatedSession.commentators);
  } catch (error) {
    console.error('Failed to generate commentators:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
