"use client";

import { useState } from "react";
import { User, LunchEvent, Participation, ScheduleCandidate, ScheduleResponse, SurveyResponse, Restaurant } from "@prisma/client";
import SelectionTab from "./tabs/SelectionTab";
import TopicTab from "./tabs/TopicTab";
import SurveyTab from "./tabs/SurveyTab";
import RestaurantTab from "./tabs/RestaurantTab";
import ScheduleTab from "./tabs/ScheduleTab";
import SettlementTab from "./tabs/SettlementTab";
// import RecapTab from "./tabs/RecapTab";

type EventWithDetails = LunchEvent & {
  participants: (Participation & { user: User })[];
  scheduleCandidates: (ScheduleCandidate & { responses: ScheduleResponse[] })[];
  surveyResponses: SurveyResponse[];
  restaurant: Restaurant | null;
};

type Props = {
  event: EventWithDetails;
  activeStaff: User[];
  previousParticipantIds: string[];
  role: string;
  userId: string;
  recentChoreiTopics: any[];
  restaurants: any[];
};

import { useSearchParams } from "next/navigation";

export default function LunchManagementTabs({ event, activeStaff, previousParticipantIds, role, userId, recentChoreiTopics, restaurants }: Props) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as any;
  const isParticipant = event.participants.some((p) => p.userId === userId);
  const [activeTab, setActiveTab] = useState<"topic" | "selection" | "survey" | "restaurant" | "schedule" | "settlement">(
    initialTab || (role === "admin" ? "selection" : "schedule")
  );

  const tabs = [
    { id: "topic", label: "話題案", adminOnly: false },
    { id: "selection", label: "メンバー選定", adminOnly: true },
    { id: "schedule", label: "日程調整", adminOnly: false },
    { id: "survey", label: "アンケート", adminOnly: false },
    { id: "restaurant", label: "行先・予約", adminOnly: true },
    { id: "settlement", label: "精算", adminOnly: true },
  ] as const;

  const visibleTabs = tabs.filter(t => role === "admin" || !t.adminOnly);

  // 閲覧権限はpage.tsxで検証済み (role === 'admin' || lunchStatus === 'active')

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="border-b border-gray-200 flex overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-panel)]" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 min-h-[400px]">
        {activeTab === "topic" && <TopicTab eventId={event.id} recentChoreiTopics={recentChoreiTopics} />}
        {activeTab === "selection" && role === "admin" && (
          <SelectionTab 
            event={event} 
            activeStaff={activeStaff} 
            previousParticipantIds={previousParticipantIds} 
          />
        )}
        {activeTab === "schedule" && <ScheduleTab event={event} role={role} userId={userId} isParticipant={isParticipant} />}
        {activeTab === "survey" && <SurveyTab event={event} role={role} userId={userId} isParticipant={isParticipant} activeStaff={activeStaff} />}
        {activeTab === "restaurant" && role === "admin" && <RestaurantTab event={event} restaurants={restaurants} />}
        {activeTab === "settlement" && role === "admin" && <SettlementTab event={event} />}
      </div>
    </div>
  );
}
