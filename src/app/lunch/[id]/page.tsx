import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import LunchManagementTabs from "./LunchManagementTabs";
import DeleteEventButton from "./DeleteEventButton";
import { Suspense } from "react";

export default async function LunchManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }
  const { role, lunchStatus } = session.user as any;

  if (role !== "admin" && lunchStatus !== "active") {
    redirect("/home");
  }

  const eventId = parseInt((await params).id);
  const event = await prisma.lunchEvent.findUnique({
    where: { id: eventId },
    include: {
      organizer: true,
      restaurant: true,
      participants: { include: { user: true } },
      scheduleCandidates: { include: { responses: true } },
      surveyResponses: { include: { user: true } }
    }
  });

  const recentChoreiTopics = await prisma.topic.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: 'asc' }
  });

  if (!event) {
    return <div>イベントが見つかりません。</div>;
  }

  // メンバー選定用のアクティブスタッフ一覧
  const activeStaff = await prisma.user.findMany({
    where: { lunchStatus: 'active', role: 'member', deletedAt: null }
  });

  // 前回の参加者IDリスト (連続選定抑制用)
  const previousEvent = await prisma.lunchEvent.findFirst({
    where: { id: { lt: eventId }, status: { not: 'cancelled' } },
    orderBy: { id: 'desc' },
    include: { participants: true }
  });
  
  const previousParticipantIds = previousEvent 
    ? previousEvent.participants.filter(p => !p.isOrganizer).map(p => p.userId)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] accent-bar pl-3">
            ランチ会管理: {event.title}
          </h2>
          <DeleteEventButton eventId={event.id} eventTitle={event.title} />
        </div>
        
        <Suspense fallback={<div>Loading tabs...</div>}>
          <LunchManagementTabs 
            event={event} 
            activeStaff={activeStaff} 
            previousParticipantIds={previousParticipantIds} 
            role={role}
            userId={session.user.id}
            recentChoreiTopics={recentChoreiTopics}
            restaurants={restaurants}
          />
        </Suspense>
      </main>
    </div>
  );
}
