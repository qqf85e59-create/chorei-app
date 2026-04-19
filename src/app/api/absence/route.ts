import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getSessionDates, getWeekNumber } from '@/lib/rotation';

// POST /api/absence - Create an absence request
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId, type, note } = body;

  // Verify the session exists
  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!targetSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Create absence request
  const absenceRequest = await prisma.absenceRequest.create({
    data: {
      userId: session.user.id,
      sessionId,
      type,
      note: note || null,
    },
  });

  // Update attendance record
  await prisma.attendance.upsert({
    where: {
      sessionId_userId: {
        sessionId,
        userId: session.user.id,
      },
    },
    update: {
      status: type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early',
      reportedAt: new Date(),
    },
    create: {
      sessionId,
      userId: session.user.id,
      status: type === 'absent' ? 'absent' : type === 'unspoken' ? 'unspoken' : 'left_early',
      reportedAt: new Date(),
    },
  });

  // Cascade bump logic: If the main speaker is absent/unspoken, we push everyone down by 1 session
  if (targetSession.speakerId === session.user.id && (type === 'absent' || type === 'unspoken')) {
    const futureSessions = await prisma.session.findMany({
      where: {
        phaseId: targetSession.phaseId,
        date: { gte: targetSession.date },
      },
      orderBy: { date: 'asc' },
    });

    if (futureSessions.length > 0) {
      // 1. Remove speaker from today
      await prisma.session.update({
        where: { id: targetSession.id },
        data: { speakerId: null, adminNote: '欠席により発表順延' },
      });

      if (futureSessions.length > 1) {
        // 2. Shift speakers and topics down the line
        let prevSpeakerId = futureSessions[0].speakerId;
        let prevTopicId = futureSessions[0].topicId;

        for (let i = 1; i < futureSessions.length; i++) {
          const s = futureSessions[i];
          const currSpeakerId = s.speakerId;
          const currTopicId = s.topicId;

          await prisma.session.update({
            where: { id: s.id },
            data: {
              speakerId: prevSpeakerId,
              topicId: prevTopicId,
              adminNote: s.adminNote ? s.adminNote : '自動順送り（スケジュール再割当）',
            },
          });

          prevSpeakerId = currSpeakerId;
          prevTopicId = currTopicId;
        }

        // 3. Create a new session at the end for the person who fell off
        const lastSession = futureSessions[futureSessions.length - 1];
        const holidays = await prisma.holiday.findMany({ where: { isActive: true } });
        const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));
        
        // Find next valid day by starting exactly from the day AFTER lastSession.date
        const nextStartDate = new Date(lastSession.date);
        nextStartDate.setDate(nextStartDate.getDate() + 1);
        
        const nextDates = getSessionDates(nextStartDate, 1, holidaySet);
        if (nextDates.length > 0) {
          const newDate = nextDates[0];
          const weekNum = getWeekNumber(newDate, new Date(futureSessions[0].date)); // approximate week calculation

          if (prevSpeakerId) {
            await prisma.session.create({
              data: {
                date: newDate,
                phaseId: lastSession.phaseId,
                weekNumber: weekNum,
                topicId: prevTopicId,
                speakerId: prevSpeakerId,
                startTime: lastSession.startTime,
                endTime: lastSession.endTime,
                status: 'scheduled',
                roundNumber: lastSession.roundNumber,
                adminNote: '自動順送りによる追加枠',
              },
            });
          }
        }
      }
    }
  }

  return NextResponse.json(absenceRequest, { status: 201 });
}

// GET /api/absence - Get absence requests
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const userRole = (session.user as { role: string }).role;

  const where: Record<string, unknown> = {};

  if (sessionId) where.sessionId = parseInt(sessionId);

  // Members can only see their own requests
  if (userRole !== 'admin') {
    where.userId = session.user.id;
  }

  const requests = await prisma.absenceRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, grade: true } },
      session: {
        select: {
          date: true,
          topic: { select: { topicText: true } },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  return NextResponse.json(requests);
}
