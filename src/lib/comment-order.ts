import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

type TxClient = Prisma.TransactionClient | PrismaClient;

export type CommentStatus = 'present' | 'absent' | 'unspoken' | 'leave_early';

export type CommentOrderEntry = {
  id: string;
  name: string;
  grade: string;
  status: CommentStatus;
  /** コメントする順番。欠席・聴講のみの人は null。 */
  commentPosition: number | null;
};

export type CommentOrderResult = {
  commentOrder: CommentOrderEntry[];
  /** 抽選済み（当日7時の Cron または管理者の抽選で確定）なら true。 */
  drawn: boolean;
  drawnAt: Date | null;
};

/**
 * 抽選前に表示する仮の並び。セッションIDをシードにするため、
 * 誰がいつ見ても同じ順序になる（確定前に人によって違う順番が見えるのを防ぐ）。
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 偏りのない Fisher–Yates シャッフル（入力は変更しない）。 */
function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 欠席申請と出席記録から、その回の実効ステータスを決める（欠席申請を優先）。
 * 途中退出は「参加中にコメントする」ため present と同じ扱いで番号を振る。
 */
function effectiveStatus(absenceType?: string, attendanceStatus?: string): CommentStatus {
  if (absenceType === 'absent' || attendanceStatus === 'absent') return 'absent';
  if (absenceType === 'unspoken' || attendanceStatus === 'unspoken') return 'unspoken';
  if (absenceType === 'leave_early' || attendanceStatus === 'left_early') return 'leave_early';
  return 'present';
}

/** コメントする人（番号が付く人）かどうか。 */
function commentsOnDay(status: CommentStatus): boolean {
  return status === 'present' || status === 'leave_early';
}

const sessionInclude = {
  phase: { select: { phaseNumber: true } },
  attendances: { select: { userId: true, status: true } },
  absenceRequests: { select: { userId: true, type: true } },
  commentOrder: { select: { userId: true, position: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.SessionInclude;

type SessionForOrder = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

async function loadSession(sessionId: number, tx: TxClient): Promise<SessionForOrder | null> {
  return tx.session.findUnique({ where: { id: sessionId }, include: sessionInclude });
}

/**
 * コメント順を抽選し直す（完全ランダム）。
 *
 *   - 対象 = 朝礼参加対象(choreiStatus:'active')かつ未削除のメンバー
 *   - その回の発話者は除く（話す側なのでコメント順には入らない）
 *   - 抽選時点で欠席・聴講のみの人は除く（＝出席者だけで引く）。途中退出は含める
 *   - 等級・職種は一切参照せず、Fisher–Yates で一様にシャッフルする
 *
 * 抽選後に欠席へ変わった人は、表示時に番号から外れる（引き直しは不要）。
 */
export async function drawCommentOrder(sessionId: number, tx: TxClient = prisma): Promise<number> {
  const s = await loadSession(sessionId, tx);
  if (!s) return 0;

  const members = await tx.user.findMany({
    where: {
      choreiStatus: 'active',
      deletedAt: null,
      ...(s.speakerId ? { id: { not: s.speakerId } } : {}),
    },
    select: { id: true },
  });

  const absenceMap = new Map(s.absenceRequests.map((r) => [r.userId, r.type as string]));
  const attMap = new Map(s.attendances.map((a) => [a.userId, a.status as string]));
  const attendees = members.filter((m) =>
    commentsOnDay(effectiveStatus(absenceMap.get(m.id), attMap.get(m.id)))
  );

  const ordered = shuffle(attendees, Math.random);

  await tx.sessionCommentOrder.deleteMany({ where: { sessionId } });
  if (ordered.length > 0) {
    await tx.sessionCommentOrder.createMany({
      data: ordered.map((u, i) => ({ sessionId, userId: u.id, position: i + 1 })),
    });
  }
  await tx.session.update({ where: { id: sessionId }, data: { commentOrderDrawnAt: new Date() } });

  return ordered.length;
}

/**
 * コメント順を取得する。
 *
 * 抽選済みならその並びを、未抽選ならセッションIDをシードにした仮の並びを返す。
 * どちらの場合も、表示時点の欠席・聴講のみの人は番号を外して詰め直す。
 * 抽選後に加わったメンバー（新入社員など）は末尾に付ける。
 * Phase1 以外のフェーズでは空配列を返す（応答者で管理するため）。
 */
export async function getCommentOrder(
  sessionId: number,
  tx: TxClient = prisma
): Promise<CommentOrderResult | null> {
  const s = await loadSession(sessionId, tx);
  if (!s) return null;
  if (s.phase.phaseNumber !== 1) {
    return { commentOrder: [], drawn: false, drawnAt: null };
  }

  const members = await tx.user.findMany({
    where: {
      choreiStatus: 'active',
      deletedAt: null,
      ...(s.speakerId ? { id: { not: s.speakerId } } : {}),
    },
    select: { id: true, name: true, grade: true },
  });
  const byId = new Map(members.map((m) => [m.id, m]));

  const drawn = s.commentOrderDrawnAt !== null;
  let ordered: typeof members;
  if (drawn) {
    // 抽選結果の順。退会・発話者に変わった人は除き、抽選後に加わった人は末尾へ。
    const fromDraw = s.commentOrder.map((r) => byId.get(r.userId)).filter((u) => u !== undefined);
    const seen = new Set(fromDraw.map((u) => u.id));
    ordered = [...fromDraw, ...members.filter((m) => !seen.has(m.id))];
  } else {
    // 未抽選の仮表示（DBの取得順に依存しないよう ID 昇順を基準にする）。
    const base = [...members].sort((a, b) => a.id.localeCompare(b.id));
    ordered = shuffle(base, mulberry32(sessionId));
  }

  const absenceMap = new Map(s.absenceRequests.map((r) => [r.userId, r.type as string]));
  const attMap = new Map(s.attendances.map((a) => [a.userId, a.status as string]));

  let position = 1;
  const commentOrder = ordered.map((u) => {
    const status = effectiveStatus(absenceMap.get(u.id), attMap.get(u.id));
    return { ...u, status, commentPosition: commentsOnDay(status) ? position++ : null };
  });

  return { commentOrder, drawn, drawnAt: s.commentOrderDrawnAt };
}
