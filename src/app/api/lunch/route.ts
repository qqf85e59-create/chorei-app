import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin, handleApiError } from '@/lib/api-auth';


export async function POST(req: Request) {
  try {
    const session = await requireAdmin();

    const body = await req.json();
    const { title, organizerId } = body;

    if (!title || !organizerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const lunchEvent = await prisma.lunchEvent.create({
      data: {
        title,
        organizerId,
        status: "planning"
      }
    });

    return NextResponse.json(lunchEvent, { status: 201 });
  } catch (error) {
    console.error("Error creating lunch event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireUser();

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const participantId = url.searchParams.get("participantId");

    const where: any = {};
    if (statusParam) {
      where.status = { in: statusParam.split(",") };
    }
    if (participantId) {
      where.participants = {
        some: { userId: participantId }
      };
    }

    const events = await prisma.lunchEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: true,
        restaurant: true,
        participants: true,
      }
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching lunch events:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
