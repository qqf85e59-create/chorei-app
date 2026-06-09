"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MapPin, ExternalLink, Star, ThumbsUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RestaurantTab({ event, restaurants = [] }: { event: any, restaurants?: any[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(event.status);
  const [loading, setLoading] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(event.restaurantId || null);

  // おすすめ度の計算
  const scoredRestaurants = restaurants.map(r => {
    let score = 0;
    const reasons = [];

    event.surveyResponses.forEach((res: any) => {
      try {
        const genres = JSON.parse(res.genres || "[]");
        if (genres.includes(r.genre)) {
          score += 2;
        }
      } catch (e) {}

      if (res.area && r.area && res.area === r.area) {
        score += 1;
      }
    });

    if (score > 0) {
      reasons.push(`${score}ポイントのマッチ`);
    }

    return { ...r, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, restaurantId: selectedRestaurantId }),
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
                disabled={loading || !selectedRestaurantId}
                className="bg-[var(--color-accent)] text-white px-5 py-2.5 rounded font-bold hover:bg-orange-500 shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                店舗を決定して予約完了にする
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

      <div>
        <h3 className="text-lg font-bold mb-4 border-b pb-2 text-[var(--color-primary)]">店舗の選択</h3>
        <p className="text-gray-600 mb-4 text-sm">
          アンケート結果（エリア・ジャンル）をもとに、参加者の希望にマッチした店舗を優先表示しています。
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {scoredRestaurants.map((r, i) => (
            <div 
              key={r.id} 
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedRestaurantId === r.id 
                  ? "border-[var(--color-accent)] bg-orange-50" 
                  : "border-gray-200 hover:border-blue-300 bg-white"
              }`}
              onClick={() => {
                if (status === "planning") {
                  setSelectedRestaurantId(r.id);
                }
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-lg text-gray-900">{r.name}</h4>
                {r.score >= 2 && (
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                    <ThumbsUp className="w-3 h-3 mr-1" /> 参加者の希望にマッチ！
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">{r.genre}</Badge>
                {r.area && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {r.area}
                  </span>
                )}
              </div>

              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1 mb-2 inline-block w-max" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5" /> 店舗サイト・食べログ
                </a>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-500" />
                  訪問回数: {r.visitCount}回
                </span>
                {r.lastVisited && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    最終訪問: {new Date(r.lastVisited).toLocaleDateString('ja-JP')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
