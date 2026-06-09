import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Calendar, Users } from "lucide-react";

export default async function HistoryPage() {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }

  // 過去のランチ会を取得 (statusがcompleted または scheduledで過去の日付のもの等。ここではすべて取得して降順に)
  const pastEvents = await prisma.lunchEvent.findMany({
    where: {
      status: { in: ['completed', 'scheduled'] }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      organizer: true,
      restaurant: true,
      participants: { include: { user: true } }
    }
  });

  return (
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] accent-bar pl-3">開催・お店履歴</h2>
          {session.user?.role === 'admin' && (
            <Link href="/lunch/new" className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md text-sm font-semibold hover:bg-orange-600 transition-colors">
              ＋ 新規作成
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--color-panel)] text-[var(--color-primary)]">
              <tr>
                <th className="px-4 py-3 border-b font-bold">開催月 / 名称</th>
                <th className="px-4 py-3 border-b font-bold">利用店舗</th>
                <th className="px-4 py-3 border-b font-bold">開催日</th>
                <th className="px-4 py-3 border-b font-bold hidden md:table-cell">参加者</th>
              </tr>
            </thead>
            <tbody>
              {pastEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    過去の開催記録はありません。
                  </td>
                </tr>
              )}
              {pastEvents.map((event) => (
                <tr key={event.id} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link href={`/lunch/${event.id}`} className="hover:text-[var(--color-accent)] hover:underline">
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {event.restaurant ? (
                      <div>
                        <div className="font-bold text-[var(--color-primary)] flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {event.restaurant.name}
                        </div>
                        <div className="text-xs text-gray-500 ml-5">{event.restaurant.genre}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {event.confirmedDate ? new Date(event.confirmedDate).toLocaleDateString('ja-JP') : <span className="text-gray-400">未定</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex -space-x-2">
                      {event.participants.map(p => (
                        <div key={p.id} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-800" title={p.user.name}>
                          {p.user.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
  );
}
