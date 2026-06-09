"use client";

import { useState } from "react";
import { LunchEvent, ScheduleCandidate, ScheduleResponse } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Check } from "lucide-react";

type Props = {
  event: LunchEvent & { scheduleCandidates: (ScheduleCandidate & { responses: ScheduleResponse[] })[] };
};

export default function ScheduleTab({ event }: Props) {
  const router = useRouter();
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: [{ candidateDate: newDate, note: newNote }] })
      });

      if (res.ok) {
        setNewDate("");
        setNewNote("");
        router.refresh();
      } else {
        alert("追加に失敗しました");
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDate = async (date: Date) => {
    if (!confirm("この日程で確定しますか？")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedDate: date, status: "scheduled" })
      });

      if (res.ok) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {event.confirmedDate && (
        <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)] p-4 rounded text-[var(--color-success)] flex items-center gap-3">
          <Check className="w-5 h-5" />
          <div>
            <p className="font-bold">日程が確定しました</p>
            <p className="text-sm">
              {new Date(event.confirmedDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-4">
            <Plus className="w-5 h-5 text-[var(--color-primary)]" />
            候補日の追加
          </h3>
          
          <form onSubmit={handleAddCandidate} className="bg-gray-50 p-4 rounded border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm mb-1">日時</label>
              <input 
                type="datetime-local" 
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">メモ（エリア等）</label>
              <input 
                type="text" 
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="例: 仙台駅周辺"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-sub)] text-white px-4 py-2 rounded text-sm w-full transition-colors"
            >
              候補を追加
            </button>
          </form>
        </div>

        <div>
          <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-4">
            <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            候補日と回答状況
          </h3>

          <div className="space-y-3">
            {event.scheduleCandidates.length > 0 ? (
              event.scheduleCandidates.map(c => (
                <div key={c.id} className="border border-gray-200 rounded p-3 bg-white shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-medium">
                      {new Date(c.candidateDate).toLocaleString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {c.note && <p className="text-xs text-gray-500">{c.note}</p>}
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="text-green-600">○: {c.responses.filter(r => r.response === '○').length}人</span>
                      <span className="text-yellow-600">△: {c.responses.filter(r => r.response === '△').length}人</span>
                      <span className="text-red-600">×: {c.responses.filter(r => r.response === '×').length}人</span>
                    </div>
                  </div>
                  {!event.confirmedDate && (
                    <button 
                      onClick={() => handleConfirmDate(c.candidateDate)}
                      className="bg-gray-100 hover:bg-[var(--color-panel)] text-[var(--color-primary)] px-3 py-1.5 rounded text-sm transition-colors border border-gray-200"
                    >
                      確定
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">候補日が登録されていません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
