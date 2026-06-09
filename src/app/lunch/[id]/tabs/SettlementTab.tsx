"use client";

import { useState, useEffect } from "react";
import { User, LunchEvent, Participation, Settlement } from "@prisma/client";

type EventWithParticipants = LunchEvent & {
  participants: (Participation & { user: User })[];
};

type Props = {
  event: EventWithParticipants;
};

export default function SettlementTab({ event }: Props) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [payerId, setPayerId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [status, setStatus] = useState<"unpaid" | "paid">("unpaid");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const participants = event.participants;
  const participantCount = participants.length;

  useEffect(() => {
    fetchSettlement();
  }, [event.id]);

  const fetchSettlement = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lunch/${event.id}/settlement`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setSettlement(data);
          setTotalAmount(data.totalAmount.toString());
          setPayerId(data.payerId.toString());
          setNote(data.note || "");
          setStatus(data.status as "unpaid" | "paid");
        }
      }
    } catch (err) {
      console.error(err);
      setError("精算情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalAmount || !payerId) {
      setError("総額と支払者を指定してください");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      
      const res = await fetch(`/api/lunch/${event.id}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: parseInt(totalAmount, 10),
          payerId: parseInt(payerId, 10),
          status,
          note
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }

      const data = await res.json();
      setSettlement(data);
      setSuccess("精算情報を保存しました");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>;
  }

  // 自動計算
  const parsedTotal = parseInt(totalAmount, 10);
  const perPerson = !isNaN(parsedTotal) && participantCount > 0 
    ? Math.ceil(parsedTotal / participantCount) 
    : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-[var(--color-panel)] p-4 rounded-lg border border-gray-100 mb-6">
        <h3 className="text-lg font-bold text-[var(--color-primary)] mb-2">精算設定</h3>
        <p className="text-sm text-gray-600">
          立て替えた人と総額を入力して、参加人数（{participantCount}人）で割り勘の金額を計算します。
        </p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-50 text-green-600 rounded-md text-sm">{success}</div>}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">総額（円）</label>
            <input
              type="number"
              min="0"
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="例: 5000"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">立て替えた人</label>
            <select
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
            >
              <option value="">選択してください</option>
              {participants.map(p => (
                <option key={p.user.id} value={p.user.id}>{p.user.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col items-center justify-center space-y-1">
          <span className="text-sm text-gray-500">1人あたり（切り上げ）</span>
          <span className="text-3xl font-bold text-gray-800">
            {perPerson > 0 ? `${perPerson.toLocaleString()} 円` : "--- 円"}
          </span>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">精算ステータス</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="unpaid"
                checked={status === "unpaid"}
                onChange={() => setStatus("unpaid")}
                className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-sm">未精算</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value="paid"
                checked={status === "paid"}
                onChange={() => setStatus("paid")}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-green-700">精算完了</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">メモ（任意）</label>
          <textarea
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="支払先のPayPay IDなど"
            rows={2}
          />
        </div>

        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[var(--color-primary)] text-white rounded font-medium hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </form>
    </div>
  );
}
