import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import LunchManagementTabs from "./LunchManagementTabs";
import DeleteEventButton from "./DeleteEventButton";
import { Suspense } from "react";
import { getLunchProgress } from "@/lib/lunch-progress";
import { Check } from "lucide-react";

function LunchProgressIndicator({ event, activeParticipantCount }: { event: any, activeParticipantCount: number }) {
  const progress = getLunchProgress(event, activeParticipantCount);
  
  return (
    <div>
      <div className="flex justify-between mb-2">
        {progress.steps.map((step, idx) => (
          <div key={step.name} className={`flex flex-col items-center ${idx <= progress.currentStep ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}>
            <span className="text-xs font-bold whitespace-nowrap">{step.name}</span>
            <span className="text-[10px]">{step.statusText}</span>
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-100 rounded-full flex overflow-hidden">
        {progress.steps.map((step, idx) => {
          let bgColor = "bg-gray-100";
          if (step.isCompleted) bgColor = "bg-green-500";
          else if (step.isActive) bgColor = "bg-blue-400 animate-pulse";
          
          return (
            <div 
              key={step.name} 
              className={`h-full ${bgColor} border-r border-white last:border-r-0 transition-all`} 
              style={{ width: "25%" }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default async function LunchManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }
  const { role, lunchStatus } = session.user;

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
    where: { 
      lunchStatus: 'active',
      lunchRole: 'participant',
      deletedAt: null 
    },
    orderBy: { createdAt: 'asc' }
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] accent-bar pl-3">
            ランチ会管理: {event.title}
          </h2>
          <DeleteEventButton eventId={event.id} eventTitle={event.title} />
        </div>
        
        {/* Progress Indicator */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-700">進行状況</h3>
            <span className="text-xs font-medium bg-blue-50 text-[var(--color-primary)] px-2 py-1 rounded">
              {event.status === 'completed' ? '開催済み' : event.status === 'scheduled' ? '開催予定' : event.status === 'cancelled' ? '中止' : '準備中'}
            </span>
          </div>
          <LunchProgressIndicator event={event} activeParticipantCount={activeStaff.length} />
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
