import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from '@/lib/api-auth';
import { canonicalLunchTitle } from "@/lib/lunch-title";


export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const { id: userId, role, lunchRole } = session.user as {
      id: string; role?: string; lunchRole?: string;
    };

    // 作成できるのは主催者(lunchRole='organizer')または朝礼運営(admin)のみ
    if (role !== "admin" && lunchRole !== "organizer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    // タイトルは標準フォーマットへ自動正規化（第1回踏襲・自動統一）。
    // フォームが渡す月をもとに正規化し、空なら当月(JST)で生成する。
    const title = canonicalLunchTitle(body?.title);

    // 同月重複イベントの作成防止 (P9-1)
    const existingEvent = await prisma.lunchEvent.findFirst({
      where: {
        title,
        status: { in: ['planning', 'scheduled'] }
      }
    });

    if (existingEvent) {
      return NextResponse.json({ error: "Lunch event for this month already exists" }, { status: 409 });
    }

    // 主催者はログイン中の本人
    const lunchEvent = await prisma.lunchEvent.create({
      data: {
        title,
        organizerId: userId,
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
