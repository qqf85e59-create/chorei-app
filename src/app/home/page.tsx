'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Video, AlertTriangle, ChevronRight, Bell, Users, TrendingUp,
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

interface CommentOrderItem {
  id: string;
  name: string;
  grade: string;
  status: 'present' | 'absent' | 'unspoken' | 'leave_early';
  commentPosition: number | null;
}

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface PhaseInfo {
  id: number;
  phaseNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  description: string | null;
  _count: { sessions: number };
}

/** フェーズごとの進行フロー（静的定義） */
const PHASE_FLOW: Record<number, { label: string; time: string; detail: string }[]> = {
  1: [
    { label: '冒頭',     time: '30秒',    detail: '運営が発話者・主題を告知' },
    { label: '発話',     time: '5分',     detail: '発話者が主題について話す' },
    { label: '関心表明', time: '2分',     detail: '聴取者7名が15〜20秒ずつ「関心を持った一点」を述べる' },
    { label: '締め',     time: '1分30秒', detail: '運営が締めの挨拶、次回の告知' },
  ],
  2: [
    { label: '冒頭',               time: '30秒',     detail: '運営が発話者A・応答者B・主題を告知' },
    { label: '発話A',              time: '6分',      detail: '発話者Aが主題について話す' },
    { label: '問いを置くB',        time: '2分',      detail: '応答者Bが自分の中に生まれた問いを場に置く' },
    { label: 'Aの応答（任意）',    time: '2〜3分',   detail: 'Aが応えたい場合のみ応える' },
    { label: '聴取者6名の感想（任意）', time: '3〜4分', detail: 'チャットまたは口頭で、任意で感想を残す' },
    { label: '締め',               time: '30秒〜1分', detail: '運営が締めの挨拶、次回の告知' },
  ],
};

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

const STATUS_LABEL: Record<string, string> = {
  absent:      '欠席',
  unspoken:    '聴講のみ',
  leave_early: '途中退出',
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [todaySession, setTodaySession] = useState<SessionData | null>(null);
  const [nextSpeaking, setNextSpeaking] = useState<SessionData | null>(null);
  const [pastSpeaking, setPastSpeaking] = useState<SessionData[]>([]);
  const [meetingUrl, setMeetingUrl] = useState<string>('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [commentOrder, setCommentOrder] = useState<CommentOrderItem[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionData[]>([]);
  const [upcomingCommentOrders, setUpcomingCommentOrders] = useState<Record<number, CommentOrderItem[]>>({});
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // ── コメント順を取得（Phase 1 専用） ──────────────
  const fetchCommentOrder = useCallback(async (sessionId: number) => {
    try {
      const res = await fetch(`/api/sessions/comment-order?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCommentOrder(data.commentOrder || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    const hasConfirmed = localStorage.getItem('grandRuleConfirmed');
    if (!hasConfirmed) { router.push('/grand-rule'); return; }
    if (session?.user) fetchData();
  }, [status, session, router]);

  // Phase 1 のセッションが確定したらコメント順を取得 + 30s ポーリング
  useEffect(() => {
    if (!todaySession || todaySession.phase.phaseNumber !== 1) return;
    fetchCommentOrder(todaySession.id);
    const timer = setInterval(() => fetchCommentOrder(todaySession.id), 30_000);
    return () => clearInterval(timer);
  }, [todaySession, fetchCommentOrder]);

  async function fetchData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const userId = session?.user?.id;
      const [urlRes, notiRes, sessionsRes, speakerRes, scheduledRes, phasesRes] = await Promise.all([
        fetch('/api/config/meeting-url'),
        fetch('/api/notifications'),
        fetch(`/api/sessions?date=${today}`),
        userId ? fetch(`/api/sessions?speakerId=${userId}`) : Promise.resolve(null),
        fetch('/api/sessions?status=scheduled'),
        fetch('/api/phases'),
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
      // 次回以降3件（今日より後のスケジュール済みセッション）
      if (scheduledRes.ok) {
        const allScheduled: SessionData[] = await scheduledRes.json();
        const upcoming = allScheduled
          .filter(s => s.date.split('T')[0] > today)
          .slice(0, 3);
        setUpcomingSessions(upcoming);
        // Phase 1 の次回セッションはコメント順を事前取得
        const phase1Upcoming = upcoming.filter(s => s.phase.phaseNumber === 1);
        const orders: Record<number, CommentOrderItem[]> = {};
        await Promise.all(phase1Upcoming.map(async (s) => {
          const r = await fetch(`/api/sessions/comment-order?sessionId=${s.id}`);
          if (r.ok) {
            const d = await r.json();
            orders[s.id] = d.commentOrder || [];
          }
        }));
        setUpcomingCommentOrders(orders);
      }
      if (phasesRes.ok) {
        const phases: PhaseInfo[] = await phasesRes.json();
        setPhaseInfo(phases);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getUTCMonth()+1}月${d.getUTCDate()}日（${DAY_LABELS[d.getUTCDay()]}）`;
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
        <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  );

  const isPhase1 = todaySession?.phase.phaseNumber === 1;
  const isPhase2Plus = todaySession && todaySession.phase.phaseNumber >= 2;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 animate-fade-in">

        {/* Welcome */}
        <div className="mb-6 pb-5 border-b border-[#E0E4EF]">
          <p className="text-xs text-muted-foreground font-medium mb-1">
            {new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
          </p>
          <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight">
            おはようございます、{session?.user?.name}さん
          </h1>
        </div>

        <div className="space-y-4">
          {/* ── フェーズ進行情報（現在フェーズのみ） ── */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const activePhase = phaseInfo.find(ph =>
              ph.startDate.split('T')[0] <= todayStr &&
              ph.endDate.split('T')[0] >= todayStr
            );
            if (!activePhase) return null;
            const flow = PHASE_FLOW[activePhase.phaseNumber] ?? [];
            const start = new Date(activePhase.startDate);
            const end = new Date(activePhase.endDate);
            const startStr = `${start.getUTCMonth()+1}月${start.getUTCDate()}日`;
            const endStr = `${end.getUTCMonth()+1}月${end.getUTCDate()}日`;
            return (
              <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E0E4EF] flex items-center justify-between">
                  <p className="text-sm font-bold text-[#00135D] flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-[#0070CC]" />
                    第{activePhase.phaseNumber}フェーズ · {activePhase.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#0070CC] text-white text-[10px] px-2 py-0">進行中</Badge>
                    <span className="text-[10px] text-muted-foreground">{startStr}〜{endStr}　全{activePhase._count.sessions}回</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {activePhase.description && (
                    <p className="text-xs text-[#3D4252] leading-relaxed">{activePhase.description}</p>
                  )}
                  {flow.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">進行フロー</p>
                      <div className="relative border border-[#E0E4EF] rounded-lg overflow-hidden">
                        <div className="grid grid-cols-[5rem_3.5rem_1fr] bg-[#F0F2F8] border-b border-[#E0E4EF]">
                          <span className="px-2.5 py-1.5 text-[10px] font-bold text-[#3D4252]">区分</span>
                          <span className="px-2 py-1.5 text-[10px] font-bold text-[#3D4252]">時間</span>
                          <span className="px-2.5 py-1.5 text-[10px] font-bold text-[#3D4252]">内容</span>
                        </div>
                        {flow.map((step, i) => (
                          <div key={i} className={`grid grid-cols-[5rem_3.5rem_1fr] ${i < flow.length-1 ? 'border-b border-[#E0E4EF]' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FC]'}`}>
                            <span className="px-2.5 py-2 text-[11px] font-semibold text-[#00135D] leading-snug flex items-center">{step.label}</span>
                            <span className="px-2 py-2 text-[11px] text-[#0070CC] font-medium leading-snug flex items-center whitespace-nowrap">{step.time}</span>
                            <span className="px-2.5 py-2 text-[11px] text-[#3D4252] leading-snug flex items-center">{step.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* Today's session */}
          <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />本日の朝礼
              </h2>
              <Link href="/absence">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                  <UserMinus className="h-3 w-3" />欠席申告
                </div>
              </Link>
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

                  {/* ── Phase 1: コメント順 ── */}
                  {isPhase1 && commentOrder.length > 0 && (
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-3 flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" />コメント順（発話者以外全員）
                      </p>
                      <div className="flex flex-col gap-2">
                        {commentOrder.map(c => {
                          const isInactive = c.status === 'absent' || c.status === 'unspoken';
                          const isMe = c.id === session?.user?.id;
                          return (
                            <div
                              key={c.id}
                              className={`flex items-center gap-2.5 transition-opacity ${isInactive ? 'opacity-40' : ''}`}
                            >
                              {/* 順番バッジ */}
                              {c.commentPosition !== null ? (
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                  isMe
                                    ? 'bg-[#0070CC] text-white'
                                    : 'bg-[#00135D] text-white'
                                }`}>
                                  {c.commentPosition}
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full bg-[#E0E4EF] flex items-center justify-center shrink-0">
                                  <span className="text-[10px] text-muted-foreground font-bold">–</span>
                                </span>
                              )}
                              {/* 名前 */}
                              <span className={`text-sm font-semibold ${isMe ? 'text-[#0070CC]' : 'text-[#1A1D23]'}`}>
                                {c.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {GRADE_LABELS[c.grade] || c.grade}
                              </span>
                              {isMe && (
                                <Badge className="bg-[#0070CC] text-white text-[10px] py-0 px-1.5">あなた</Badge>
                              )}
                              {c.status !== 'present' && (
                                <Badge className={`text-[10px] py-0 px-1.5 ${
                                  c.status === 'absent'
                                    ? 'bg-[#FEF2F2] text-[#C0392B] border border-[#FCCACA]'
                                    : 'bg-[#F8F9FC] text-muted-foreground border border-[#E0E4EF]'
                                }`}>
                                  {STATUS_LABEL[c.status] ?? c.status}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                        ※ 欠席・聴講のみの方は自動的にスキップされます。30秒ごとに自動更新。
                      </p>
                    </div>
                  )}

                  {/* ── Phase 2+: 本日の応答者 ── */}
                  {isPhase2Plus && todaySession.commentators && todaySession.commentators.length > 0 && (
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2.5 flex items-center gap-1.5">
                        <Users className="h-3 w-3" />本日の応答者
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {todaySession.commentators.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#00135D] flex items-center justify-center text-[11px] font-bold text-white shrink-0">{i+1}</span>
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

          {/* Timer（常時表示） */}
          <SpeechTimer defaultSeconds={180} />

          {/* ── 次回の予定 ── */}
          {upcomingSessions[0] && (() => {
            const s = upcomingSessions[0];
            const isP1 = s.phase.phaseNumber === 1;
            const isP2 = s.phase.phaseNumber >= 2;
            const order = upcomingCommentOrders[s.id] || [];
            return (
              <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
                <div className="bg-[#F0F4FF] px-5 py-3 border-b border-[#E0E4EF] flex items-center justify-between">
                  <p className="text-[12px] font-bold text-[#00135D] flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />次回の予定
                  </p>
                  <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-[10px]">
                    第{s.phase.phaseNumber}フェーズ
                  </Badge>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#00135D]">{formatDate(s.date)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.startTime}〜{s.endTime}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">発話者</p>
                      <div className="flex items-center gap-1.5">
                        <Mic className="h-3 w-3 text-[#0070CC] shrink-0" />
                        <span className="text-xs font-semibold text-[#00135D] truncate">{s.speaker?.name ?? '未定'}</span>
                        {s.speaker?.id === session?.user?.id && (
                          <Badge className="bg-[#00135D] text-white text-[9px] py-0 px-1 shrink-0">あなた</Badge>
                        )}
                      </div>
                    </div>
                    <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">主題</p>
                      <div className="flex items-start gap-1.5">
                        <BookOpen className="h-3 w-3 text-[#0070CC] shrink-0 mt-0.5" />
                        <span className="text-xs font-semibold text-[#00135D] leading-snug line-clamp-2">{s.topic.topicText}</span>
                      </div>
                    </div>
                  </div>
                  {/* Phase 1: コメント順（予定） */}
                  {isP1 && order.length > 0 && (
                    <div className="mt-3 bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />コメント順（予定）
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {order.filter(c => c.commentPosition !== null).map(c => {
                          const isMe = c.id === session?.user?.id;
                          return (
                            <div key={c.id} className="flex items-center gap-1">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${isMe ? 'bg-[#0070CC] text-white' : 'bg-[#00135D] text-white'}`}>
                                {c.commentPosition}
                              </span>
                              <span className={`text-xs font-medium ${isMe ? 'text-[#0070CC]' : 'text-[#1A1D23]'}`}>{c.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Phase 2: 応答者 */}
                  {isP2 && s.commentators && s.commentators.length > 0 && (
                    <div className="mt-3 bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" />応答者
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {s.commentators.map(c => (
                          <div key={c.id} className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#1A1D23]">{c.name}</span>
                            {c.id === session?.user?.id && (
                              <Badge className="bg-[#0070CC] text-white text-[9px] py-0 px-1">あなた</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* ── あなたの次の発話予定 ── */}
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

          {/* Next commentators / respondent (Phase 2/3) */}
          <NextCommentatorsCard />

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
          <div className="grid grid-cols-2 gap-3">
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
