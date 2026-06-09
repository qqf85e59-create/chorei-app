import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { prisma } from "@/lib/prisma";
import NewLunchForm from "./NewLunchForm";

export default async function NewLunchPage() {
  const session = await auth();
  
  if (!session || session.user?.role !== "admin") {
    redirect("/dashboard");
  }

  // 直近のランチ会から次回の自動担当者を決定する
  const latestEvent = await prisma.lunchEvent.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { organizer: true }
  });

  // 主催者一覧を取得
  const organizers = await prisma.user.findMany({
    where: { role: 'admin', deletedAt: null }
  });

  // 篠原(Shinohara)と水谷(Mizutani)の交代ロジック
  // もし前回が篠原なら次回は水谷、それ以外なら篠原（またはデフォルト）
  let nextOrganizerId = organizers[0]?.id; // default
  
  if (latestEvent) {
    const lastOrganizerId = latestEvent.organizerId;
    const nextOrganizer = organizers.find(o => o.id !== lastOrganizerId);
    if (nextOrganizer) {
      nextOrganizerId = nextOrganizer.id;
    }
  }

  return (
      <main className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] accent-bar pl-3">新規ランチ会 作成</h2>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <NewLunchForm 
            organizers={organizers} 
            defaultOrganizerId={nextOrganizerId} 
          />
        </div>
      </main>
  );
}
