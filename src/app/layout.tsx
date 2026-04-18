import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "仙台事務所 朝礼運営アプリ | アタックスグループ",
  description: "アタックス・ビジネス・コンサルティング仙台事務所の朝礼運営支援アプリケーション。関係性の質向上を目的とした朝礼の輪番管理、出欠記録、主題管理を行います。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <TooltipProvider>
            <Header />
            <main className="flex-1">{children}</main>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
