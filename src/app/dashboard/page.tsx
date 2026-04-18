'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays,
  Users,
  RotateCcw,
  BookOpen,
  TrendingUp,
  Mic,
  AlertTriangle,
  UserCheck,
  UserX,
  UserMinus,
  Clock,
} from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  adminNote: string | null;
  speaker: { id: string; name: string; grade: string };
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
}

interface AttendanceData {
  id: number;
  userId: string;
  status: string;
  user: { id: string; name: string; grade: string };
}

interface AlertData {
  userId: string;
  userName: string;
  grade: string;
  consecutiveAbsences: number;
  alertLevel: 'warning' | 'danger';
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todaySession, setTodaySession] = useState<SessionData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if ((session?.user as { role?: string })?.role !== 'admin') {
      router.push('/home');
      return;
    }

    fetchData();
  }, [status, session, router]);

  async function fetchData() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's session
      const sessionsRes = await fetch(`/api/sessions?date=${today}`);
      const sessions = await sessionsRes.json();
      if (sessions.length > 0) {
        setTodaySession(sessions[0]);

        // Fetch attendance for today's session
        const attRes = await fetch(
          `/api/attendance?sessionId=${sessions[0].id}`
        );
        const attData = await attRes.json();
        setAttendance(attData);
      }

      // Fetch alerts
      const alertsRes = await fetch('/api/alerts');
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
          <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const earlyLeaveCount = attendance.filter(
    (a) => a.status === 'left_early'
  ).length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = DAY_LABELS[date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${day}）`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 animate-fade-in">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">
          運営ダッシュボード
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          朝礼の運営状況を一覧で確認できます
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Today's session + Attendance */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Session Card */}
          <Card className="border-brand-border shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                本日の朝礼
              </h2>
            </div>
            <CardContent className="p-6">
              {todaySession ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        日時
                      </p>
                      <p className="text-sm font-medium text-brand-text">
                        {formatDate(todaySession.date)}
                      </p>
                      <p className="text-sm text-brand-secondary flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {todaySession.startTime} 〜 {todaySession.endTime}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        フェーズ
                      </p>
                      <Badge
                        variant="secondary"
                        className="bg-brand-accent/10 text-brand-accent"
                      >
                        第{todaySession.phase.phaseNumber}フェーズ:{' '}
                        {todaySession.phase.name}
                      </Badge>
                    </div>
                  </div>

                  <Separator className="bg-brand-border" />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        主題
                      </p>
                      <p className="text-base font-semibold text-brand-primary flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-brand-accent" />
                        {todaySession.topic.topicText}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        第{todaySession.topic.weekNumber}週
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-4">
                      <p className="text-xs text-muted-foreground mb-1">
                        発話者
                      </p>
                      <p className="text-base font-semibold text-brand-primary flex items-center gap-2">
                        <Mic className="h-4 w-4 text-brand-accent" />
                        {todaySession.speaker.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {GRADE_LABELS[todaySession.speaker.grade] ||
                          todaySession.speaker.grade}
                      </p>
                    </div>
                  </div>

                  {todaySession.adminNote && (
                    <div className="rounded-lg border border-brand-warning/30 bg-amber-50 p-3">
                      <p className="text-xs font-medium text-brand-warning">
                        運営メモ
                      </p>
                      <p className="text-sm text-brand-text mt-1">
                        {todaySession.adminNote}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarDays className="mx-auto h-12 w-12 text-brand-border" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    本日の朝礼はありません
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Card */}
          {todaySession && (
            <Card className="border-brand-border shadow-md animate-slide-in">
              <CardHeader>
                <CardTitle className="text-lg text-brand-primary flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  出欠状況
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <UserCheck className="mx-auto h-5 w-5 text-brand-success" />
                    <p className="text-2xl font-bold text-brand-success mt-1">
                      {presentCount}
                    </p>
                    <p className="text-xs text-muted-foreground">出席</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                    <UserX className="mx-auto h-5 w-5 text-brand-danger" />
                    <p className="text-2xl font-bold text-brand-danger mt-1">
                      {absentCount}
                    </p>
                    <p className="text-xs text-muted-foreground">欠席</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                    <UserMinus className="mx-auto h-5 w-5 text-brand-warning" />
                    <p className="text-2xl font-bold text-brand-warning mt-1">
                      {earlyLeaveCount}
                    </p>
                    <p className="text-xs text-muted-foreground">途中退出</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {attendance.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-brand-border px-4 py-2.5 hover:bg-brand-bg/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            att.status === 'present'
                              ? 'bg-brand-success'
                              : att.status === 'absent'
                              ? 'bg-brand-danger'
                              : 'bg-brand-warning'
                          }`}
                        />
                        <span className="text-sm font-medium text-brand-text">
                          {att.user.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {GRADE_LABELS[att.user.grade] || att.user.grade}
                        </span>
                      </div>
                      <Badge
                        variant={
                          att.status === 'present' ? 'default' : 'destructive'
                        }
                        className={
                          att.status === 'present'
                            ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                            : att.status === 'absent'
                            ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20'
                            : 'bg-brand-warning/10 text-brand-warning border-brand-warning/20'
                        }
                      >
                        {att.status === 'present'
                          ? '出席'
                          : att.status === 'absent'
                          ? '欠席'
                          : '途中退出'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Alerts + Quick links */}
        <div className="space-y-6">
          {/* Alerts */}
          {alerts.length > 0 && (
            <Card className="border-brand-danger/30 shadow-md animate-slide-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-brand-danger flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  連続欠席アラート
                </CardTitle>
                <CardDescription>
                  連続で欠席している参加者がいます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.userId}
                      className={`rounded-lg border p-3 ${
                        alert.alertLevel === 'danger'
                          ? 'border-brand-danger/30 bg-red-50 animate-pulse-subtle'
                          : 'border-brand-warning/30 bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-brand-text">
                            {alert.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {GRADE_LABELS[alert.grade] || alert.grade}
                          </p>
                        </div>
                        <Badge
                          variant="destructive"
                          className={
                            alert.alertLevel === 'danger'
                              ? 'bg-brand-danger'
                              : 'bg-brand-warning'
                          }
                        >
                          {alert.consecutiveAbsences}回連続
                        </Badge>
                      </div>
                      {alert.consecutiveAbsences >= 3 && (
                        <p className="mt-2 text-xs text-brand-danger font-medium">
                          ⚠ 運営から接触を推奨します
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Access */}
          <Card className="border-brand-border shadow-md">
            <CardHeader>
              <CardTitle className="text-lg text-brand-primary">
                クイックアクセス
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link href="/rotation">
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col gap-2 py-4 border-brand-border hover:bg-brand-bg hover:border-brand-accent transition-all"
                >
                  <RotateCcw className="h-5 w-5 text-brand-accent" />
                  <span className="text-xs">輪番計画</span>
                </Button>
              </Link>
              <Link href="/calendar">
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col gap-2 py-4 border-brand-border hover:bg-brand-bg hover:border-brand-accent transition-all"
                >
                  <CalendarDays className="h-5 w-5 text-brand-accent" />
                  <span className="text-xs">カレンダー</span>
                </Button>
              </Link>
              <Link href="/members">
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col gap-2 py-4 border-brand-border hover:bg-brand-bg hover:border-brand-accent transition-all"
                >
                  <Users className="h-5 w-5 text-brand-accent" />
                  <span className="text-xs">参加者管理</span>
                </Button>
              </Link>
              <Link href="/phase">
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col gap-2 py-4 border-brand-border hover:bg-brand-bg hover:border-brand-accent transition-all"
                >
                  <TrendingUp className="h-5 w-5 text-brand-accent" />
                  <span className="text-xs">フェーズ進捗</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
