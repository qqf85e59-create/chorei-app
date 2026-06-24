import { NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/api-auth';
import { rebalanceFutureSpeakers } from '@/lib/rotation';

// 当日処理(daily-finalize)同様、リクエスト時に必ず実行する。
export const dynamic = 'force-dynamic';

/**
 * POST /api/rotation/rebalance
 *
 * 発話回数を均等化する再調整を実行する（admin のみ）。
 * 固定境界日（ROTATION_FIXED_UNTIL）までのセッションは変更せず、
 * 翌日以降の予定セッションの発話者だけを回数が均等になるよう貪欲法で割り当て直す。
 */
export async function POST() {
  try {
    await requireAdmin();
    const result = await rebalanceFutureSpeakers();
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
