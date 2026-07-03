'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mic } from 'lucide-react';
import { GRADE_LABELS } from '@/lib/constants';

type Status = 'present' | 'absent' | 'unspoken' | 'leave_early';

interface Member {
  id: string;
  name: string;
  grade: string;
  status: Status;
  role: 'commentator' | 'commenter';
  order: number | null;
}
interface DayData {
  phaseNumber: number;
  speaker: { id: string; name: string; grade: string; status: Status } | null;
  members: Member[];
}

const STATUS_LABEL: Record<string, string> = {
  absent: '欠席',
  unspoken: '聴講のみ',
  leave_early: '途中退出',
};

function statusBadge(status: Status) {
  if (status === 'present') return null;
  const danger = status === 'absent';
  return (
    <Badge
      className={`text-[10px] py-0 px-1.5 ${
        danger
          ? 'bg-[#FEF2F2] text-[#C0392B] border border-[#FCCACA]'
          : 'bg-[#F8F9FC] text-muted-foreground border border-[#E0E4EF]'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/**
 * その日の参加者を役割つきで一覧するカード（全フェーズ共通）。
 * Phase1: コメント順、Phase2+: 発話者＋応答者を明示する。
 */
export function DayParticipantsCard({
  sessionId,
  currentUserId,
}: {
  sessionId: number;
  currentUserId?: string;
}) {
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/sessions/day-participants?sessionId=${sessionId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d && !d.error) setData(d);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId]);

  if (!data) return null;

  const isP2 = data.phaseNumber >= 2;
  const activeCount =
    (data.speaker && data.speaker.status !== 'absent' ? 1 : 0) +
    data.members.filter((m) => m.status !== 'absent').length;

  const isMe = (id: string) => !!currentUserId && id === currentUserId;
  const dim = (status: Status) => status === 'absent' || status === 'unspoken';

  return (
    <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E0E4EF] flex items-center justify-between">
        <p className="text-xs font-bold text-[#00135D] flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-[#0070CC]" />本日の参加者
        </p>
        <span className="text-[10px] text-muted-foreground">出席 {activeCount} 名</span>
      </div>
      <CardContent className="p-4 space-y-2">
        {/* 発話者 */}
        {data.speaker && (
          <div
            className={`flex items-center gap-2.5 rounded-lg border border-[#BDD9F5] bg-[#E8F2FB] px-3 py-2 ${
              dim(data.speaker.status) ? 'opacity-50' : ''
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-[#00135D] flex items-center justify-center shrink-0">
              <Mic className="h-3 w-3 text-white" />
            </span>
            <Badge className="bg-[#00135D] text-white text-[10px] py-0 px-1.5 shrink-0">発話者</Badge>
            <span className={`text-sm font-semibold ${isMe(data.speaker.id) ? 'text-[#0070CC]' : 'text-[#1A1D23]'}`}>
              {data.speaker.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {GRADE_LABELS[data.speaker.grade] || data.speaker.grade}
            </span>
            {isMe(data.speaker.id) && <Badge className="bg-[#0070CC] text-white text-[10px] py-0 px-1.5">あなた</Badge>}
            {statusBadge(data.speaker.status)}
          </div>
        )}

        {/* その他の参加者 */}
        <div className="flex flex-col gap-1.5">
          {data.members.map((m) => {
            const showOrder = m.order !== null;
            const respondent = isP2 && m.role === 'commentator';
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2.5 px-1 ${dim(m.status) ? 'opacity-40' : ''}`}
              >
                {showOrder ? (
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      respondent ? 'bg-[#0070CC] text-white' : isMe(m.id) ? 'bg-[#0070CC] text-white' : 'bg-[#00135D] text-white'
                    }`}
                  >
                    {m.order}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#E0E4EF] flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground font-bold">–</span>
                  </span>
                )}
                {respondent && (
                  <Badge className="bg-[#0070CC] text-white text-[10px] py-0 px-1.5 shrink-0">応答者</Badge>
                )}
                <span className={`text-sm font-semibold ${isMe(m.id) ? 'text-[#0070CC]' : 'text-[#1A1D23]'}`}>
                  {m.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{GRADE_LABELS[m.grade] || m.grade}</span>
                {isMe(m.id) && <Badge className="bg-[#0070CC] text-white text-[10px] py-0 px-1.5">あなた</Badge>}
                {statusBadge(m.status)}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground pt-1">
          {isP2
            ? '※ 発話者＝話者、応答者＝問いを置く担当。欠席・聴講のみの方は薄く表示されます。30秒ごとに自動更新。'
            : '※ 番号はコメント順。欠席・聴講のみの方はスキップされます。30秒ごとに自動更新。'}
        </p>
      </CardContent>
    </Card>
  );
}
