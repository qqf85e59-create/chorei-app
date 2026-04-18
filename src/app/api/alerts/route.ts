import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllAbsenceAlerts } from '@/lib/absence-alert';

// GET /api/alerts - Get absence alerts (admin only)
export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const alerts = await getAllAbsenceAlerts();
  return NextResponse.json(alerts);
}
