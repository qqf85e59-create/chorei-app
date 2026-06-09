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
};

export default function ScheduleTab({ event, role, userId }: Props) {
  const router = useRouter();
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);

  // Member response state
  const [responses, setResponses] = useState<Record<number, "○" | "△" | "×">>(() => {
    const initial: Record<number, "○" | "△" | "×"> = {};
    event.scheduleCandidates.forEach(c => {
      const myRes = c.responses.find(r => r.userId === userId);
      if (myRes) initial[c.id] = myRes.response as any;
    });
    return initial;
  });

  const isAdmin = role === "admin";

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
        toast.success("候補を追加しました");
        setNewDate("");
        setNewNote("");
        router.refresh();
      } else {
        toast.error("追加に失敗しました");
      }
    } catch (err) {
      console.error(err);
      toast.error("エラーが発生しました");
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

  const handleMemberSubmit = async () => {
    const payload = Object.entries(responses).map(([candidateId, response]) => ({
      candidateId: parseInt(candidateId),
      response
    }));

    if (payload.length !== event.scheduleCandidates.length) {
      toast.error("すべての候補日について回答してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}/schedule/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: payload })
      });

      if (res.ok) {
        toast.success("回答を保存しました");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "保存に失敗しました");
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
        {isAdmin && !event.confirmedDate && (
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
                className="bg-[var(--color-primary)] hover:bg-[var(--color-sub)] text-white px-4 py-2 rounded text-sm w-full transition-colors disabled:opacity-50"
              >
                候補を追加
              </button>
            </form>
          </div>
        )}

        <div className={isAdmin ? "" : "md:col-span-2"}>
          <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-4">
            <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            {isAdmin ? "候補日と回答状況" : "あなたの回答"}
          </h3>

          <div className="space-y-4">
            {event.scheduleCandidates.length > 0 ? (
              event.scheduleCandidates.map(c => {
                const myResponse = responses[c.id];
                return (
                  <div key={c.id} className={`border rounded-lg p-4 bg-white shadow-sm transition-all ${
                    !isAdmin && !myResponse ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]" : "border-gray-200"
                  }`}>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-medium text-[var(--color-primary)]">
                          {new Date(c.candidateDate).toLocaleString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {c.note && <p className="text-xs text-gray-500 mt-0.5">{c.note}</p>}
                      </div>
                      {isAdmin && !event.confirmedDate && (
                        <button 
                          onClick={() => handleConfirmDate(c.candidateDate)}
                          className="bg-gray-100 hover:bg-[var(--color-panel)] text-[var(--color-primary)] px-3 py-1.5 rounded text-sm transition-colors border border-gray-200"
                        >
                          確定
                        </button>
                      )}
                    </div>
                    
                    {!isAdmin && !event.confirmedDate && (
                      <div className="flex gap-2 w-full mt-2">
                        {(["○", "△", "×"] as const).map(option => (
                          <button
                            key={option}
                            onClick={() => setResponses(prev => ({ ...prev, [c.id]: option }))}
                            className={`flex-1 py-3 text-lg font-bold rounded-lg transition-colors border ${
                              myResponse === option
                                ? option === "○" ? "bg-green-100 border-green-500 text-green-700"
                                : option === "△" ? "bg-yellow-100 border-yellow-500 text-yellow-700"
                                : "bg-red-100 border-red-500 text-red-700"
                                : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}

                    {isAdmin && (
                      <div className="flex gap-4 mt-2 text-sm bg-gray-50 p-2 rounded">
                        <span className="text-green-700 font-medium">○: {c.responses.filter(r => r.response === '○').length}人</span>
                        <span className="text-yellow-700 font-medium">△: {c.responses.filter(r => r.response === '△').length}人</span>
                        <span className="text-red-700 font-medium">×: {c.responses.filter(r => r.response === '×').length}人</span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">候補日が登録されていません</p>
            )}

            {!isAdmin && event.scheduleCandidates.length > 0 && !event.confirmedDate && (
              <button
                onClick={handleMemberSubmit}
                disabled={loading || Object.keys(responses).length !== event.scheduleCandidates.length}
                className="w-full mt-6 bg-[var(--color-primary)] hover:bg-[#1E3A8A] text-white rounded-xl h-12 font-bold shadow-[0_4px_12px_rgba(0,19,93,0.25)] flex justify-center items-center gap-2 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <span className="animate-spin rounded-full border-2 border-white border-t-transparent w-5 h-5 inline-block"></span>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    回答を送信する
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
