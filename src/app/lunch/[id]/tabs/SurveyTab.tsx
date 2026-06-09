"use client";

import { useState, useEffect } from "react";
import { LunchEvent, SurveyResponse, User } from "@prisma/client";
import { toast } from "sonner";
import { Check, ChevronRight, Save } from "lucide-react";
import { useRouter } from "next/navigation";

type EventWithSurvey = LunchEvent & {
  surveyResponses: (SurveyResponse & { user: User })[];
  participants: { user: User }[];
};

const GENRES = ["和食", "洋食", "中華", "イタリアン", "フレンチ", "焼肉", "寿司", "ラーメン", "カレー", "カフェ", "その他"];
const BUDGETS = ["1,000円以内", "1,000円〜1,500円", "1,500円〜2,000円", "2,000円以上", "気にしない"];

export default function SurveyTab({ event, role, userId, activeStaff = [], isParticipant = true }: { event: any, role: string, userId: string, activeStaff?: any[], isParticipant?: boolean }) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const responses = event.surveyResponses || [];
  
  // If members are selected (length > 1 including organizer), use them.
  // Otherwise, use activeStaff (all active participants) for the survey target pool.
  const hasSelectedMembers = (event.participants?.length || 0) > 1;
  const targetMembers = hasSelectedMembers 
    ? event.participants.map((p: any) => p.user).filter((u: any) => u.lunchRole === 'participant')
    : activeStaff;

  // State for member wizard
  const [step, setStep] = useState(1);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    // Load prefill or current data
    fetch(`/api/lunch/${event.id}/survey`)
      .then(res => res.json())
      .then(data => {
        if (data.genres) {
          try { setSelectedGenres(JSON.parse(data.genres)); } catch (e) {}
        }
        if (data.area) setArea(data.area);
        if (data.budget) setBudget(data.budget);
        setLoaded(true);
      })
      .catch(console.error);
  }, [event.id, isAdmin]);

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handlePartialSave = async (dataToSave: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lunch/${event.id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave)
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      router.refresh();
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = async (nextStep: number) => {
    // Save partially on next
    let dataToSave: any = {};
    if (step === 1) dataToSave = { genres: JSON.stringify(selectedGenres) };
    if (step === 2) dataToSave = { area };
    if (step === 3) dataToSave = { budget };

    const ok = await handlePartialSave(dataToSave);
    if (ok) {
      setStep(nextStep);
    }
  };

  const handleComplete = async () => {
    const dataToSave = { genres: JSON.stringify(selectedGenres), area, budget };
    const ok = await handlePartialSave(dataToSave);
    if (ok) {
      toast.success("アンケートの回答を完了しました");
      setStep(4);
    }
  };

  // Admin View Rendering
  if (isAdmin) {
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
          <div className="flex justify-between items-end mb-4 border-b pb-2">
            <h3 className="text-lg font-bold text-[var(--color-primary)]">メンバー別 回答一覧</h3>
            <div className="bg-blue-50 text-[var(--color-primary)] px-3 py-1 rounded-full text-xs font-bold border border-blue-200 shadow-sm">
              回答率: {responses.length} / {targetMembers.length} 名
            </div>
          </div>
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
                {targetMembers.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">対象者がいません</td></tr>
                ) : targetMembers.map((user: any) => {
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

  // Member View Rendering (Wizard)
  if (!loaded) {
    return <div className="p-8 text-center"><div className="animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 w-8 h-8 mx-auto"></div></div>;
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className={`text-xs font-bold ${step >= 1 ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}>ジャンル</span>
          <span className={`text-xs font-bold ${step >= 2 ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}>エリア</span>
          <span className={`text-xs font-bold ${step >= 3 ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}>予算</span>
          <span className={`text-xs font-bold ${step >= 4 ? 'text-green-600' : 'text-gray-400'}`}>完了</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full flex overflow-hidden">
          <div className={`h-full transition-all duration-300 ${step === 4 ? 'bg-green-500' : 'bg-[var(--color-primary)]'}`} style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm min-h-[300px] flex flex-col">
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-[#00135D]">食べたいジャンルは？</h3>
            <p className="text-sm text-gray-500 mb-6">複数選択できます。気分に合わせて選んでください。</p>
            
            <div className="flex flex-wrap gap-2 mb-8 flex-1">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  disabled={!isParticipant}
                  className={`px-4 py-2 rounded-full border font-medium text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    selectedGenres.includes(g) 
                      ? "bg-[#00135D] text-white border-[#00135D] shadow-md" 
                      : "bg-white text-gray-700 border-gray-300 hover:border-[#00135D] hover:bg-blue-50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            
            <div className="flex justify-end mt-auto pt-4 border-t border-gray-100">
              {isParticipant && (
                <button
                  onClick={() => handleNextStep(2)}
                  disabled={saving}
                  className="flex items-center gap-1 bg-[#00135D] text-white px-6 py-2.5 rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                  {saving ? "保存中..." : "次へ"}
                  {!saving && <ChevronRight className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-[#00135D]">希望のエリアは？</h3>
            <p className="text-sm text-gray-500 mb-6">移動可能な範囲やお店の場所など、ご希望があれば入力してください。</p>
            
            <div className="flex-1">
              <input
                type="text"
                value={area}
                onChange={e => setArea(e.target.value)}
                disabled={!isParticipant}
                placeholder="例: 仙台駅西口周辺、オフィスから徒歩10分圏内"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0070CC] focus:border-[#0070CC] outline-none text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-2 ml-1">※空欄でも構いません</p>
            </div>
            
            <div className="flex justify-between mt-auto pt-4 border-t border-gray-100">
              <button
                onClick={() => setStep(1)}
                className="text-gray-500 font-medium px-4 py-2 hover:bg-gray-50 rounded-lg"
              >
                戻る
              </button>
              {isParticipant && (
                <button
                  onClick={() => handleNextStep(3)}
                  disabled={saving}
                  className="flex items-center gap-1 bg-[#00135D] text-white px-6 py-2.5 rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                  {saving ? "保存中..." : "次へ"}
                  {!saving && <ChevronRight className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <h3 className="text-lg font-bold mb-2 text-[#00135D]">予算感は？</h3>
            <p className="text-sm text-gray-500 mb-6">ランチの予算目安を選択してください。</p>
            
            <div className="space-y-3 mb-8 flex-1">
              {BUDGETS.map(b => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  disabled={!isParticipant}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    budget === b 
                      ? "bg-[#E8F2FB] border-[#0070CC] text-[#00135D]" 
                      : "bg-white border-gray-200 text-gray-600 hover:border-[#0070CC]/40 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{b}</span>
                    {budget === b && <Check className="w-5 h-5 text-[#0070CC]" />}
                  </div>
                </button>
              ))}
            </div>
            
            <div className="flex justify-between mt-auto pt-4 border-t border-gray-100">
              <button
                onClick={() => setStep(2)}
                className="text-gray-500 font-medium px-4 py-2 hover:bg-gray-50 rounded-lg"
              >
                戻る
              </button>
              {isParticipant && (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold disabled:opacity-50 transition-colors shadow-md"
                >
                  {saving ? "保存中..." : (
                    <>
                      <Save className="w-4 h-4" />
                      回答を完了する
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex-1 flex flex-col items-center justify-center animate-fade-in py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-[#00135D] mb-2">回答ありがとうございました</h3>
            <p className="text-sm text-gray-500 text-center mb-8">
              アンケートの回答を保存しました。<br />
              後から変更することも可能です。
            </p>
            
            <button
              onClick={() => setStep(1)}
              className="text-[#0070CC] font-bold text-sm underline hover:text-[#1E3A8A]"
            >
              回答を修正する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
