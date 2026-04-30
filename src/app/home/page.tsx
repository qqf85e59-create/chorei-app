'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays, BookOpen, Mic, Clock, FileText,
  UserMinus, History, MessageSquare,
  Video, AlertTriangle, ChevronRight, Bell,
} from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';
import { SpeechTimer } from '@/components/ui/timer';
import { NextCommentatorsCard } from '@/components/next-commentators-card';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  adminNote: string | null;
  speaker: { id: string; name: string; grade: string } | null;
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
  commentators?: { id: string; name: string; grade: string }[];
}

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}時間前`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}日前`;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todaySession, setTodaySession] = useState<SessionData | null>(null);
  const [nextSpeaking, setNextSpeaking] = useState<SessionData | null>(null);
  const [pastSpeaking, setPastSpeaking] = useState<SessionData[]>([]);
  const [meetingUrl, setMeetingUrl] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // loading 中は何もしない（セッション確立前に判断するとループする）
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    const hasConfirmed = localStorage.getItem('grandRuleConfirmed');
    if (!hasConfirmed) { router.push('/grand-rule'); return; }
    if (session?.user) fetchData();
  }, [status, session, router]);

  async function fetchData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const userId = session?.user?.id;
      const [urlRes, notiRes, sessionsRes, speakerRes] = await Promise.all([
        fetch('/api/config/meeting-url'),
        fetch('/api/notifications'),
        fetch(`/api/sessions?date=${today}`),
        userId ? fetch(`/api/sessions?speakerId=${userId}`) : Promise.resolve(null),
      ]);
      if (urlRes.ok) { const u = await urlRes.json(); setMeetingUrl(u.url); }
      if (notiRes.ok) { const n = await notiRes.json(); setNotifications(n.notifications || []); }
      const sessions = await sessionsRes.json();
      if (sessions.length > 0) setTodaySession(sessions[0]);
      if (speakerRes && speakerRes.ok) {
        const mySessions: SessionData[] = await speakerRes.json();
        const todayDate = new Date(); todayDate.setHours(0,0,0,0);
        const future = mySessions.filter(s => new Date(s.date) > todayDate && s.status === 'scheduled');
        if (future.length > 0) setNextSpeaking(future[0]);
        const past = mySessions.filter(s => new Date(s.date) <= todayDate);
        setPastSpeaking(past.slice(-3).reverse());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth()+1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`;
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
        <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 animate-fade-in">

        {/* Welcome */}
        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#E0E4EF]">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
            </p>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight">
              おはようございます、{session?.user?.name}さん
            </h1>
          </div>
          {todaySession && (
            <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs px-3 py-1">
              第{todaySession.phase.phaseNumber}フェーズ進行中
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {/* Today's session */}
          <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-4">
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />本日の朝礼
              </h2>
            </div>
            <CardContent className="p-6">
              {todaySession ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[#1E3A8A] font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {todaySession.startTime} 〜 {todaySession.endTime}
                    </div>
                    <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs">
                      第{todaySession.phase.phaseNumber}フェーズ · {todaySession.phase.name}
                    </Badge>
                  </div>

                  {meetingUrl && (
                    <div className="flex items-center justify-between bg-[#E8F2FB] border border-[#BDD9F5] rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-[#0057A0] font-semibold">
                        <Video className="h-4 w-4 text-[#0070CC]" />Web会議リンク
                      </div>
                      <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold text-[#0070CC] bg-white px-3 py-1.5 rounded-md border border-[#BDD9F5] no-underline shadow-sm">
                        参加する →
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">本日の主題</p>
                      <div className="flex items-start gap-2">
                        <BookOpen className="h-4 w-4 text-[#0070CC] shrink-0 mt-0.5" />
                        <span className="text-sm font-bold text-[#00135D] leading-snug">{todaySession.topic.topicText}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">第{todaySession.topic.weekNumber}週テーマ</p>
                    </div>
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">本日の発話者</p>
                      <div className="flex items-center gap-2">
                        <Mic className="h-4 w-4 text-[#0070CC] shrink-0" />
                        <span className="text-sm font-bold text-[#00135D]">
                          {todaySession.speaker?.name ?? '不在（延期）'}
                        </span>
                        {todaySession.speaker?.id === session?.user?.id && (
                          <Badge className="bg-[#00135D] text-white text-[10px] py-0 px-1.5">あなた</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {todaySession.speaker ? (GRADE_LABELS[todaySession.speaker.grade] || todaySession.speaker.grade) : ''}
                      </p>
                    </div>
                  </div>

                  {todaySession.commentators && todaySession.commentators.length > 0 && (
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2.5 flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />本日のコメンテーター
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {todaySession.commentators.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#00135D] flex items-center justify-center text-[10px] font-bold text-white shrink-0">{i+1}</span>
                            <div>
                              <p className="text-sm font-semibold text-[#1A1D23] leading-tight">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{GRADE_LABELS[c.grade] || c.grade}</p>
                            </div>
                            {c.id === session?.user?.id && (
                              <Badge className="bg-[#0070CC] text-white text-[10px] py-0 px-1.5">あなた</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {todaySession.adminNote && (
                    <div className="flex items-start gap-2 p-3 bg-[#E8F2FB] border border-[#BDD9F5] rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-[#0070CC] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#0070CC]">システム通知</p>
                        <p className="text-xs text-[#3D4252] mt-0.5">{todaySession.adminNote}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarDays className="mx-auto h-10 w-10 text-[#E0E4EF]" />
                  <p className="mt-3 text-sm text-muted-foreground">本日の朝礼はありません</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timer */}
          {todaySession && todaySession.status !== 'completed' && (
            <div className="animate-fade-in">
              <SpeechTimer defaultSeconds={180} />
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E0E4EF]">
                <p className="text-sm font-bold text-[#00135D] flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-[#0070CC]" />お知らせ
                </p>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} className={`flex items-start justify-between rounded-lg border px-4 py-3 ${
                    !n.readAt ? 'border-[#BDD9F5] bg-[#E8F2FB]' : 'border-[#E0E4EF] bg-white'
                  }`}>
                    <p className="text-sm text-[#1A1D23]">{n.message}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{formatTimeAgo(n.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Next commentators (Phase 2/3) */}
          <NextCommentatorsCard />

          {/* Next speaking */}
          {nextSpeaking && (
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-5">
                  <div className="w-11 h-11 rounded-xl bg-[#E8F2FB] flex items-center justify-center shrink-0">
                    <Mic className="h-5 w-5 text-[#0070CC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">あなたの次の発話予定</p>
                    <p className="text-sm font-bold text-[#00135D] tracking-tight">{formatDate(nextSpeaking.date)}</p>
                    <p className="text-xs text-[#1E3A8A] mt-1">主題：{nextSpeaking.topic.topicText}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past speaking */}
          {pastSpeaking.length > 0 && (
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E0E4EF]">
                <p className="text-sm font-semibold text-[#00135D] flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />過去の発話履歴
                </p>
              </div>
              <div>
                {pastSpeaking.map((s, i) => (
                  <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i < pastSpeaking.length-1 ? 'border-b border-[#E0E4EF]' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-[#1A1D23]">{formatDate(s.date)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.topic.topicText}</p>
                    </div>
                    <Badge variant="outline" className="border-[#E0E4EF] text-muted-foreground text-xs">完了</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Separator className="bg-[#E0E4EF]" />

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Link href="/absence">
              <button className="w-full flex flex-col items-center gap-2.5 py-5 px-3 border border-[#E0E4EF] rounded-xl bg-white cursor-pointer font-[inherit] text-xs text-[#3D4252] font-medium hover:bg-[#FEF2F2] hover:border-[#FCCACA] transition-all">
                <div className="w-9 h-9 rounded-[10px] bg-[#DC262614] flex items-center justify-center">
                  <UserMinus className="h-[18px] w-[18px] text-[#C0392B]" />
                </div>
                欠席・途中退出の申告
              </button>
            </Link>
            <Link href="/grand-rule">
              <button className="w-full flex flex-col items-center gap-2.5 py-5 px-3 border border-[#E0E4EF] rounded-xl bg-white cursor-pointer font-[inherit] text-xs text-[#3D4252] font-medium hover:bg-[#E8F2FB] hover:border-[#BDD9F5] transition-all">
                <div className="w-9 h-9 rounded-[10px] bg-[#0070CC14] flex items-center justify-center">
                  <FileText className="h-[18px] w-[18px] text-[#0070CC]" />
                </div>
                グランドルール確認
              </button>
            </Link>
            <Link href="/topics">
              <button className="w-full flex flex-col items-center gap-2.5 py-5 px-3 border border-[#E0E4EF] rounded-xl bg-white cursor-pointer font-[inherit] text-xs text-[#3D4252] font-medium hover:bg-[#E8F2FB] hover:border-[#BDD9F5] transition-all">
                <div className="w-9 h-9 rounded-[10px] bg-[#0070CC14] flex items-center justify-center">
                  <BookOpen className="h-[18px] w-[18px] text-[#0070CC]" />
                </div>
                主題カレンダー
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
