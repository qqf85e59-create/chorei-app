import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { buildLunchIcs, toJstDateStr } from "@/lib/ics";

/**
 * GET /api/lunch/[id]/ics
 *
 * 確定済みランチ会をカレンダー(.ics)としてダウンロードする。
 * 日程未確定(confirmedDate=null)の場合は 400。ログインユーザーなら誰でも取得可。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();

    const eventId = parseInt((await params).id);
    if (isNaN(eventId)) {
      return new Response("無効な eventId です", { status: 400 });
    }

    const event = await prisma.lunchEvent.findUnique({
      where: { id: eventId },
      include: { restaurant: true },
    });
    if (!event) return new Response("見つかりません", { status: 404 });
    if (!event.confirmedDate) {
      return new Response("日程が未確定です", { status: 400 });
    }

    const location = event.restaurant
      ? [event.restaurant.name, event.restaurant.address].filter(Boolean).join(" ")
      : null;
    const description = event.restaurant?.url
      ? `店舗情報: ${event.restaurant.url}`
      : null;

    const ics = buildLunchIcs({
      id: event.id,
      title: event.title,
      jstDateStr: toJstDateStr(event.confirmedDate),
      location,
      description,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="lunch-${event.id}.ics"`,
      },
    });
  } catch (error) {
    console.error("Error generating lunch ICS:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
