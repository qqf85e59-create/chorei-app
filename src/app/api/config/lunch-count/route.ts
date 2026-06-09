import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/api-auth';
import {
  CONFIG_KEYS,
  getLunchParticipantCount,
  setConfigValue,
} from '@/lib/config';

// GET /api/config/lunch-count - 認証ユーザーは閲覧可
export async function GET() {
  try {
    await requireUser();
    const count = await getLunchParticipantCount();
    return NextResponse.json({ count });
  } catch (err) {
    console.error('[GET /api/config/lunch-count]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/config/lunch-count - 運営(admin)のみ
export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const n = parseInt(body.count, 10);

    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return NextResponse.json(
        { error: '人数は1〜20の整数で入力してください' },
        { status: 400 }
      );
    }

    await setConfigValue(CONFIG_KEYS.LUNCH_PARTICIPANT_COUNT, String(n), session.user.id);
    return NextResponse.json({ count: n });
  } catch (err) {
    console.error('[PUT /api/config/lunch-count]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
