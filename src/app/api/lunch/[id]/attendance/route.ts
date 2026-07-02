import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/lunch/[id]/attendance
 *
 * ランチ会当日の実参加（出欠）を記録する。精算は attended=true のメンバーのみで
 * 割り勘するため、当日欠席(no-show)の人を false にすることで実参加人数を反映する。
 *
 * Body: { userId: string; attended: boolean }
 * admin 限定。userId が当該 event の参加者であることを検証する。
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();

    const eventId = parseInt((await params).id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "無効な eventId です" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, attended } = body as { userId?: string; attended?: boolean };
    if (!userId || typeof attended !== "boolean") {
      return NextResponse.json({ error: "userId と attended(boolean) が必要です" }, { status: 400 });
    }

    // 当該 event の参加者であることを検証（URLの id と body の userId の所属一致）
    const participation = await prisma.participation.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!participation) {
      return NextResponse.json({ error: "その参加者は見つかりません" }, { status: 404 });
    }

    const updated = await prisma.participation.update({
      where: { id: participation.id },
      data: { attended },
    });

    return NextResponse.json({ ok: true, participation: updated });
  } catch (error) {
    console.error("Error updating lunch attendance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
