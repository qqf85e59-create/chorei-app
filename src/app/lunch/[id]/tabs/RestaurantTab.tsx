"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestaurantTab({ event }: { event: any }) {
  const router = useRouter();
  const [status, setStatus] = useState(event.status);
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      } else {
        alert("ステータス更新に失敗しました");
      }
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold mb-4 border-b pb-2 text-[var(--color-primary)]">予約ステータスの管理</h3>
        <p className="text-gray-600 mb-4 text-sm">
          日程調整とアンケート結果をもとにお店を予約したら、ステータスを「予約完了」に変更してください。<br/>
          （※変更後、参加メンバーのダッシュボードに反映されます）
        </p>

        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-sm text-gray-500 mb-1 font-medium">現在のステータス</div>
            <div className="font-bold text-xl text-[var(--color-primary)]">
              {status === "planning" ? "📝 お店選び・日程調整中" : 
               status === "scheduled" ? "✅ 予約完了・開催待ち" : 
               status === "completed" ? "🎉 開催完了" : "❌ キャンセル"}
            </div>
          </div>
          
          <div className="flex gap-2">
            {status === "planning" && (
              <button 
                onClick={() => handleUpdateStatus("scheduled")}
                disabled={loading}
                className="bg-[var(--color-accent)] text-white px-5 py-2.5 rounded font-bold hover:bg-orange-500 shadow transition-colors"
              >
                予約完了にする
              </button>
            )}
            {status === "scheduled" && (
              <button 
                onClick={() => handleUpdateStatus("planning")}
                disabled={loading}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-50 transition-colors"
              >
                調整中に戻す
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
