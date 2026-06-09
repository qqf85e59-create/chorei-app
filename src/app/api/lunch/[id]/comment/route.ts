import { requireUser, handleApiError } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const eventId = parseInt((await params).id);
    const userId = session.user.id;

    const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
    const isAdmin = session.user.role === 'admin';
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const comments = await prisma.lunchComment.findMany({
      where: { eventId },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const eventId = parseInt((await params).id);
    const userId = session.user.id;

    const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
    const isAdmin = session.user.role === 'admin';
    if (!isParticipant && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const comment = await prisma.lunchComment.create({
      data: {
        eventId,
        userId,
        content
      },
      include: { user: true }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error posting comment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
