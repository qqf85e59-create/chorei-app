"use client";

import { LunchEvent, SurveyResponse, User } from "@prisma/client";

type EventWithSurvey = LunchEvent & {
  surveyResponses: (SurveyResponse & { user: User })[];
};

export default function SurveyTab({ event }: { event: any }) {
  const responses = event.surveyResponses || [];
  const participants = event.participants?.map((p: any) => p.user) || [];

  // Aggregate genres
  const genreCount: Record<string, number> = {};
  responses.forEach((r: any) => {
    try {
      const genres = JSON.parse(r.genres || "[]");
      genres.forEach((g: string) => {
        genreCount[g] = (genreCount[g] || 0) + 1;
      });
    } catch(e) {}
  });
  
  const sortedGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold mb-4 border-b pb-2 text-[var(--color-primary)]">希望ジャンル ランキング</h3>
        {sortedGenres.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {sortedGenres.map(([genre, count], idx) => (
              <div key={genre} className="bg-[var(--color-panel)] border border-blue-200 text-[var(--color-primary)] px-4 py-2 rounded-full flex items-center gap-2 shadow-sm">
                <span className="font-bold text-lg">{idx + 1}位</span>
                <span>{genre}</span>
                <span className="bg-white text-[var(--color-primary)] text-xs px-2 py-1 rounded-full font-bold">{count}票</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">ジャンルの希望はありません。</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4 border-b pb-2 text-[var(--color-primary)]">メンバー別 回答一覧</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 border-b font-semibold">メンバー</th>
                <th className="px-4 py-3 border-b font-semibold">希望ジャンル</th>
                <th className="px-4 py-3 border-b font-semibold">希望エリア</th>
                <th className="px-4 py-3 border-b font-semibold">予算感</th>
              </tr>
            </thead>
            <tbody>
              {participants.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">参加者がいません</td></tr>
              ) : participants.map((user: any) => {
                const response = responses.find((r: any) => r.userId === user.id);
                
                if (!response) {
                  return (
                    <tr key={user.id} className="border-b hover:bg-gray-50 last:border-b-0 bg-red-50/30">
                      <td className="px-4 py-3 font-medium text-[var(--color-primary)]">{user.name}</td>
                      <td colSpan={3} className="px-4 py-3 text-red-500 font-bold text-sm">未回答</td>
                    </tr>
                  );
                }

                let genres = [];
                try { genres = JSON.parse(response.genres || "[]"); } catch(e) {}
                
                return (
                  <tr key={user.id} className="border-b hover:bg-gray-50 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--color-primary)]">{user.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {genres.map((g: string) => (
                          <span key={g} className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-xs text-blue-700">{g}</span>
                        ))}
                        {genres.length === 0 && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{response.area || <span className="text-gray-400">-</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{response.budget || <span className="text-gray-400">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
