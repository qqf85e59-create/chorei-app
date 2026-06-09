import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";


// 主催者が候補日程を追加するAPI
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const eventId = parseInt((await params).id);
    const body = await req.json();
    const { candidates } = body; // Array of { candidateDate: string, note?: string }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
    }

    // 古い候補日と回答を削除するかどうかは仕様次第ですが、今回は追加として扱うか、
    // あるいは一旦リセットする実装にします。ここではシンプルに追加とします。
    // (実運用では再設定時に一旦クリアする等の処理が必要です)

    const createdCandidates = [];
    for (const c of candidates) {
      const created = await prisma.scheduleCandidate.create({
        data: {
          eventId,
          candidateDate: new Date(c.candidateDate),
          note: c.note
        }
      });
      createdCandidates.push(created);
    }

    return NextResponse.json({ success: true, createdCandidates }, { status: 201 });
  } catch (error) {
    console.error("Error adding schedule candidates:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
