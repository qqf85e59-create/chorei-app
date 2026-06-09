import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const eventId = parseInt((await params).id);
    const settlement = await prisma.settlement.findFirst({
      where: { eventId }
    });

    return NextResponse.json(settlement || {});
  } catch (error) {
    console.error("Error fetching settlement:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const eventId = parseInt((await params).id);
    const body = await req.json();
    const { totalAmount, payerId, status, note } = body;

    if (totalAmount === undefined || !payerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 参加人数を取得
    const participants = await prisma.participation.count({
      where: { eventId }
    });

    if (participants === 0) {
      return NextResponse.json({ error: "No participants found" }, { status: 400 });
    }

    // 割り勘の計算（端数切り上げ）
    const perPerson = Math.ceil(totalAmount / participants);

    // 既存の精算情報があれば更新、なければ作成
    const existing = await prisma.settlement.findFirst({
      where: { eventId }
    });

    let settlement;
    if (existing) {
      settlement = await prisma.settlement.update({
        where: { id: existing.id },
        data: { totalAmount, payerId, status, note, perPerson }
      });
    } else {
      settlement = await prisma.settlement.create({
        data: {
          eventId,
          totalAmount,
          payerId,
          perPerson,
          status: status || "unpaid",
          note
        }
      });
    }

    // LunchEventのtotalCostも更新しておく
    await prisma.lunchEvent.update({
      where: { id: eventId },
      data: { totalCost: totalAmount }
    });

    return NextResponse.json(settlement);
  } catch (error) {
    console.error("Error saving settlement:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
