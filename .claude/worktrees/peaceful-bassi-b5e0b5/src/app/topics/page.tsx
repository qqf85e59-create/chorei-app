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
import { Input } from '@/components/ui/input';
import { BookOpen, Search, Calendar as CalendarIcon } from 'lucide-react';

interface TopicData {
  id: number;
  phaseId: number;
  weekNumber: number;
  topicText: string;
  phase: {
    id: number;
    name: string;
    phaseNumber: number;
  };
}

export default function TopicsPage() {
  const { data: session } = useSession();
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  async function fetchTopics() {
    try {
      const res = await fetch('/api/topics');
      setTopics(await res.json());
    } catch (error) {
      console.error('Failed to fetch topics:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTopics = topics.filter((t) =>
    t.topicText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by phase
  const topicsByPhase = filteredTopics.reduce(
    (acc, topic) => {
      const key = topic.phase.phaseNumber;
      if (!acc[key]) acc[key] = { phase: topic.phase, topics: [] };
      acc[key].topics.push(topic);
      return acc;
    },
    {} as Record<number, { phase: TopicData['phase']; topics: TopicData[] }>
  );

  // Calculate week date ranges (starting from 2026-05-07)
  function getWeekDateRange(weekNum: number): string {
    const startDate = new Date('2026-05-07');
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()} 〜 ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          主題カレンダー
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          各週の朝礼テーマを確認できます
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="主題を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-brand-border"
        />
      </div>

      {/* Topics by Phase */}
      <div className="space-y-6">
        {Object.entries(topicsByPhase).map(([phaseNum, { phase, topics: phaseTopics }]) => (
          <Card
            key={phaseNum}
            className="border-brand-border shadow-md overflow-hidden"
          >
            <CardHeader className="bg-gradient-to-r from-brand-primary to-brand-secondary">
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                第{phase.phaseNumber}フェーズ：{phase.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-brand-border">
                {phaseTopics.map((topic, index) => (
                  <div
                    key={topic.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-brand-bg/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-accent/10 text-brand-accent font-bold text-sm flex-shrink-0">
                      {topic.weekNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-text">
                        {topic.topicText}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        第{topic.weekNumber}週（{getWeekDateRange(topic.weekNumber)}）
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-brand-border text-muted-foreground flex-shrink-0"
                    >
                      週{topic.weekNumber}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTopics.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-brand-border" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchQuery
              ? '検索条件に一致する主題がありません'
              : '主題が登録されていません'}
          </p>
        </div>
      )}
    </div>
  );
}
