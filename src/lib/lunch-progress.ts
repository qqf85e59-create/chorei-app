import { LunchEvent, Participation, SurveyResponse, Settlement } from "@prisma/client";

export type LunchProgressStep = "アンケート" | "メンバー選定" | "日程・店舗" | "経費精算";

export interface LunchProgress {
  currentStep: number; // 0 to 4
  steps: {
    name: LunchProgressStep;
    isCompleted: boolean;
    isActive: boolean;
    statusText?: string;
  }[];
}

export function getLunchProgress(
  event: LunchEvent & { 
    participants?: Participation[], 
    surveyResponses?: SurveyResponse[],
    settlement?: Settlement | null
  },
  activeParticipantCount: number = 0 // Required to calculate if survey is completed before members are selected
): LunchProgress {
  
  const steps: LunchProgress["steps"] = [
    { name: "アンケート", isCompleted: false, isActive: false },
    { name: "メンバー選定", isCompleted: false, isActive: false },
    { name: "日程・店舗", isCompleted: false, isActive: false },
    { name: "経費精算", isCompleted: false, isActive: false },
  ];

  // 1. アンケート
  // If members are selected, survey is assumed complete or we check responses among selected members
  // If members are NOT selected yet, check if all active participants have responded
  const participants = event.participants || [];
  const responses = event.surveyResponses || [];
  const selectedMembersCount = participants.filter(p => !p.isOrganizer).length;
  
  if (selectedMembersCount > 0) {
    // Member selection is done, survey step is technically completed
    steps[0].isCompleted = true;
    steps[0].statusText = "完了";
  } else {
    // Member selection not done, check responses vs active staff
    const responseCount = responses.length;
    if (activeParticipantCount > 0 && responseCount >= activeParticipantCount) {
      steps[0].isCompleted = true;
      steps[0].statusText = "完了";
    } else {
      steps[0].statusText = `${responseCount}/${activeParticipantCount} 回答済`;
    }
  }

  // 2. メンバー選定
  if (selectedMembersCount >= 3) {
    steps[1].isCompleted = true;
    steps[1].statusText = "確定済";
  } else if (selectedMembersCount > 0) {
    steps[1].statusText = "一部確定";
  } else {
    steps[1].statusText = "未確定";
  }

  // 3. 日程・店舗
  if (event.confirmedDate && event.restaurantId) {
    steps[2].isCompleted = true;
    steps[2].statusText = "確定済";
  } else if (event.confirmedDate) {
    steps[2].statusText = "店舗未定";
  } else if (event.restaurantId) {
    steps[2].statusText = "日程未定";
  } else {
    steps[2].statusText = "未確定";
  }

  // 4. 経費精算
  if (event.settlement && event.settlement.status === "paid") {
    steps[3].isCompleted = true;
    steps[3].statusText = "完了";
  } else if (event.settlement) {
    steps[3].statusText = "精算中";
  } else {
    steps[3].statusText = "未精算";
  }

  // Determine current active step (first uncompleted step)
  let currentStep = 0;
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].isCompleted) {
      steps[i].isActive = true;
      currentStep = i;
      break;
    }
  }
  
  // If all completed
  if (steps.every(s => s.isCompleted)) {
    currentStep = 4;
  }

  return { currentStep, steps };
}
