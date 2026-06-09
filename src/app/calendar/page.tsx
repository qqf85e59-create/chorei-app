'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, ChevronLeft, ChevronRight, Mic, BookOpen } from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  speaker: { id: string; name: string; grade: string };
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
}

interface HolidayData {
  id: number;
  date: string;
  name: string;
  isActive: boolean;
}

export default function CalendarPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [holidays, setHolidays] = useState<HolidayData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [sessionsRes, holidaysRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/holidays?year=' + new Date().getFullYear()),
      ]);
      const sd = await sessionsRes.json();
      const hd = await holidaysRes.json();
      if (Array.isArray(sd)) setSessions(sd);
      if (Array.isArray(hd)) setHolidays(hd);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const holidayMap = new Map(holidays.map(h => [new Date(h.date).toISOString().split('T')[0], h]));
  const sessionsByDate = new Map<string, SessionData[]>();
  sessions.forEach(s => {
    const k = new Date(s.date).toISOString().split('T')[0];
    sessionsByDate.set(k, [...(sessionsByDate.get(k) || []), s]);
  });

  function getWeekDates() {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d); dd.setDate(dd.getDate() + i); return dd;
    });
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#E0E4EF]">
          <div>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />カレンダー
            </h1>
            <p className="text-sm text-muted-foreground mt-1">朝礼の予定を確認できます</p>
          </div>
          <div className="flex border border-[#E0E4EF] rounded-lg overflow-hidden">
            {(['month', 'week'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3.5 py-1.5 text-xs font-medium border-none cursor-pointer font-[inherit] transition-colors ${viewMode === m ? 'bg-[#00135D] text-white' : 'bg-white text-[#3D4252] hover:bg-[#F5F7FA]'}`}>
                {m === 'month' ? '月表示' : '週表示'}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-5 mb-5">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-lg border border-[#E0E4EF] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F5F7FA]">
            <ChevronLeft className="h-4 w-4 text-[#3D4252]" />
          </button>
          <h2 className="text-base font-bold text-[#00135D] min-w-[140px] text-center">{year}年{month + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-lg border border-[#E0E4EF] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F5F7FA]">
            <ChevronRight className="h-4 w-4 text-[#3D4252]" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="bg-white border border-[#E0E4EF] rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,19,93,0.07)]">
          {viewMode === 'month' ? (
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-7 bg-[#F8F9FC] border-b border-[#E0E4EF]">
                  {['日','月','火','水','木','金','土'].map((d, i) => (
                    <div key={d} className={`py-2.5 text-center text-xs font-semibold ${i===0?'text-[#C0392B]':i===6?'text-[#0070CC]':'text-[#3D4252]'}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`e${i}`} className="min-h-[88px] bg-[#FAFBFC] border-r border-b border-[#E0E4EF]" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const dow = new Date(year, month, day).getDay();
                    const holiday = holidayMap.get(ds);
                    const sess = sessionsByDate.get(ds) || [];
                    const isToday = ds === todayStr;
                    const hasCancelled = sess.some(s => s.status === 'cancelled');
                    return (
                      <div key={day}
                        onClick={() => sess.length > 0 && setSelectedSession(sess[0])}
                        className={`min-h-[88px] border-r border-b border-[#E0E4EF] p-1.5 transition-colors ${isToday ? 'bg-[#E8F2FB]' : hasCancelled ? 'bg-[#FEF2F2]' : ''} ${sess.length > 0 ? 'cursor-pointer hover:bg-[#F0F7FF]' : ''}`}>
                        <div className="flex items-start justify-between mb-1">
                          <span className={`text-xs font-medium ${dow===0?'text-[#C0392B]':dow===6?'text-[#0070CC]':'text-[#1A1D23]'} ${isToday?'bg-[#00135D] text-white w-6 h-6 rounded-full flex items-center justify-center':''}`}>
                            {day}
                          </span>
                          {holiday && <span className="text-[9px] text-[#C0392B] truncate max-w-[60px]">{holiday.name}</span>}
                        </div>
                        {sess.map(s => (
                          <div key={s.id} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold truncate mt-0.5 ${s.status==='cancelled'?'bg-[#FEE8E8] text-[#C0392B]':'bg-[#00135D]/10 text-[#00135D]'}`}>
                            {s.status==='cancelled' ? '中止' : s.speaker?.name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 flex flex-col gap-2">
              {getWeekDates().map(date => {
                const ds = date.toISOString().split('T')[0];
                const dow = date.getDay();
                const sess = sessionsByDate.get(ds) || [];
                const holiday = holidayMap.get(ds);
                const isToday = ds === todayStr;
                return (
                  <div key={ds}
                    onClick={() => sess.length > 0 && setSelectedSession(sess[0])}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-colors ${isToday ? 'border-[#0070CC] bg-[#E8F2FB]' : 'border-[#E0E4EF] hover:bg-[#F8F9FC]'} ${sess.length > 0 ? 'cursor-pointer' : ''}`}>
                    <div className="w-14 text-center shrink-0">
                      <p className={`text-xl font-bold ${dow===0?'text-[#C0392B]':dow===6?'text-[#0070CC]':'text-[#00135D]'} leading-none`}>{date.getDate()}</p>
                      <p className="text-[11px] text-muted-foreground">{DAY_LABELS[dow]}曜日</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      {holiday && <Badge className="mb-1.5 bg-[#FEE8E8] text-[#C0392B] border-[#FCCACA] text-[10px]">{holiday.name}</Badge>}
                      {sess.length > 0 ? sess.map(s => (
                        <div key={s.id}>
                          <p className="text-sm font-semibold text-[#1A1D23] flex items-center gap-1.5">
                            <Mic className="h-3 w-3 text-[#0070CC]" />{s.speaker?.name}
                            <span className="text-xs text-muted-foreground font-normal">({GRADE_LABELS[s.speaker?.grade] || s.speaker?.grade})</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />{s.topic.topicText}
                          </p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">{holiday ? '祝日（朝礼なし）' : '予定なし'}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedSession(null)}>
          <div className="bg-white rounded-[16px] w-full max-w-[400px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-5">
              <p className="text-white font-bold text-base">朝礼詳細</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label:'日時', value:`${new Date(selectedSession.date).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric',weekday:'short'})} ${selectedSession.startTime}〜${selectedSession.endTime}` },
                { label:'発話者', value:`${selectedSession.speaker?.name}（${GRADE_LABELS[selectedSession.speaker?.grade] || selectedSession.speaker?.grade}）` },
                { label:'主題', value:selectedSession.topic.topicText },
                { label:'フェーズ', value:`第${selectedSession.phase.phaseNumber}フェーズ · ${selectedSession.phase.name}` },
                { label:'状態', value:selectedSession.status==='completed'?'完了':selectedSession.status==='cancelled'?'中止':'予定' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-1">{label}</p>
                  <p className="text-sm font-semibold text-[#1A1D23]">{value}</p>
                </div>
              ))}
              <button onClick={() => setSelectedSession(null)}
                className="w-full py-2.5 rounded-xl bg-[#00135D] text-white font-bold text-sm border-none cursor-pointer mt-1 hover:bg-[#1E3A8A] transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
