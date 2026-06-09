import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { CONFIG_KEYS, getConfigHistory } from '@/lib/config';

// GET /api/config/meeting-url/history - Admin only
export async function GET() {
  try {
    const session = await requireAdmin();
    const history = await getConfigHistory(CONFIG_KEYS.MEETING_URL, 100);
    return NextResponse.json(history);
  } catch (err) {
    console.error('[GET /api/config/meeting-url/history]', err);
    return NextResponse.json(
      { error: 'Internal Server Error', detail: (err as Error).message },
      { status: 500 }
    );
  }
}
