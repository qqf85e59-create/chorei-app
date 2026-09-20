'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, CheckCircle2, Circle, Calendar, Clock, Users, MessageCircle } from 'lucide-react';

interface PhaseData {
  id: number;
  phaseNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  sessionDurationMinutes: number;
  description: string | null;
  _count: { sessions: number };
  /** 実際に回がある期間。中断をはさんで再開した場合は複数になる。 */
  periods?: { start: string; end: string }[];
}

/** 表示・判定に使う期間（回が無いフェーズは登録上の開始〜終了日）。 */
function spanOf(p: PhaseData) {
  const periods = p.periods ?? [];
  if (periods.length === 0) return { start: new Date(p.startDate), end: new Date(p.endDate) };
  return { start: new Date(periods[0].start), end: new Date(periods[periods.length - 1].end) };
}

const fmtMD = (d: Date) => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;

/** 「2026年5月7日〜6月30日 / 9月18日〜2027年9月28日」のような表示にする。 */
function periodLabel(p: PhaseData) {
  const periods = p.periods ?? [];
  if (periods.length === 0) {
    const s = new Date(p.startDate), e = new Date(p.endDate);
    return `${s.getUTCFullYear()}年${fmtMD(s)}〜${fmtMD(e)}`;
  }
  return periods
    .map(({ start, end }) => {
      const s = new Date(start), e = new Date(end);
      const endLabel = e.getUTCFullYear() === s.getUTCFullYear() ? fmtMD(e) : `${e.getUTCFullYear()}年${fmtMD(e)}`;
      return `${s.getUTCFullYear()}年${fmtMD(s)}〜${endLabel}`;
    })
    .join(' ／ ');
}

const PHASE_CONFIG = [
  { gradient: 'from-[#00135D] to-[#1E3A8A]', accentColor: '#00135D', icon: Users },
  { gradient: 'from-[#065F46] to-[#047857]', accentColor: '#047857', icon: MessageCircle },
  { gradient: 'from-[#4C1D95] to-[#6D28D9]', accentColor: '#6D28D9', icon: TrendingUp },
];

export default function PhasePage() {
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  useEffect(() => {
    Promise.all([
      fetch('/api/phases').then(r => r.json()).then(setPhases),
      fetch('/api/users').then(r => r.json()).then((users: { id: string }[]) => setUserCount(users.length)),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  function getStatus(p: PhaseData): 'completed' | 'current' | 'upcoming' {
    const { start, end } = spanOf(p);
    if (now > end) return 'completed';
    if (now >= start) return 'current';
    return 'upcoming';
  }
  function getProgress(p: PhaseData) {
    const { start, end } = spanOf(p);
    const s = start.getTime(), e = end.getTime(), n = now.getTime();
    if (n < s) return 0; if (n > e) return 100;
    if (e === s) return 100;
    return Math.round((n - s) / (e - s) * 100);
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[900px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="mb-7 pb-5 border-b border-[#E0E4EF]">
          <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />フェーズ進捗
          </h1>
          <p className="text-sm text-muted-foreground mt-1">朝礼プログラムの全体像と現在地を確認できます</p>
        </div>

        {/* Timeline */}
        <div className="flex items-center justify-center px-10 mb-8">
          {phases.map((phase, i) => {
            const status = getStatus(phase);
            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                    status==='completed' ? 'bg-[#047857]' :
                    status==='current'   ? 'bg-[#00135D] shadow-[0_0_0_6px_rgba(0,19,93,0.15)]' :
                    'bg-[#E0E4EF]'
                  }`}>
                    {status==='completed' ? <CheckCircle2 className="h-5 w-5 text-white" /> :
                     status==='current'   ? <span className="text-sm font-bold text-white">{phase.phaseNumber}</span> :
                     <Circle className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <p className={`text-[11px] font-semibold whitespace-nowrap ${status==='current'?'text-[#00135D]':'text-muted-foreground'}`}>
                    第{phase.phaseNumber}フェーズ
                  </p>
                </div>
                {i < phases.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${status==='completed'?'bg-[#047857]':'bg-[#E0E4EF]'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Phase cards */}
        <div className="flex flex-col gap-5">
          {phases.map((phase, i) => {
            const status = getStatus(phase);
            const progress = getProgress(phase);
            const cfg = PHASE_CONFIG[i] || PHASE_CONFIG[0];
            const IconComponent = cfg.icon;
            const { start: s, end: e } = spanOf(phase);
            return (
              <Card key={phase.id}
                className={`border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden transition-all ${status==='current'?'shadow-[0_4px_20px_rgba(0,19,93,0.15)]':''}`}>
                <div className={`bg-gradient-to-r ${cfg.gradient} px-6 py-5 flex items-center justify-between relative overflow-hidden`}>
                  <div className="absolute top-[-20px] right-[-20px] w-24 h-24 rounded-full bg-white/[0.06]" />
                  <div className="flex items-center gap-3.5 relative">
                    <div className="bg-white/[0.18] rounded-xl p-2.5">
                      <IconComponent className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white tracking-tight">第{phase.phaseNumber}フェーズ：{phase.name}</p>
                      <p className="text-xs text-white/70 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {periodLabel(phase)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    status==='current' ? 'bg-white text-[#00135D]' :
                    status==='completed' ? 'bg-white/20 text-white' :
                    'bg-white/10 text-white/70'
                  }`}>
                    {status==='completed'?'完了':status==='current'?'進行中':'予定'}
                  </span>
                </div>
                <CardContent className="p-6">
                  {phase.description && (
                    <p className="text-sm text-[#3D4252] leading-relaxed mb-5">{phase.description}</p>
                  )}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label:'分/回', value:phase.sessionDurationMinutes, icon:Clock },
                      { label:'回予定', value:phase._count.sessions, icon:Calendar },
                      { label:'進捗', value:`${progress}%`, icon:TrendingUp },
                      { label:'参加者', value:userCount, icon:Users },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-xl p-3 text-center">
                        <Icon className="h-4 w-4 text-[#0070CC] mx-auto mb-1.5" />
                        <p className="text-[20px] font-bold text-[#00135D] leading-none">{value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{s.getUTCMonth()+1}/{s.getUTCDate()}</span>
                      <span className="font-semibold">{progress}% 完了</span>
                      <span>{e.getMonth()+1}/{e.getDate()}</span>
                    </div>
                    <div className="h-2 bg-[#E0E4EF] rounded-full overflow-hidden">
                      <div style={{ width:`${progress}%`, background:cfg.accentColor }} className="h-full rounded-full transition-all duration-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
