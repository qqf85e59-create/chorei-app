import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  CONFIG_KEYS,
  DEFAULT_MEETING_URL,
  getConfigValue,
  setConfigValue,
} from '@/lib/config';

// GET /api/config/meeting-url - All authenticated users can read
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = await getConfigValue(CONFIG_KEYS.MEETING_URL, DEFAULT_MEETING_URL);
  return NextResponse.json({ url });
}

// PUT /api/config/meeting-url - Admin only
export async function PUT(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { url } = body;

  if (typeof url !== 'string' || url.trim().length === 0) {
    return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 });
  }

  // Basic URL validation
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
  } catch {
    return NextResponse.json(
      { error: '有効なURLを入力してください（http:// または https:// で始まる形式）' },
      { status: 400 }
    );
  }

  await setConfigValue(CONFIG_KEYS.MEETING_URL, url.trim(), session.user.id);
  return NextResponse.json({ url: url.trim() });
}
