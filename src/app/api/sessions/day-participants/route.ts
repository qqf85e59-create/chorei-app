import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-auth';

/**
 * GET /api/sessions/day-participants?sessionId=N
 *
 * その日の参加者（朝礼参加対象の現役メンバー全員）を、出欠ステータスと役割つきで返す。
 * どのフェーズでも「誰が参加するか」を一覧できるようにするための共通API。
 *   - speaker: 発話者（話者）
 *   - members[].role: 'commentator'（Phase2+ の応答者） / 'commenter'（その他）
 *   - order: Phase1=コメント順、Phase2+=応答者順（応答者のみ）、それ以外は null
 *   - status: present / leave_early / unspoken / absent（欠席申請と出席記録の両方を反映）
 */

// Phase1 のコメント順に使う決定的乱数（comment-order と同一アルゴリズム）
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Status = 'present' | 'absent' | 'unspoken' | 'leave_early';

export async function GET(request: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const sessionId = parseInt(searchParams.get('sessionId') ?? '');
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: '有効な sessionId が必要です' }, { status: 400 });
    }

    const s = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        phase: { select: { phaseNumber: true } },
        commentators: { select: { id: true } },
        attendances: { select: { userId: true, status: true } },
        absenceRequests: { select: { userId: true, type: true } },
      },
    });
    if (!s) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: { choreiStatus: 'active', deletedAt: null },
      select: { id: true, name: true, grade: true },
    });

    const absenceMap = new Map<string, string>();
    s.absenceRequests.forEach((r) => absenceMap.set(r.userId, r.type));
    const attMap = new Map<string, string>();
    s.attendances.forEach((a) => attMap.set(a.userId, a.status));

    const statusOf = (id: string): Status => {
      const ab = absenceMap.get(id);
      const at = attMap.get(id);
      if (ab === 'absent' || at === 'absent') return 'absent';
      if (ab === 'unspoken' || at === 'unspoken') return 'unspoken';
      if (ab === 'leave_early' || at === 'left_early') return 'leave_early';
      return 'present';
    };

    const phaseNumber = s.phase.phaseNumber;
    const commentatorOrder = new Map<string, number>();
    s.commentators.forEach((c, i) => commentatorOrder.set(c.id, i + 1));

    const speakerUser = users.find((u) => u.id === s.speakerId) ?? null;
    const speaker = speakerUser
      ? { ...speakerUser, status: statusOf(speakerUser.id) }
      : null;

    const others = users.filter((u) => u.id !== s.speakerId);

    // Phase1: コメント順（present / leave_early に連番）を決定的シャッフルで付与
    const posMap = new Map<string, number | null>();
    if (phaseNumber === 1) {
      const commenters = [...others].sort((a, b) => a.id.localeCompare(b.id));
      const rand = mulberry32(sessionId);
      for (let i = commenters.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [commenters[i], commenters[j]] = [commenters[j], commenters[i]];
      }
      let pos = 1;
      for (const u of commenters) {
        const st = statusOf(u.id);
        const active = st === 'present' || st === 'leave_early';
        posMap.set(u.id, active ? pos++ : null);
      }
    }

    const members = others.map((u) => {
      const status = statusOf(u.id);
      const isCommentator = phaseNumber >= 2 && commentatorOrder.has(u.id);
      const order =
        phaseNumber === 1
          ? posMap.get(u.id) ?? null
          : isCommentator
          ? commentatorOrder.get(u.id)!
          : null;
      return {
        ...u,
        status,
        role: isCommentator ? ('commentator' as const) : ('commenter' as const),
        order,
      };
    });

    // 出席者を上に、役割/順番があるものを先に。
    const rank: Record<Status, number> = { present: 0, leave_early: 0, unspoken: 1, absent: 2 };
    members.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      const ao = a.order ?? Infinity;
      const bo = b.order ?? Infinity;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, 'ja');
    });

    return NextResponse.json({ phaseNumber, speaker, members });
  } catch (err) {
    console.error('[GET /api/sessions/day-participants]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
