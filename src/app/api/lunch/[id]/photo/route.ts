import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = parseInt((await params).id);
    const photos = await prisma.lunchPhoto.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = parseInt((await params).id);
    const body = await req.json();
    const { url, caption } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const photo = await prisma.lunchPhoto.create({
      data: {
        eventId,
        url,
        caption
      }
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("Error posting photo:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
