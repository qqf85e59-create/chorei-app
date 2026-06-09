import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const eventId = parseInt((await params).id);
    const userId = session.user.id;

    // Check participation
    const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
    const isAdmin = session.user.role === "admin";
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { genres, area, budget } = body;

    const existing = await prisma.surveyResponse.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });

    if (existing) {
      const updated = await prisma.surveyResponse.update({
        where: { id: existing.id },
        data: {
          genres: genres !== undefined ? genres : existing.genres,
          area: area !== undefined ? area : existing.area,
          budget: budget !== undefined ? budget : existing.budget,
        }
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.surveyResponse.create({
        data: {
          eventId,
          userId,
          genres: genres ?? "[]",
          area: area ?? "",
          budget: budget ?? ""
        }
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const userId = session.user.id;
    const eventId = parseInt((await params).id);

    // If there is an existing response for this event, return it
    const currentResponse = await prisma.surveyResponse.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });

    if (currentResponse) {
      return NextResponse.json(currentResponse);
    }

    // Otherwise, return the most recent response for prefill
    const lastResponse = await prisma.surveyResponse.findFirst({
      where: { userId },
      orderBy: { id: 'desc' }
    });

    return NextResponse.json(lastResponse || {});
  } catch (error) {
    return handleApiError(error);
  }
}
