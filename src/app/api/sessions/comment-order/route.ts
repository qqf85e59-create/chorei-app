import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';

/**
 * GET /api/sessions/comment-order?sessionId=N
 *
 * Phase 1 のコメント順を返す。
 * - 発話者を除く全メンバーをセッションIDをシードにしたランダム順に並べる
 *   （同じセッションなら誰がいつ見ても同じ順序になる決定的シャッフル）
 * - 欠席・聴講のみ の人は commentPosition = null（コメントしない）
 * - 途中退出は commentPosition あり（参加中にコメント）
 * - 欠席申請 / 出席ステータス を両方チェックして最新の状態を反映
 */

// シード付き擬似乱数（mulberry32）。サーバー再起動やリクエスト間でも
// 同じシードからは必ず同じ乱数列が得られる
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export async function GET(request: Request) {
  try {
    const session = await requireUser();

    const { searchParams } = new URL(request.url);
    const sessionIdStr = searchParams.get('sessionId');
    if (!sessionIdStr) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 });
    }
    const sessionId = parseInt(sessionIdStr);
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: '無効な sessionId です' }, { status: 400 });
    }

    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        phase:          { select: { phaseNumber: true } },
        attendances:    { select: { userId: true, status: true } },
        absenceRequests:{ select: { userId: true, type: true } },
      },
    });
    if (!targetSession) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    // Phase 1 以外は空配列（Phase 2 は commentators で管理）
    if (targetSession.phase.phaseNumber !== 1) {
      return NextResponse.json({ commentOrder: [] });
    }

    // 朝礼参加対象ユーザーを等級昇順で取得
    const allUsers = await prisma.user.findMany({
      where: { choreiStatus: 'active', deletedAt: null },
      select: { id: true, name: true, grade: true },
    });

    // 欠席申請マップ（最新の type）
    const absenceMap = new Map<string, string>();
    for (const req of targetSession.absenceRequests) {
      absenceMap.set(req.userId, req.type);
    }

    // 出席ステータスマップ
    const attendanceMap = new Map<string, string>();
    for (const att of targetSession.attendances) {
      attendanceMap.set(att.userId, att.status);
    }

    // 発話者を除き、セッションIDをシードにランダムシャッフル
    // （DBの取得順に依存しないよう、シャッフル前の基準順を ID 昇順で固定）
    const commenters = allUsers
      .filter(u => u.id !== targetSession.speakerId)
      .sort((a, b) => a.id.localeCompare(b.id));

    const rand = mulberry32(sessionId);
    for (let i = commenters.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [commenters[i], commenters[j]] = [commenters[j], commenters[i]];
    }

    let position = 1;
    const commentOrder = commenters.map(u => {
      const absType  = absenceMap.get(u.id);
      const attStatus = attendanceMap.get(u.id);

      // 実効ステータスを決定（欠席申請 > 出席記録）
      let status: 'present' | 'absent' | 'unspoken' | 'leave_early';
      if (absType === 'absent' || attStatus === 'absent') {
        status = 'absent';
      } else if (absType === 'unspoken' || attStatus === 'unspoken') {
        status = 'unspoken'; // 聴講のみ（無言）= コメントしない
      } else if (absType === 'leave_early' || attStatus === 'left_early') {
        status = 'leave_early'; // 途中退出 = コメントあり
      } else {
        status = 'present';
      }

      // コメントする人（present / leave_early）にのみ順番を付与
      const active = status === 'present' || status === 'leave_early';
      const commentPosition = active ? position++ : null;

      return { ...u, status, commentPosition };
    });

    return NextResponse.json({ commentOrder });
  } catch (err) {
    console.error('[GET /api/sessions/comment-order]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
