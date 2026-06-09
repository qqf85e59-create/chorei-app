"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLunchForm() {
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const englishMonth = d.toLocaleString('en-US', { month: 'long' });
      options.push({
        label: `${d.getFullYear()}年${d.getMonth() + 1}月度`,
        title: `仙台Synergy Bites ${d.getFullYear()} ${englishMonth}`
      });
    }
    return options;
  };
  const monthOptions = generateMonthOptions();
  
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 主催者はログイン中の本人。サーバー側でセッションから設定する。
      const res = await fetch("/api/lunch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedMonth.title }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/lunch/${data.id}`);
      } else if (res.status === 409) {
        alert("今月のランチ会は既に存在します");
      } else {
        alert("作成に失敗しました");
      }
    } catch (err) {
      console.error(err);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          対象の月を選択してください
        </label>
        <div className="grid grid-cols-3 gap-3">
          {monthOptions.map((month) => (
            <button
              key={month.label}
              type="button"
              onClick={() => setSelectedMonth(month)}
              className={`py-3 px-2 md:px-4 rounded border text-center transition-all ${
                selectedMonth.label === month.label
                  ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)] font-bold shadow-sm ring-1 ring-[var(--color-primary)]"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              {month.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">※タイトルは「{selectedMonth.title}」として登録されます</p>
      </div>

      <p className="text-xs text-gray-500">※主催者はログイン中のあなたとして登録されます</p>

      <div className="pt-4 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-sub)] disabled:opacity-50 font-medium"
        >
          {loading ? "作成中..." : "作成して管理画面へ"}
        </button>
      </div>
    </form>
  );
}
