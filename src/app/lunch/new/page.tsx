import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import NewLunchForm from "./NewLunchForm";

export default async function NewLunchPage() {
  const session = await auth();

  // 主催者はログイン中の本人。当番選択は廃止したため候補取得は不要。
  // 作成可能なのは lunchRole='organizer'（または朝礼運営 admin）のユーザーのみ。
  if (!session) {
    redirect("/login");
  }
  const { role, lunchRole } = session.user as { role?: string; lunchRole?: string };
  if (role !== "admin" && lunchRole !== "organizer") {
    redirect("/history");
  }

  return (
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] accent-bar pl-3">新規ランチ会 作成</h2>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <NewLunchForm />
        </div>
      </main>
  );
}
