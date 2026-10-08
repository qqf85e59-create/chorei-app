'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, BookOpen, MessageSquare, Users, History } from 'lucide-react';
import { SESSION_STRUCTURE } from '@/lib/constants';

/** フェーズ1・2の画面を並べて見せる日（YYYY-MM-DD）。この日だけホームに表示する。 */
export const PHASE_SHOWCASE_DATE = '2026-10-09';

/** フェーズ2の見本で出す主題（表示用のサンプル）。 */
const SAMPLE_TOPIC = '最近「なるほど」と思ったこと';

interface OrderItem {
  id: string;
  name: string;
  commentPosition: number | null;
}

function FlowTable({ phaseNumber }: { phaseNumber: number }) {
  const flow = SESSION_STRUCTURE[phaseNumber] ?? [];
  return (
    <div className="border border-[#E0E4EF] rounded-lg overflow-hidden">
      {flow.map((step, i) => (
        <div
          key={i}
          className={`grid grid-cols-[5.5rem_3.5rem_1fr] ${i < flow.length - 1 ? 'border-b border-[#E0E4EF]' : ''} ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FC]'}`}
        >
          <span className="px-2 py-1.5 text-[10px] font-semibold text-[#00135D] leading-snug">{step.label}</span>
          <span className="px-1.5 py-1.5 text-[10px] text-[#0070CC] font-medium leading-snug whitespace-nowrap">{step.duration}</span>
          <span className="px-2 py-1.5 text-[10px] text-[#3D4252] leading-snug">{step.description}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 以前の朝礼のかたち（フェーズ1・フェーズ2）を見比べるための特別表示。
 * 当日の発話者・出席者を使い、フェーズ2の主題と応答者は見本として仮に置く。
 */
export function PhaseShowcaseCard({
  sessionId,
  speakerName,
  phaseNames,
}: {
  sessionId: number;
  speakerName: string | null;
  phaseNames: Record<number, string>;
}) {
  const [order, setOrder] = useState<OrderItem[]>([]);

  useEffect(() => {
    fetch(`/api/sessions/comment-order?sessionId=${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOrder((d?.commentOrder ?? []).filter((c: OrderItem) => c.commentPosition !== null)))
      .catch(() => {});
  }, [sessionId]);

  // フェーズ2の見本: コメント順の先頭を応答者B、残りを聴取者とする。
  const respondent = order[0] ?? null;
  const listeners = order.slice(1);

  return (
    <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E0E4EF] bg-[#FFF8E6]">
        <p className="text-sm font-bold text-[#00135D] flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-[#B7791F]" />
          これまでの朝礼のかたち（本日限定の表示）
        </p>
        <p className="text-[11px] text-[#3D4252] mt-1">
          フェーズ1とフェーズ2で、画面と進め方がどう違ったかを並べています。フェーズ2の主題・応答者は見本です。
        </p>
      </div>
      <div className="p-4 grid gap-4 md:grid-cols-2">
        {/* フェーズ1 */}
        <div className="space-y-3">
          <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-[10px]">
            第1フェーズ · {phaseNames[1] ?? '個人理解期'}
          </Badge>
          <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3 space-y-2.5">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">発話者</p>
              <div className="flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-[#0070CC] shrink-0" />
                <span className="text-xs font-bold text-[#00135D]">{speakerName ?? '未定'}</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">主題</p>
              <span className="text-[11px] text-muted-foreground">なし（話したいことを自由に）</span>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />コメント順（出席者全員）
              </p>
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
                {order.map((c) => (
                  <div key={c.id} className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-[#00135D] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                      {c.commentPosition}
                    </span>
                    <span className="text-[11px] text-[#1A1D23]">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <FlowTable phaseNumber={1} />
        </div>

        {/* フェーズ2 */}
        <div className="space-y-3">
          <Badge className="bg-[#EEF0FF] text-[#4338CA] border-[#C7CBF5] text-[10px]">
            第2フェーズ · {phaseNames[2] ?? '中間接続期'}
          </Badge>
          <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">発話者A</p>
                <div className="flex items-center gap-1.5">
                  <Mic className="h-3 w-3 text-[#0070CC] shrink-0" />
                  <span className="text-xs font-bold text-[#00135D]">{speakerName ?? '未定'}</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">応答者B</p>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-[#4338CA] shrink-0" />
                  <span className="text-xs font-bold text-[#00135D]">{respondent?.name ?? '未定'}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">主題</p>
              <div className="flex items-start gap-1">
                <BookOpen className="h-3 w-3 text-[#0070CC] shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold text-[#00135D]">{SAMPLE_TOPIC}</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">聴取者（感想は任意）</p>
              <p className="text-[11px] text-[#3D4252] leading-relaxed">
                {listeners.length > 0 ? listeners.map((c) => c.name).join('、') : '—'}
              </p>
            </div>
          </div>
          <FlowTable phaseNumber={2} />
        </div>
      </div>
    </Card>
  );
}
