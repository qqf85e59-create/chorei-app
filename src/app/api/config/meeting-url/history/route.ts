import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CONFIG_KEYS, getConfigHistory } from '@/lib/config';

// GET /api/config/meeting-url/history - Admin only
export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const history = await getConfigHistory(CONFIG_KEYS.MEETING_URL, 100);
  return NextResponse.json(history);
}
