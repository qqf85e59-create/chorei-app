'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

interface Commentator {
  id: string;
  name: string;
  grade: string;
}

interface NextSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  phaseNumber: number;
  speaker: { id: string; name: string; grade: string } | null;
  topic: { topicText: string } | null;
  commentators: Commentator[];
  commentatorsUpdatedAt: string | null;
  commentatorsPreset: boolean;
}

interface NextCommentatorsResponse {
  session: NextSession | null;
  changed: boolean;
  lastSeenAt: string | null;
}

export function NextCommentatorsCard() {
  const [data, setData] = useState<NextCommentatorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/sessions/next-commentators');
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch next commentators:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkViewed() {
    if (!data?.session) return;
    setMarking(true);
    try {
      const res = await fetch('/api/sessions/mark-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.session.id }),
      });
      if (res.ok) {
        setData({ ...data, changed: false });
      }
    } catch (err) {
      console.error('Failed to mark viewed:', err);
    } finally {
      setMarking(false);
    }
  }

  if (loading) return null;
  if (!data || !data.session) return null;

  const s = data.session;
  // Only relevant for Phase 2/3 where commentators are the response format
  if (s.phaseNumber === 1) return null;

  const date = new Date(s.date);
  const formatted = `${date.getMonth() + 1}月${date.getDate()}日（${DAY_LABELS[date.getDay()]}）`;

  const highlightClass = data.changed
    ? 'border-[#3B82F6] bg-blue-50/60 ring-1 ring-[#3B82F6]/30'
    : 'border-brand-border';

  return (
    <Card className={`shadow-md transition-all ${highlightClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-brand-primary flex items-center gap-2">
              <Users className="h-5 w-5" />
              次回の応答者（暫定）
              <Badge variant="outline" className="border-[#3B82F6]/40 text-[#3B82F6] bg-white">
                暫定
              </Badge>
              {data.changed && (
                <Badge className="bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white">
                  変更あり
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              {formatted} {s.startTime}〜{s.endTime}
              {s.speaker && (
                <span className="ml-2">発話者：{s.speaker.name}</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-blue-50/80 border border-[#3B82F6]/20 p-2.5 text-xs text-brand-primary">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            変動の可能性あり（欠席申請等により再抽選される場合があります）
          </span>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1.5">
            応答者（{s.commentators.length}名）
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.commentators.length === 0 ? (
              <span className="text-xs text-muted-foreground">未確定</span>
            ) : (
              s.commentators.map((c) => (
                <Badge
                  key={c.id}
                  variant="outline"
                  className="border-[#3B82F6]/40 bg-white text-brand-text"
                >
                  {c.name}
                </Badge>
              ))
            )}
          </div>
        </div>

        {data.changed && (
          <div className="flex items-center justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkViewed}
              disabled={marking}
              className="border-[#3B82F6] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {marking ? '処理中...' : '既読'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
