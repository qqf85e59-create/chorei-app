'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays, Users, RotateCcw, BookOpen, TrendingUp, Mic,
  AlertTriangle, UserCheck, UserX, UserMinus, Clock, Dices,
  MessageSquare, FileText, Video,
} from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS, GRAND_RULE_TEXT } from '@/lib/constants';
import { SpeechTimer } from '@/components/ui/timer';
import { NextCommentatorsCard } from '@/components/next-commentators-card';

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
  commentators?: { id: string; name: string; grade: string }[];
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
  const [meetingUrl, setMeetingUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if ((session?.user as { role?: string })?.role !== 'admin') { router.push('/home'); return; }
    fetchData();
  }, [status, session, router]);

  async function fetchData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [urlRes, sessionsRes, alertsRes] = await Promise.all([
        fetch('/api/config/meeting-url'),
        fetch(`/api/sessions?date=${today}`),
        fetch('/api/alerts'),
      ]);
      if (urlRes.ok) { const u = await urlRes.json(); setMeetingUrl(u.url); }
      const sessions = await sessionsRes.json();
      if (sessions.length > 0) {
        setTodaySession(sessions[0]);
        const attRes = await fetch(`/api/attendance?sessionId=${sessions[0].id}`);
        setAttendance(await attRes.json());
      }
      setAlerts(await alertsRes.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function generateCommentators() {
    if (!todaySession) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/sessions/commentators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: todaySession.id, count: 2 }),
      });
      if (res.ok) setTodaySession({ ...todaySession, commentators: await res.json() });
      else alert('抽選に失敗しました。対象の出席者が不足している可能性があります。');
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`;
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
        <p className="mt-3 text-sm text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  );

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount  = attendance.filter(a => a.status === 'absent').length;
  const earlyCount   = attendance.filter(a => a.status === 'left_early').length;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[1360px] px-4 py-7 sm:px-6 animate-fade-in">

        {/* Page header */}
        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#E0E4EF]">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
            </p>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight">運営ダッシュボード</h1>
          </div>
          {todaySession && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#047857]" />
              <span className="text-xs text-[#047857] font-semibold">本日の朝礼あり</span>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3 items-start">

          {/* ── LEFT: Session + Next commentators + Attendance ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Today's session card */}
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-4">
                <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />本日の朝礼
                </h2>
              </div>
              <CardContent className="p-6 space-y-4">
                {todaySession ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">日時</p>
                        <p className="text-sm font-semibold text-[#1A1D23]">{formatDate(todaySession.date)}</p>
                        <p className="text-xs text-[#1E3A8A] flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />{todaySession.startTime} 〜 {todaySession.endTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1.5">フェーズ</p>
                        <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs">
                          第{todaySession.phase.phaseNumber}フェーズ · {todaySession.phase.name}
                        </Badge>
                      </div>
                    </div>

                    {meetingUrl && (
                      <div className="flex items-center justify-between bg-[#E8F2FB] border border-[#BDD9F5] rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2 text-sm text-[#0057A0] font-semibold">
                          <Video className="h-4 w-4 text-[#0070CC]" />Web会議リンク
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-bold text-[#0070CC] bg-white px-3 py-1.5 rounded-md border border-[#BDD9F5] no-underline">
                            参加する →
                          </a>
                          <Link href="/settings/meeting-url">
                            <Button variant="outline" size="sm" className="h-7 text-xs border-[#E0E4EF]">編集</Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">主題</p>
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-[#0070CC] shrink-0 mt-0.5" />
                          <span className="text-sm font-bold text-[#00135D] leading-snug">{todaySession.topic.topicText}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">第{todaySession.topic.weekNumber}週</p>
                      </div>
                      <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-2">発話者</p>
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-[#0070CC] shrink-0" />
                          <span className="text-sm font-bold text-[#00135D]">{todaySession.speaker?.name ?? '不在（延期）'}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {todaySession.speaker ? (GRADE_LABELS[todaySession.speaker.grade] || todaySession.speaker.grade) : ''}
                        </p>
                      </div>
                    </div>

                    {todaySession.adminNote && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-700">運営メモ</p>
                        <p className="text-xs text-amber-900 mt-0.5">{todaySession.adminNote}</p>
                      </div>
                    )}

                    <Separator className="bg-[#E0E4EF]" />

                    {/* Commentator lottery */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" />コメンテーター（ランダム指名）
                        </p>
                        <Button size="sm" variant="outline" onClick={generateCommentators}
                          disabled={generating || todaySession.status === 'completed'}
                          className="h-7 text-xs border-[#BDD9F5] text-[#0070CC] hover:bg-[#E8F2FB]">
                          <Dices className={`h-3.5 w-3.5 mr-1 ${generating ? 'animate-spin' : ''}`} />
                          {todaySession.commentators && todaySession.commentators.length > 0 ? '再抽選する' : '抽選する'}
                        </Button>
                      </div>
                      {todaySession.commentators && todaySession.commentators.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {todaySession.commentators.map((c, i) => (
                            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FC] border border-[#E0E4EF]">
                              <div className="flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-[#00135D] flex items-center justify-center text-[10px] font-bold text-white">{i+1}</span>
                                <span className="font-semibold text-sm text-[#1A1D23]">{c.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{GRADE_LABELS[c.grade] || c.grade}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-14 border-2 border-dashed border-[#E0E4EF] rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                          未定（抽選してください）
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <CalendarDays className="mx-auto h-12 w-12 text-[#E0E4EF]" />
                    <p className="mt-3 text-sm text-muted-foreground">本日の朝礼はありません</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next commentators */}
            <NextCommentatorsCard />

            {/* Attendance */}
            {todaySession && (
              <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E0E4EF]">
                  <h3 className="text-sm font-bold text-[#00135D] flex items-center gap-2">
                    <Users className="h-4 w-4" />出欠状況
                  </h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label:'出席', count:presentCount, color:'#047857', bg:'#ECFDF5', icon:<UserCheck className="h-4 w-4" /> },
                      { label:'欠席', count:absentCount,  color:'#C0392B', bg:'#FEF2F2', icon:<UserX className="h-4 w-4" /> },
                      { label:'途中退出', count:earlyCount, color:'#B45309', bg:'#FFFBEB', icon:<UserMinus className="h-4 w-4" /> },
                    ].map(({ label, count, color, bg, icon }) => (
                      <div key={label} style={{ background:bg }} className="rounded-lg p-3 flex items-center gap-3">
                        <div style={{ color }} className="shrink-0">{icon}</div>
                        <div>
                          <p style={{ color }} className="text-xl font-bold leading-none">{count}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {attendance.map(att => (
                      <div key={att.id} className="flex items-center justify-between border border-[#E0E4EF] rounded-lg px-4 py-2.5 bg-white">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${att.status==='present'?'bg-[#047857]':att.status==='absent'?'bg-[#C0392B]':'bg-[#B45309]'}`} />
                          <span className="text-sm font-medium text-[#1A1D23]">{att.user.name}</span>
                          <span className="text-xs text-muted-foreground">{GRADE_LABELS[att.user.grade] || att.user.grade}</span>
                        </div>
                        <Badge className={
                          att.status==='present' ? 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' :
                          att.status==='absent'  ? 'bg-[#FEE8E8] text-[#C0392B] border-[#FCCACA]' :
                          'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                        }>
                          {att.status==='present'?'出席':att.status==='absent'?'欠席':'途中退出'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-5">

            {/* Timer */}
            {todaySession && (
              <div className="animate-fade-in">
                <SpeechTimer defaultSeconds={180} />
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <Card className="border-[#FCCACA] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 bg-[#FFF5F5] border-b border-[#FCCACA]">
                  <h3 className="text-sm font-bold text-[#C0392B] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />連続欠席アラート
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">連続で欠席している参加者がいます</p>
                </div>
                <CardContent className="p-4 space-y-2.5">
                  {alerts.map(alert => (
                    <div key={alert.userId} className={`p-3 rounded-lg border ${alert.alertLevel==='danger'?'bg-[#FEF2F2] border-[#FCCACA]':'bg-[#FFFBEB] border-[#FDE68A]'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1D23]">{alert.userName}</p>
                          <p className="text-xs text-muted-foreground">{GRADE_LABELS[alert.grade] || alert.grade}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md text-white ${alert.alertLevel==='danger'?'bg-[#C0392B]':'bg-[#B45309]'}`}>
                          {alert.consecutiveAbsences}回連続
                        </span>
                      </div>
                      {alert.consecutiveAbsences >= 3 && (
                        <p className="text-xs text-[#C0392B] font-semibold mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />運営から接触を推奨します
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick access */}
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E0E4EF]">
                <h3 className="text-sm font-bold text-[#00135D]">クイックアクセス</h3>
              </div>
              <CardContent className="p-4 grid grid-cols-2 gap-2.5">
                {[
                  { label:'輪番計画', icon:<RotateCcw className="h-[18px] w-[18px] text-[#0070CC]" />, href:'/rotation' },
                  { label:'カレンダー', icon:<CalendarDays className="h-[18px] w-[18px] text-[#0070CC]" />, href:'/calendar' },
                  { label:'参加者管理', icon:<Users className="h-[18px] w-[18px] text-[#0070CC]" />, href:'/members' },
                  { label:'フェーズ進捗', icon:<TrendingUp className="h-[18px] w-[18px] text-[#0070CC]" />, href:'/phase' },
                ].map(({ label, icon, href }) => (
                  <Link key={label} href={href}>
                    <button className="w-full flex flex-col items-center gap-2 py-3.5 border border-[#E0E4EF] rounded-lg bg-white cursor-pointer font-[inherit] text-[11px] text-[#3D4252] hover:bg-[#E8F2FB] hover:border-[#BDD9F5] transition-all">
                      <div className="w-8 h-8 rounded-lg bg-[#E8F2FB] flex items-center justify-center">{icon}</div>
                      {label}
                    </button>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Grand rule */}
            <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-[#F8F9FC] border-b border-[#E0E4EF]">
                <h3 className="text-sm font-bold text-[#00135D] flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0070CC]" />グランドルール（確認用）
                </h3>
              </div>
              <CardContent className="p-4 space-y-3">
                {GRAND_RULE_TEXT.split('\n\n').filter(Boolean).slice(2).map((rule, i) => {
                  const lines = rule.split('\n').filter(Boolean);
                  const commaIdx = lines[0].indexOf('、');
                  const title = commaIdx > 0 ? lines[0].substring(0, commaIdx) : lines[0];
                  const body = lines.map(l => l.startsWith(title) ? l.replace(title + '、', '') : l).join(' ');
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-[#F5F7FA] border border-[#E0E4EF] flex items-center justify-center text-[10px] font-bold text-[#00135D] shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-xs font-bold text-[#00135D] mb-0.5">{title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
