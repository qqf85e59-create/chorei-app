import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = parseInt((await params).id);
    const body = await req.json();
    
    // Only allow updating specific fields
    const { status, confirmedDate, restaurantId, totalCost } = body;
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (confirmedDate) updateData.confirmedDate = new Date(confirmedDate);
    if (restaurantId !== undefined) updateData.restaurantId = restaurantId;
    if (totalCost !== undefined) updateData.totalCost = totalCost;

    const updatedEvent = await prisma.lunchEvent.update({
      where: { id: eventId },
      data: updateData
    });

    return NextResponse.json(updatedEvent);
  } catch (error) {
    console.error("Error updating lunch event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
