"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEventButton({ eventId, eventTitle }: { eventId: number; eventTitle: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`本当に「${eventTitle}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/lunch/${eventId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("削除しました。");
        router.push("/dashboard");
        router.refresh();
      } else {
        alert("削除に失敗しました。");
      }
    } catch (err) {
      alert("エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
    >
      {loading ? "削除中..." : "ランチ会を削除"}
    </button>
  );
}
