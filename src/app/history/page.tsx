import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Calendar, Users, Utensils, Plus, ChevronRight } from "lucide-react";

export default async function HistoryPage() {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }

  const { role, lunchStatus } = session.user;
  if (role !== "admin" && lunchStatus !== "active") {
    redirect("/home");
  }

  const allEvents = await prisma.lunchEvent.findMany({
    orderBy: { createdAt: "desc" },
    include: { restaurant: true },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "planning": return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">準備中</span>;
      case "scheduled": return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">開催予定</span>;
      case "completed": return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">開催済み</span>;
      case "cancelled": return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">中止</span>;
      default: return null;
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Utensils className="w-6 h-6 text-[var(--color-primary)]" />
            ランチ会管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">ランチ会の企画や過去の履歴を確認できます</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/restaurants">
            <button className="bg-white hover:bg-gray-50 text-[var(--color-primary)] border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
              <MapPin className="w-4 h-4" />
              利用店舗の履歴
            </button>
          </Link>
          {role === "admin" && (
            <Link href="/lunch/new">
              <button className="bg-[var(--color-primary)] hover:bg-[var(--color-sub)] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" />
                新規作成
              </button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-6 py-4 font-semibold border-b">タイトル</th>
              <th className="px-6 py-4 font-semibold border-b">ステータス</th>
              <th className="px-6 py-4 font-semibold border-b">開催日</th>
              <th className="px-6 py-4 font-semibold border-b">利用店舗</th>
              <th className="px-6 py-4 font-semibold border-b text-center">詳細</th>
            </tr>
          </thead>
          <tbody>
            {allEvents.map(event => (
              <tr key={event.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-[var(--color-primary)]">{event.title}</td>
                <td className="px-6 py-4">{getStatusBadge(event.status)}</td>
                <td className="px-6 py-4 text-gray-600">
                  {event.confirmedDate 
                    ? new Date(event.confirmedDate).toLocaleDateString('ja-JP') 
                    : <span className="text-gray-400">未定</span>}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {event.restaurant ? event.restaurant.name : <span className="text-gray-400">-</span>}
                </td>
                <td className="px-6 py-4 text-center">
                  <Link href={`/lunch/${event.id}`}>
                    <button className="text-[var(--color-primary)] hover:bg-blue-50 p-2 rounded-full transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </Link>
                </td>
              </tr>
            ))}
            {allEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  ランチ会の記録はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
