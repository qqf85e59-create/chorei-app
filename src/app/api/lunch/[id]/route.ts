import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();

    const eventId = parseInt((await params).id);
    const event = await prisma.lunchEvent.findUnique({
      where: { id: eventId },
      include: {
        organizer: true,
        restaurant: true,
        participants: {
          include: { user: true }
        },
        scheduleCandidates: {
          include: { responses: true }
        },
        surveyResponses: {
          include: { user: true }
        },
      }
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching lunch event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();

    const eventId = parseInt((await params).id);
    const event = await prisma.lunchEvent.findUnique({
      where: { id: eventId },
      include: { organizer: true }
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (session.user.role !== 'admin' && event.organizer.email !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Related records must be deleted first due to lack of cascade
    await prisma.$transaction([
      prisma.participation.deleteMany({ where: { eventId } }),
      prisma.scheduleResponse.deleteMany({ where: { candidate: { eventId } } }),
      prisma.scheduleCandidate.deleteMany({ where: { eventId } }),
      prisma.surveyResponse.deleteMany({ where: { eventId } }),
      prisma.exclusionLog.deleteMany({ where: { eventId } }),
      prisma.settlement.deleteMany({ where: { eventId } }),
      prisma.lunchComment.deleteMany({ where: { eventId } }),
      prisma.lunchPhoto.deleteMany({ where: { eventId } }),
      prisma.lunchEvent.delete({ where: { id: eventId } })
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const eventId = parseInt((await params).id);
    const body = await req.json();
    
    // Only allow updating specific fields
    const { status, confirmedDate, restaurantId, totalCost } = body;
    
    // Get original event to check what's changed and get title/participants
    const originalEvent = await prisma.lunchEvent.findUnique({
      where: { id: eventId },
      include: {
        participants: true,
      }
    });

    if (!originalEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (confirmedDate) updateData.confirmedDate = new Date(confirmedDate);
    if (restaurantId !== undefined) updateData.restaurantId = restaurantId;
    if (totalCost !== undefined) updateData.totalCost = totalCost;

    // もし予約完了(scheduled)または完了(completed)になり、restaurantIdが指定されているならvisitCountを更新
    // (既に更新されているかのチェックは簡略化のため省くが、実際には状態遷移チェックが必要かも)
    const updatedEvent = await prisma.lunchEvent.update({
      where: { id: eventId },
      data: updateData,
      include: {
        restaurant: true
      }
    });

    if ((status === 'scheduled' || status === 'completed') && updateData.restaurantId) {
      await prisma.restaurant.update({
        where: { id: updateData.restaurantId },
        data: {
          visitCount: { increment: 1 },
          lastVisited: new Date()
        }
      });
    }

    // P9-3: 日程・店舗確定時のアプリ内通知
    const isConfirmedDateChanged = confirmedDate && originalEvent.confirmedDate?.toISOString() !== new Date(confirmedDate).toISOString();
    const isRestaurantChanged = restaurantId !== undefined && originalEvent.restaurantId !== restaurantId;
    const isStatusChangedToScheduled = status === 'scheduled' && originalEvent.status !== 'scheduled';

    if (isConfirmedDateChanged || isRestaurantChanged || isStatusChangedToScheduled) {
      // Create notification for all participants
      if (updatedEvent.confirmedDate) {
        const dateStr = updatedEvent.confirmedDate.toLocaleDateString('ja-JP');
        const restStr = updatedEvent.restaurant ? `（店舗: ${updatedEvent.restaurant.name}）` : '';
        const message = `${updatedEvent.title} の日程が ${dateStr} に確定しました${restStr}`;

        // 主催者以外の参加者に通知
        const targetUserIds = originalEvent.participants
          .filter((p) => p.userId !== originalEvent.organizerId)
          .map((p) => p.userId);

        if (targetUserIds.length > 0) {
          await prisma.notification.createMany({
            data: targetUserIds.map((userId) => ({
              userId,
              type: 'lunch_confirmed',
              message,
              linkUrl: `/lunch/${eventId}`
            }))
          });
        }
      }
    }

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error("Error updating lunch event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
