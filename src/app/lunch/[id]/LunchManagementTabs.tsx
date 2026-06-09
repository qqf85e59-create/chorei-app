"use client";

import { useState } from "react";
import { User, LunchEvent, Participation, ScheduleCandidate, ScheduleResponse, SurveyResponse, Restaurant } from "@prisma/client";
import SelectionTab from "./tabs/SelectionTab";
import TopicTab from "./tabs/TopicTab";
import SurveyTab from "./tabs/SurveyTab";
import RestaurantTab from "./tabs/RestaurantTab";
// import SettlementTab from "./tabs/SettlementTab";
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
};

export default function LunchManagementTabs({ event, activeStaff, previousParticipantIds }: Props) {
  const [activeTab, setActiveTab] = useState<"topic" | "selection" | "survey" | "restaurant">("selection");

  const tabs = [
    { id: "topic", label: "話題案" },
    { id: "selection", label: "メンバー選定" },
    { id: "survey", label: "アンケート" },
    { id: "restaurant", label: "行先・予約" },
  ] as const;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="border-b border-gray-200 flex overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
        {activeTab === "topic" && <TopicTab eventId={event.id} />}
        {activeTab === "selection" && (
          <SelectionTab 
            event={event} 
            activeStaff={activeStaff} 
            previousParticipantIds={previousParticipantIds} 
          />
        )}
        {activeTab === "survey" && <SurveyTab event={event} />}
        {activeTab === "restaurant" && <RestaurantTab event={event} />}
      </div>
    </div>
  );
}
