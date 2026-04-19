import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, count = 2 } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    // 1. 対象セッションを取得（メイン発話者を知るため）
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2. サブ発話者候補となる全ユーザーを取得（メイン発話者は除外）
    const candidateUsers = await prisma.user.findMany({
      where: { id: { not: targetSession.speakerId } },
    });

    // 3. 対象セッションにおける 出欠（Attendance）と 事前申請（AbsenceRequest）を取得
    const attendances = await prisma.attendance.findMany({
      where: {
        sessionId,
        status: { in: ['absent', 'left_early'] }
      }
    });
    
    const absenceRequests = await prisma.absenceRequest.findMany({
      where: { sessionId }
    });

    // メイン発話者、および欠席・早退予定者のIDリスト
    const excludeUserIds = new Set([
      targetSession.speakerId,
      ...attendances.map(a => a.userId),
      ...absenceRequests.map(ar => ar.userId)
    ]);

    // 4. 除外リストに含まれない候補者に絞り込み
    const availableUsers = candidateUsers.filter(u => !excludeUserIds.has(u.id));

    if (availableUsers.length === 0) {
      return NextResponse.json({ error: 'No available candidates' }, { status: 400 });
    }

    // 5. ランダムにシャッフルして必要な人数分抽出
    const shuffled = availableUsers.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    // 6. DBを更新 (該当セッションとユーザーを紐付け)
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        commentators: {
          // すでに設定されているものを上書き（リセット）して紐付け
          set: selected.map(u => ({ id: u.id }))
        }
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
