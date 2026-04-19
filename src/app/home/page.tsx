'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays,
  BookOpen,
  Mic,
  Clock,
  FileText,
  UserMinus,
  History,
  ArrowRight,
  MessageSquare,
  Video,
} from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';
import { SpeechTimer } from '@/components/ui/timer';

const ZOOM_URL = "https://zoom.us/j/1234567890"; // 仮のURL: 実運用に合わせて変更してください

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  speaker: { id: string; name: string; grade: string };
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
  commentators?: { id: string; name: string; grade: string }[];
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todaySession, setTodaySession] = useState<SessionData | null>(null);
  const [nextSpeaking, setNextSpeaking] = useState<SessionData | null>(null);
  const [pastSpeaking, setPastSpeaking] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    // Check grand rule confirmation
    const hasConfirmed = localStorage.getItem('grandRuleConfirmed');
    if (!hasConfirmed) {
      router.push('/grand-rule');
      return;
    }

    if (session?.user) {
      fetchData();
    }
  }, [status, session, router]);

  async function fetchData() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's session
      const sessionsRes = await fetch(`/api/sessions?date=${today}`);
      const sessions = await sessionsRes.json();
      if (sessions.length > 0) {
        setTodaySession(sessions[0]);
      }

      // Fetch all sessions to find next speaking and past speaking
      const allRes = await fetch('/api/sessions');
      const allSessions: SessionData[] = await allRes.json();
      const userId = session?.user?.id;

      if (userId) {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        // Next speaking assignment
        const futureSpeaking = allSessions.filter(
          (s) =>
            s.speaker.id === userId &&
            new Date(s.date) > todayDate &&
            s.status === 'scheduled'
        );
        if (futureSpeaking.length > 0) {
          setNextSpeaking(futureSpeaking[0]);
        }

        // Past speaking (last 3)
        const pastSpeakingAll = allSessions.filter(
          (s) =>
            s.speaker.id === userId &&
            new Date(s.date) <= todayDate
        );
        setPastSpeaking(pastSpeakingAll.slice(-3).reverse());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = DAY_LABELS[date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日（${day}）`;
  };

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">
          おはようございます、{session?.user?.name}さん
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      <div className="space-y-6">
        {/* Today's Session */}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-brand-secondary">
                    <Clock className="h-4 w-4" />
                    <span>
                      {todaySession.startTime} 〜 {todaySession.endTime}
                    </span>
                  </div>
                  <Badge className="bg-brand-accent/10 text-brand-accent border-brand-accent/20">
                    第{todaySession.phase.phaseNumber}フェーズ
                  </Badge>
                </div>

                <div className="flex items-center justify-between bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Video className="h-4 w-4" />
                    <span className="font-semibold">Zoomリンク</span>
                  </div>
                  <a
                    href={ZOOM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 bg-white rounded shadow-sm border border-blue-200"
                  >
                    ミーティングに参加
                  </a>
                </div>

                <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">主題</p>
                  <p className="text-lg font-semibold text-brand-primary flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-brand-accent" />
                    {todaySession.topic.topicText}
                  </p>
                </div>

                <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">発話者</p>
                  <p className="text-lg font-semibold text-brand-primary flex items-center gap-2">
                    <Mic className="h-5 w-5 text-brand-accent" />
                    {todaySession.speaker.name}
                    {todaySession.speaker.id === session?.user?.id && (
                      <Badge className="bg-brand-primary text-white ml-2">
                        あなたです
                      </Badge>
                    )}
                  </p>
                </div>

                {todaySession.commentators && todaySession.commentators.length > 0 && (
                  <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-4 animate-fade-in">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      本日のコメンテーター
                    </p>
                    <div className="flex flex-col gap-2">
                      {todaySession.commentators.map((c, idx) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <Badge className="bg-brand-primary text-white h-5 w-5 rounded-full p-0 flex items-center justify-center">{idx + 1}</Badge>
                          <span className="font-medium text-brand-text">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{GRADE_LABELS[c.grade] || c.grade}</span>
                          {c.id === session?.user?.id && (
                            <Badge className="bg-brand-accent text-white ml-2 text-[10px] h-4">あなたです</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <CalendarDays className="mx-auto h-10 w-10 text-brand-border" />
                <p className="mt-3 text-sm text-muted-foreground">
                  本日の朝礼はありません
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timer */}
        {todaySession && todaySession.status !== 'completed' && (
          <div className="animate-slide-in" style={{ animationDelay: '100ms' }}>
            <SpeechTimer defaultSeconds={180} />
          </div>
        )}

        {/* Next Speaking */}
        {nextSpeaking && (
          <Card className="border-brand-border shadow-md animate-slide-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-brand-primary flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-brand-accent" />
                あなたの次の発話予定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-brand-accent/20 bg-blue-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-brand-primary">
                    {formatDate(nextSpeaking.date)}
                  </p>
                  <p className="text-sm text-brand-secondary mt-1">
                    主題：{nextSpeaking.topic.topicText}
                  </p>
                </div>
                <Mic className="h-8 w-8 text-brand-accent/40" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Speaking History */}
        {pastSpeaking.length > 0 && (
          <Card className="border-brand-border shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-brand-primary flex items-center gap-2">
                <History className="h-4 w-4 text-brand-accent" />
                過去の発話履歴
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pastSpeaking.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-brand-border px-4 py-3 hover:bg-brand-bg/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-text">
                        {formatDate(s.date)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.topic.topicText}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-brand-border text-muted-foreground"
                    >
                      完了
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="bg-brand-border" />

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/absence">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-5 border-brand-border hover:bg-red-50 hover:border-brand-danger/30 transition-all"
            >
              <UserMinus className="h-5 w-5 text-brand-danger" />
              <span className="text-sm">欠席・途中退出の申告</span>
            </Button>
          </Link>
          <Link href="/grand-rule">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-5 border-brand-border hover:bg-brand-bg hover:border-brand-accent/30 transition-all"
            >
              <FileText className="h-5 w-5 text-brand-accent" />
              <span className="text-sm">グランドルール</span>
            </Button>
          </Link>
          <Link href="/topics">
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-2 py-5 border-brand-border hover:bg-brand-bg hover:border-brand-accent/30 transition-all"
            >
              <BookOpen className="h-5 w-5 text-brand-accent" />
              <span className="text-sm">主題カレンダー</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
