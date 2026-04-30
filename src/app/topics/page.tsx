'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, Calendar as CalendarIcon } from 'lucide-react';

interface TopicData {
  id: number;
  phaseId: number;
  weekNumber: number;
  topicText: string;
  phase: { id: number; name: string; phaseNumber: number };
}

interface PhaseStartData {
  id: number;
  startDate: string;
}

const PHASE_GRADIENT: Record<number, string> = {
  1: 'from-[#00135D] to-[#1E3A8A]',
  2: 'from-[#065F46] to-[#047857]',
  3: 'from-[#4C1D95] to-[#6D28D9]',
};
const PHASE_LIGHT: Record<number, string> = {
  1: '#EEF2FB',
  2: '#ECFDF5',
  3: '#F5F3FF',
};
const PHASE_TEXT: Record<number, string> = {
  1: '#00135D',
  2: '#047857',
  3: '#6D28D9',
};

function getWeekDateRange(weekNum: number, phaseStartDate: string): string {
  const s = new Date(phaseStartDate);
  s.setDate(s.getDate() + (weekNum - 1) * 7);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  return `${s.getMonth()+1}/${s.getDate()} 〜 ${e.getMonth()+1}/${e.getDate()}`;
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [phaseStartMap, setPhaseStartMap] = useState<Map<number, string>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/topics').then(r => r.json()),
      fetch('/api/phases').then(r => r.json()),
    ]).then(([topicsData, phasesData]: [TopicData[], PhaseStartData[]]) => {
      setTopics(topicsData);
      setPhaseStartMap(new Map(phasesData.map(p => [p.id, p.startDate])));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = topics.filter(t => t.topicText.includes(query));
  const byPhase = filtered.reduce((acc, t) => {
    if (!acc[t.phase.phaseNumber]) acc[t.phase.phaseNumber] = { phase: t.phase, topics: [] };
    acc[t.phase.phaseNumber].topics.push(t);
    return acc;
  }, {} as Record<number, { phase: TopicData['phase']; topics: TopicData[] }>);

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[900px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="mb-6 pb-5 border-b border-[#E0E4EF]">
          <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5" />主題カレンダー
          </h1>
          <p className="text-sm text-muted-foreground mt-1">各週の朝礼テーマを確認できます</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="主題を検索..." value={query} onChange={e => setQuery(e.target.value)}
            className="pl-10 border-[#E0E4EF] bg-white rounded-xl h-10 text-sm focus:ring-[#0070CC]/20 focus:border-[#0070CC]" />
        </div>

        <div className="flex flex-col gap-5">
          {Object.entries(byPhase).map(([phaseNum, { phase, topics: pts }]) => {
            const n = parseInt(phaseNum);
            return (
              <Card key={phaseNum} className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
                <div className={`bg-gradient-to-r ${PHASE_GRADIENT[n] || PHASE_GRADIENT[1]} px-6 py-[18px] flex items-center gap-3`}>
                  <div className="bg-white/[0.18] rounded-lg p-2">
                    <CalendarIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-tight">第{phase.phaseNumber}フェーズ：{phase.name}</p>
                    <p className="text-xs text-white/70 mt-0.5">全{pts.length}週のテーマ</p>
                  </div>
                </div>
                <div>
                  {pts.map((topic, i) => (
                    <div key={topic.id} className={`flex items-center gap-3.5 px-5 py-3.5 ${i < pts.length-1 ? 'border-b border-[#E0E4EF]' : ''} hover:bg-[#F8F9FC] transition-colors`}>
                      <div style={{ background: PHASE_LIGHT[n], color: PHASE_TEXT[n] }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                        {topic.weekNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1A1D23]">{topic.topicText}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />第{topic.weekNumber}週（{getWeekDateRange(topic.weekNumber, phaseStartMap.get(topic.phaseId) ?? '')}）
                        </p>
                      </div>
                      <Badge variant="outline" className="border-[#E0E4EF] text-muted-foreground text-xs shrink-0">週{topic.weekNumber}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-[#E0E4EF]" />
            <p className="mt-3 text-sm text-muted-foreground">
              {query ? `「${query}」に一致する主題がありません` : '主題が登録されていません'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
