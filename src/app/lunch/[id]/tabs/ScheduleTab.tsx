"use client";

import { useState, useEffect } from "react";
import { LunchEvent, ScheduleCandidate, ScheduleResponse } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Check, Save } from "lucide-react";
import { toast } from "sonner";

type Props = {
  event: LunchEvent & { scheduleCandidates: (ScheduleCandidate & { responses: ScheduleResponse[] })[] };
  role: string;
  userId: string;
  isParticipant?: boolean;
};

export default function ScheduleTab({ event, role, userId, isParticipant = true }: Props) {
  const router = useRouter();
  
  // Format existing confirmedDate to YYYY-MM-DD for the date input
  const initialDate = event.confirmedDate 
    ? new Date(event.confirmedDate).toISOString().split('T')[0]
    : "";
  
  const [newDate, setNewDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);

  const isAdmin = role === "admin";

  const handleConfirmDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    if (!confirm("この日程で確定しますか？")) return;
    
    setLoading(true);
    try {
      const dateObj = new Date(newDate);
      
      const res = await fetch(`/api/lunch/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedDate: dateObj, status: "scheduled" })
      });

      if (res.ok) {
        toast.success("日程を確定しました");
        router.refresh();
      } else {
        toast.error("確定に失敗しました");
      }
    } catch (err) {
      console.error(err);
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {event.confirmedDate ? (
        <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)] p-4 rounded text-[var(--color-success)] flex items-center gap-3">
          <Check className="w-5 h-5" />
          <div>
            <p className="font-bold">日程が確定しました</p>
            <p className="text-sm">
              {new Date(event.confirmedDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 p-4 rounded text-gray-600 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div>
            <p className="font-bold">日程調整中</p>
            <p className="text-sm">運営が日程を確定するのをお待ちください。</p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm max-w-md">
          <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-4">
            <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            {event.confirmedDate ? "日程の変更" : "日程の確定"}
          </h3>
          
          <form onSubmit={handleConfirmDate} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5 font-medium text-gray-700">ランチ開催日</label>
              <input 
                type="date" 
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={loading || !newDate}
              className="bg-[var(--color-primary)] hover:bg-[#1E3A8A] text-white px-4 py-2 rounded text-sm w-full transition-colors disabled:opacity-50 flex justify-center items-center gap-2 font-bold shadow-[0_2px_8px_rgba(0,19,93,0.2)]"
            >
              {loading ? (
                <span className="animate-spin rounded-full border-2 border-white border-t-transparent w-4 h-4 inline-block"></span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  確定する
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
