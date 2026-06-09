import { NextResponse } from 'next/server';
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';
import { getAllAbsenceAlerts } from '@/lib/absence-alert';

// GET /api/alerts - Get absence alerts (admin only)
export async function GET() {
  const session = await requireAdmin();

  const alerts = await getAllAbsenceAlerts();
  return NextResponse.json(alerts);
}
