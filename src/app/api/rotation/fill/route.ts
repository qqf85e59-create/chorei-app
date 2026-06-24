import { NextResponse } from 'next/server';
import { requireAdmin, handleApiError } from '@/lib/api-auth';
import { fillEmptySpeakers } from '@/lib/rotation';

// 毎回リクエスト時に実行する（キャッシュしない）。
export const dynamic = 'force-dynamic';

/**
 * POST /api/rotation/fill
 *
 * 「未定（speaker=null）」の未来セッションだけを自動補充する（admin のみ）。
 * 既存の割当は変更しないため何度呼んでも安全（冪等）。
 * 補充は「なか4回は飛ばす」ルールを遵守する。
 */
export async function POST() {
  try {
    await requireAdmin();
    const filled = await fillEmptySpeakers();
    return NextResponse.json({ filled });
  } catch (e) {
    return handleApiError(e);
  }
}
