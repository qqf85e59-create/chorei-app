'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Mic,
  BookOpen,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

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
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [holidays, setHolidays] = useState<HolidayData[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [filterMyOnly, setFilterMyOnly] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const userRole = (session?.user as { role?: string })?.role || 'member';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [sessionsRes, holidaysRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/holidays?year=2026'),
      ]);
      setSessions(await sessionsRes.json());
      setHolidays(await holidaysRes.json());
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const holidayMap = new Map(
    holidays.map((h) => [new Date(h.date).toISOString().split('T')[0], h])
  );

  const sessionsByDate = new Map<string, SessionData[]>();
  sessions.forEach((s) => {
    const dateKey = new Date(s.date).toISOString().split('T')[0];
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(s);
  });

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const filteredSessions = filterMyOnly
    ? sessions.filter((s) => s.speaker.id === session?.user?.id)
    : sessions;

  const filteredByDate = new Map<string, SessionData[]>();
  filteredSessions.forEach((s) => {
    const dateKey = new Date(s.date).toISOString().split('T')[0];
    if (!filteredByDate.has(dateKey)) {
      filteredByDate.set(dateKey, []);
    }
    filteredByDate.get(dateKey)!.push(s);
  });

  // Week view
  const getWeekDates = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            カレンダー
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            朝礼の予定を確認できます
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={filterMyOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterMyOnly(!filterMyOnly)}
            className={
              filterMyOnly
                ? 'bg-brand-primary'
                : 'border-brand-border hover:bg-brand-bg'
            }
          >
            <Mic className="h-3.5 w-3.5 mr-1" />
            自分の発話のみ
          </Button>
          <Select
            value={viewMode}
            onValueChange={(v) => setViewMode((v || 'month') as 'month' | 'week')}
          >
            <SelectTrigger className="w-24 border-brand-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">月表示</SelectItem>
              <SelectItem value="week">週表示</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevMonth}
          className="hover:bg-brand-bg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-brand-primary">
          {year}年{month + 1}月
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          className="hover:bg-brand-bg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {viewMode === 'month' ? (
        /* Month View */
        <Card className="border-brand-border shadow-md overflow-hidden">
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-brand-border bg-brand-bg">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-semibold ${
                    i === 0
                      ? 'text-brand-danger'
                      : i === 6
                      ? 'text-brand-accent'
                      : 'text-brand-text'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells for offset */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[80px] sm:min-h-[100px] border-b border-r border-brand-border bg-gray-50/50"
                />
              ))}

              {/* Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const holiday = holidayMap.get(dateStr);
                const daySessions = filteredByDate.get(dateStr) || [];
                const dayOfWeek = new Date(year, month, day).getDay();
                const isToday =
                  new Date().toISOString().split('T')[0] === dateStr;

                return (
                  <div
                    key={day}
                    className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-brand-border p-1 sm:p-2 transition-colors ${
                      isToday
                        ? 'bg-brand-accent/5 ring-1 ring-inset ring-brand-accent/20'
                        : holiday
                        ? 'bg-red-50/50'
                        : ''
                    } ${
                      daySessions.length > 0
                        ? 'cursor-pointer hover:bg-brand-bg/70'
                        : ''
                    }`}
                    onClick={() =>
                      daySessions.length > 0 &&
                      setSelectedSession(daySessions[0])
                    }
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          dayOfWeek === 0
                            ? 'text-brand-danger'
                            : dayOfWeek === 6
                            ? 'text-brand-accent'
                            : 'text-brand-text'
                        } ${isToday ? 'bg-brand-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}
                      >
                        {day}
                      </span>
                      {holiday && (
                        <span className="text-[10px] text-brand-danger truncate max-w-[60px]">
                          {holiday.name}
                        </span>
                      )}
                    </div>

                    {daySessions.map((s) => (
                      <div
                        key={s.id}
                        className="mt-1 rounded bg-brand-primary/10 px-1 py-0.5 text-[10px] sm:text-xs truncate"
                      >
                        <span className="font-medium text-brand-primary">
                          {s.speaker.name}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Week View */
        <Card className="border-brand-border shadow-md">
          <CardContent className="p-4">
            <div className="space-y-2">
              {getWeekDates().map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const holiday = holidayMap.get(dateStr);
                const daySessions = filteredByDate.get(dateStr) || [];
                const dayOfWeek = date.getDay();
                const isToday =
                  new Date().toISOString().split('T')[0] === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors ${
                      isToday
                        ? 'border-brand-accent bg-brand-accent/5'
                        : holiday
                        ? 'border-brand-danger/20 bg-red-50'
                        : 'border-brand-border hover:bg-brand-bg/50'
                    }`}
                  >
                    <div className="w-16 text-center flex-shrink-0">
                      <p
                        className={`text-lg font-bold ${
                          dayOfWeek === 0
                            ? 'text-brand-danger'
                            : dayOfWeek === 6
                            ? 'text-brand-accent'
                            : 'text-brand-primary'
                        }`}
                      >
                        {date.getDate()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DAY_LABELS[dayOfWeek]}曜日
                      </p>
                    </div>

                    <div className="flex-1">
                      {holiday && (
                        <Badge
                          variant="destructive"
                          className="mb-1 bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                        >
                          {holiday.name}
                        </Badge>
                      )}
                      {daySessions.length > 0 ? (
                        daySessions.map((s) => (
                          <div
                            key={s.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedSession(s)}
                          >
                            <p className="text-sm font-medium text-brand-text flex items-center gap-1">
                              <Mic className="h-3 w-3 text-brand-accent" />
                              {s.speaker.name}
                              {userRole === 'admin' && (
                                <span className="text-xs text-muted-foreground">
                                  ({s.speaker.grade})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <BookOpen className="h-3 w-3" />
                              {s.topic.topicText}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {holiday ? '祝日（朝礼なし）' : '予定なし'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelectedSession(null)}
        >
          <Card
            className="w-full max-w-md border-brand-border shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-t-lg">
              <CardTitle className="text-lg">朝礼詳細</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">日時</p>
                <p className="text-sm font-medium">
                  {(() => {
                    const d = new Date(selectedSession.date);
                    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`;
                  })()}
                </p>
                <p className="text-sm text-brand-secondary">
                  {selectedSession.startTime} 〜 {selectedSession.endTime}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">主題</p>
                <p className="text-sm font-semibold text-brand-primary">
                  {selectedSession.topic.topicText}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">発話者</p>
                <p className="text-sm font-semibold text-brand-primary">
                  {selectedSession.speaker.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">フェーズ</p>
                <Badge className="bg-brand-accent/10 text-brand-accent border-brand-accent/20">
                  第{selectedSession.phase.phaseNumber}フェーズ:{' '}
                  {selectedSession.phase.name}
                </Badge>
              </div>
              <Button
                className="w-full bg-brand-primary hover:bg-brand-secondary"
                onClick={() => setSelectedSession(null)}
              >
                閉じる
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
