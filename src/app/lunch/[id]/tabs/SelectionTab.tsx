"use client";

import { useState, useEffect } from "react";
import { User, LunchEvent, Participation } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Users, UserMinus, RefreshCw } from "lucide-react";

type Props = {
  event: LunchEvent & { participants: (Participation & { user: User })[] };
  activeStaff: User[];
  previousParticipantIds: string[];
};

export default function SelectionTab({ event, activeStaff, previousParticipantIds }: Props) {
  const router = useRouter();
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // 抽選人数（マスター設定。表示ラベル用）
  const [targetCount, setTargetCount] = useState<number>(3);
  useEffect(() => {
    fetch('/api/config/lunch-count')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.count === 'number') setTargetCount(d.count); })
      .catch(() => {});
  }, []);

  const toggleExclude = (id: string) => {
    setExcludedIds(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSelection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedMemberIds: excludedIds })
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("選定に失敗しました");
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const currentParticipants = event.participants.filter(p => !p.isOrganizer).map(p => p.user);
  const organizer = event.participants.find(p => p.isOrganizer)?.user;

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 border-b pb-2">
            <Users className="w-5 h-5 text-[var(--color-primary)]" />
            現在の選定結果
          </h3>
          
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">主催者</p>
            <p className="font-medium">{organizer?.name || "未設定"}</p>
          </div>

          <div className="bg-[var(--color-panel)] p-4 rounded border border-[var(--color-accent)]">
            <p className="text-sm text-[var(--color-primary)] font-medium mb-2">参加スタッフ ({targetCount}名)</p>
            {currentParticipants.length > 0 ? (
              <ul className="space-y-2">
                {currentParticipants.map(user => (
                  <li key={user.id} className="flex justify-between items-center bg-white px-3 py-2 rounded shadow-sm">
                    <span>{user.name}</span>
                    {previousParticipantIds.includes(user.id) && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">連続</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">まだ選定されていません</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 border-b pb-2">
            <UserMinus className="w-5 h-5 text-[var(--color-primary)]" />
            ランダム選定の実行
          </h3>
          
          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <p className="text-sm mb-3">当回の手動除外（任意）</p>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {activeStaff.map(staff => (
                <label key={staff.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={excludedIds.includes(staff.id)}
                    onChange={() => toggleExclude(staff.id)}
                    className="rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <span>{staff.name}</span>
                  {previousParticipantIds.includes(staff.id) && (
                    <span className="text-xs text-gray-400 ml-auto">直前回参加</span>
                  )}
                </label>
              ))}
            </div>

            <button
              onClick={handleSelection}
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-[var(--color-accent)] hover:bg-blue-600 text-white font-medium py-2 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {currentParticipants.length > 0 ? "再抽選する" : "ランダム選定を実行"}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              ※直前回の参加者は確率が下がるように重み付けされます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
