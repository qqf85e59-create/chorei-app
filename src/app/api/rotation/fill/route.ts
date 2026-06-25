import { NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/api-auth';
import { healFutureSpeakers } from '@/lib/rotation';

// 毎回リクエスト時に実行する（キャッシュしない）。
export const dynamic = 'force-dynamic';

/**
 * POST /api/rotation/fill
 *
 * 未来の発話輪番を自動で整える（admin のみ）：未定(null)を補充し、
 * 「なか4回」違反（直近に登壇した人との重複）も修復する。
 * 正しい割当は変更しないため何度呼んでも安全（冪等）。
 */
export async function POST() {
  try {
    await requireAdmin();
    const result = await healFutureSpeakers();
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
