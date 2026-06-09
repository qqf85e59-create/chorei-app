import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { selectParticipants } from "@/lib/selectionAlgorithm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();

    const eventId = parseInt((await params).id);
    const body = await req.json();
    const { excludedMemberIds = [] } = body; // Array of user IDs to manually exclude this round

    // 1. Get the current event and check status
    const event = await prisma.lunchEvent.findUnique({
      where: { id: eventId }
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // 2. Get previous event to find its participants
    const previousEvent = await prisma.lunchEvent.findFirst({
      where: { id: { lt: eventId }, status: { not: 'cancelled' } },
      orderBy: { id: 'desc' },
      include: { participants: true }
    });
    const previousParticipantIds = previousEvent 
      ? previousEvent.participants.filter(p => !p.isOrganizer).map(p => p.userId)
      : [];

    // 3. Get all active staff members
    const activeStaff = await prisma.user.findMany({
      where: { 
        lunchStatus: 'active',
        lunchRole: 'participant',
        deletedAt: null
      }
    });

    // 4. Run selection algorithm
    const selectedMembers = selectParticipants(
      activeStaff,
      excludedMemberIds,
      previousParticipantIds,
      3 // Number of staff to select
    );

    // 5. Save results to Participation table (clear previous if any)
    await prisma.$transaction(async (tx) => {
      // Clear old participations for this event
      await tx.participation.deleteMany({
        where: { eventId }
      });

      // Add organizer
      await tx.participation.create({
        data: {
          eventId,
          userId: event.organizerId,
          isOrganizer: true
        }
      });

      // Add selected staff
      for (const user of selectedMembers) {
        await tx.participation.create({
          data: {
            eventId,
            userId: user.id,
            isOrganizer: false
          }
        });
      }

      // Record arbitrary exclusions if provided
      if (excludedMemberIds.length > 0) {
        const organizer = await tx.user.findUnique({ where: { email: session.user?.email as string } });
        for (const excludedId of excludedMemberIds) {
          await tx.exclusionLog.create({
            data: {
              eventId,
              excludedUserId: excludedId,
              excludedById: organizer!.id,
              reason: "当回の手動除外（ランダム選定時）"
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true, selectedMembers });
  } catch (error) {
    console.error("Error selecting participants:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
