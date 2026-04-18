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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  CheckCircle2,
  Circle,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  MessageCircle,
} from 'lucide-react';

interface PhaseData {
  id: number;
  phaseNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  sessionDurationMinutes: number;
  description: string | null;
  _count: { sessions: number };
}

export default function PhasePage() {
  const { data: session } = useSession();
  const [phases, setPhases] = useState<PhaseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhases();
  }, []);

  async function fetchPhases() {
    try {
      const res = await fetch('/api/phases');
      setPhases(await res.json());
    } catch (error) {
      console.error('Failed to fetch phases:', error);
    } finally {
      setLoading(false);
    }
  }

  // Determine current phase
  const now = new Date();
  const currentPhase = phases.find(
    (p) => new Date(p.startDate) <= now && new Date(p.endDate) >= now
  );

  function getPhaseProgress(phase: PhaseData): number {
    const start = new Date(phase.startDate).getTime();
    const end = new Date(phase.endDate).getTime();
    const current = now.getTime();

    if (current < start) return 0;
    if (current > end) return 100;

    return Math.round(((current - start) / (end - start)) * 100);
  }

  function getPhaseStatus(phase: PhaseData): 'completed' | 'current' | 'upcoming' {
    if (now > new Date(phase.endDate)) return 'completed';
    if (now >= new Date(phase.startDate)) return 'current';
    return 'upcoming';
  }

  const phaseIcons = [
    <Users key="1" className="h-6 w-6" />,
    <MessageCircle key="2" className="h-6 w-6" />,
    <TrendingUp key="3" className="h-6 w-6" />,
  ];

  const phaseColors = [
    'from-blue-600 to-blue-800',
    'from-emerald-600 to-emerald-800',
    'from-purple-600 to-purple-800',
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          フェーズ進捗
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          朝礼プログラムの全体像と現在地を確認できます
        </p>
      </div>

      {/* Progress Timeline */}
      <div className="relative mb-8">
        <div className="flex items-center justify-between">
          {phases.map((phase, index) => {
            const status = getPhaseStatus(phase);
            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      status === 'completed'
                        ? 'bg-brand-success text-white'
                        : status === 'current'
                        ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20 animate-pulse-subtle'
                        : 'bg-brand-border text-muted-foreground'
                    }`}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : status === 'current' ? (
                      <span className="text-sm font-bold">
                        {phase.phaseNumber}
                      </span>
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <p
                    className={`mt-2 text-xs font-medium ${
                      status === 'current'
                        ? 'text-brand-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    第{phase.phaseNumber}フェーズ
                  </p>
                </div>
                {index < phases.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      status === 'completed' ? 'bg-brand-success' : 'bg-brand-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Cards */}
      <div className="space-y-6">
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase);
          const progress = getPhaseProgress(phase);
          const startDate = new Date(phase.startDate);
          const endDate = new Date(phase.endDate);

          return (
            <Card
              key={phase.id}
              className={`border-brand-border shadow-md overflow-hidden transition-all ${
                status === 'current'
                  ? 'ring-2 ring-brand-primary/20 shadow-lg'
                  : ''
              }`}
            >
              <div
                className={`bg-gradient-to-r ${phaseColors[index]} px-6 py-5`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-white/20 p-2">
                      {phaseIcons[index]}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        第{phase.phaseNumber}フェーズ：{phase.name}
                      </h2>
                      <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {startDate.getFullYear()}年{startDate.getMonth() + 1}月
                        〜 {endDate.getMonth() + 1}月
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      status === 'completed'
                        ? 'bg-white/20 text-white'
                        : status === 'current'
                        ? 'bg-white text-brand-primary'
                        : 'bg-white/10 text-white/70'
                    }
                  >
                    {status === 'completed'
                      ? '完了'
                      : status === 'current'
                      ? '進行中'
                      : '予定'}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-6">
                {phase.description && (
                  <p className="text-sm text-brand-text leading-relaxed mb-4">
                    {phase.description}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-3 text-center">
                    <Clock className="mx-auto h-4 w-4 text-brand-accent mb-1" />
                    <p className="text-lg font-bold text-brand-primary">
                      {phase.sessionDurationMinutes}
                    </p>
                    <p className="text-xs text-muted-foreground">分/回</p>
                  </div>
                  <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-3 text-center">
                    <Calendar className="mx-auto h-4 w-4 text-brand-accent mb-1" />
                    <p className="text-lg font-bold text-brand-primary">
                      {phase._count.sessions}
                    </p>
                    <p className="text-xs text-muted-foreground">回予定</p>
                  </div>
                  <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-3 text-center">
                    <TrendingUp className="mx-auto h-4 w-4 text-brand-accent mb-1" />
                    <p className="text-lg font-bold text-brand-primary">
                      {progress}%
                    </p>
                    <p className="text-xs text-muted-foreground">進捗</p>
                  </div>
                  <div className="rounded-lg border border-brand-border bg-brand-bg/50 p-3 text-center">
                    <Users className="mx-auto h-4 w-4 text-brand-accent mb-1" />
                    <p className="text-lg font-bold text-brand-primary">8</p>
                    <p className="text-xs text-muted-foreground">参加者</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>
                      {startDate.getMonth() + 1}/{startDate.getDate()}
                    </span>
                    <span>{progress}% 完了</span>
                    <span>
                      {endDate.getMonth() + 1}/{endDate.getDate()}
                    </span>
                  </div>
                  <Progress
                    value={progress}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
