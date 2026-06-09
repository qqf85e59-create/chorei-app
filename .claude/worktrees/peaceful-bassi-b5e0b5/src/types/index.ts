import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    email: string | null;
    role: string;
    grade: string;
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
      grade: string;
    };
  }
}


// Session with relations
export interface SessionWithRelations {
  id: number;
  date: string;
  phaseId: number;
  weekNumber: number;
  topicId: number;
  speakerId: string;

  startTime: string;
  endTime: string;
  status: string;
  adminNote: string | null;
  roundNumber: number;
  speaker: {
    id: string;
    name: string;
    grade: string;
  };
  commentators: {
    id: string;
    name: string;
    grade: string;
  }[];
  topic: {
    id: number;
    topicText: string;
    weekNumber: number;
  };
  phase: {
    id: number;
    name: string;
    phaseNumber: number;
  };
}

export interface AttendanceRecord {
  id: number;
  sessionId: number;
  userId: string;
  status: string;
  reportedAt: string | null;
  adminNote: string | null;
  user: {
    id: string;
    name: string;
    grade: string;
  };
}

export interface AbsenceAlert {
  userId: string;
  userName: string;
  grade: string;
  consecutiveAbsences: number;
  alertLevel: 'none' | 'warning' | 'danger';
}
