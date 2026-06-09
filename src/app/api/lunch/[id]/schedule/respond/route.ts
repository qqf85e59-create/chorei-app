import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";


// 参加者が候補日程に回答するAPI
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const eventId = parseInt((await params).id);
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { responses } = body; // Array of { candidateId: number, response: "○" | "△" | "×" }
    
    const userId = (session.user as any).id as string;

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
