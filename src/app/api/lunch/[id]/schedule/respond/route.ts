import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleApiError } from "@/lib/api-auth";

// 参加者が候補日程に回答するAPI
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const eventId = parseInt((await params).id);
    const session = await requireUser();
    const userId = session.user.id;

    const body = await req.json();
    const responses: { candidateId: number, response: "○" | "△" | "×" }[] = body.responses;
    
    // 1) candidate が全てこの event に属することを検証
    const ids = [...new Set(responses.map(r => r.candidateId))];
    const valid = await prisma.scheduleCandidate.count({
      where: { id: { in: ids }, eventId },
    });
    if (valid !== ids.length) {
      return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
    }

    // 2) 本人が参加者、またはadminであることを検証
    const isParticipant = await prisma.participation.count({ where: { eventId, userId } });
    if (!isParticipant && session.user.role !== 'admin') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      for (const res of responses) {
        await tx.scheduleResponse.upsert({
          where: {
            candidateId_userId: {
              candidateId: res.candidateId,
              userId: userId
            }
          },
          update: {
            response: res.response
          },
          create: {
            candidateId: res.candidateId,
            userId: userId,
            response: res.response
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting schedule responses:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
