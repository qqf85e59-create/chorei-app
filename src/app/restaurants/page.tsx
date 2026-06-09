import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Utensils, ChevronRight, Store, ExternalLink } from "lucide-react";

export default async function RestaurantsPage() {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }

  const { role, lunchStatus } = session.user as any;
  if (role !== "admin" && lunchStatus !== "active") {
    redirect("/home");
  }

  const restaurants = await prisma.restaurant.findMany({
    include: {
      events: {
        select: { id: true, title: true, confirmedDate: true, status: true },
        orderBy: { confirmedDate: "desc" }
      }
    },
    orderBy: [
      { lastVisited: "desc" },
      { visitCount: "desc" }
    ]
  });

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-[var(--color-primary)]" />
            利用店舗の履歴
          </h1>
          <p className="text-sm text-gray-500 mt-1">過去に利用したことのある店舗の一覧と訪問回数を確認できます</p>
        </div>
        <Link href="/history">
          <button className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            ランチ管理へ戻る
          </button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-6 py-4 font-semibold border-b">店舗名</th>
              <th className="px-6 py-4 font-semibold border-b">ジャンル</th>
              <th className="px-6 py-4 font-semibold border-b">エリア</th>
              <th className="px-6 py-4 font-semibold border-b text-center">訪問回数</th>
              <th className="px-6 py-4 font-semibold border-b">最終利用日</th>
              <th className="px-6 py-4 font-semibold border-b">利用したランチ会</th>
            </tr>
          </thead>
          <tbody>
            {restaurants.map(restaurant => (
              <tr key={restaurant.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-[var(--color-primary)]">
                  <div className="flex flex-col gap-1">
                    <span>{restaurant.name}</span>
                    <div className="flex gap-2">
                      {restaurant.url && (
                        <a href={restaurant.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> URL
                        </a>
                      )}
                      {restaurant.mapUrl && (
                        <a href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Map
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-200">{restaurant.genre}</span>
                </td>
                <td className="px-6 py-4 text-gray-600">{restaurant.area || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className="font-bold text-lg">{restaurant.visitCount}</span><span className="text-xs text-gray-500 ml-1">回</span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {restaurant.lastVisited 
                    ? new Date(restaurant.lastVisited).toLocaleDateString('ja-JP') 
                    : <span className="text-gray-400">未記録</span>}
                </td>
                <td className="px-6 py-4">
                  {restaurant.events.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {restaurant.events.slice(0, 3).map(event => (
                        <Link key={event.id} href={`/lunch/${event.id}`} className="text-xs text-[var(--color-primary)] hover:underline flex items-center">
                          <ChevronRight className="w-3 h-3" /> {event.title}
                        </Link>
                      ))}
                      {restaurant.events.length > 3 && (
                        <span className="text-xs text-gray-400 pl-1">他 {restaurant.events.length - 3} 件...</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
            {restaurants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  店舗の記録はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
