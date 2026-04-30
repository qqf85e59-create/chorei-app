'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.trim() ?? '';
    const password = (formData.get('password') as string) ?? '';

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    setIsPending(true);
    try {
      // next-auth/react の signIn は CSRF・Cookie 設定を内部で確実に処理する。
      // Server Action 経由の NEXT_REDIRECT 依存をなくし、タイミング問題を解消。
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('メールアドレスまたはパスワードが正しくありません');
        setIsPending(false);
        return;
      }

      // ルートページ（サーバーサイド）がロール別に /dashboard or /home へ振り分ける
      router.push('/');
      router.refresh();
    } catch {
      setError('通信エラーが発生しました。再試行してください');
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#F0F4FB] via-white to-[#EEF2F9]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 min-h-screen">
        <div className="w-full max-w-[400px]">

          {/* Logo + title */}
          <div className="text-center mb-9">
            <div className="inline-flex items-center justify-center bg-white rounded-[16px] px-6 py-3.5 shadow-[0_4px_20px_rgba(0,19,93,0.10)] mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.attax.co.jp/group/wp-content/uploads/group_logo_head.png"
                alt="アタックスグループ" className="h-8 w-auto"
              />
            </div>
            <h1 className="text-[20px] font-bold text-[#00135D] tracking-tight mb-1.5">
              仙台事務所 朝礼運営
            </h1>
            <p className="text-sm text-muted-foreground">アカウント情報を入力してください</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-[16px] shadow-[0_8px_40px_rgba(0,19,93,0.10),0_2px_8px_rgba(0,19,93,0.05)] px-8 py-8">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-[#FEF2F2] border border-[#FCCACA] rounded-lg text-sm text-[#C0392B] mb-5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-[#3D4252] mb-1.5 tracking-wide">
                  メールアドレス
                </label>
                <input id="email" name="email" type="email" placeholder="name@attax.co.jp" required
                  className="w-full font-[inherit] text-sm px-3 py-2.5 border border-[#E0E4EF] rounded-lg text-[#1A1D23] bg-white outline-none transition-all focus:border-[#0070CC] focus:ring-4 focus:ring-[#0070CC]/10" />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-[#3D4252] mb-1.5 tracking-wide">
                  パスワード
                </label>
                <input id="password" name="password" type="password" placeholder="••••••••" required
                  className="w-full font-[inherit] text-sm px-3 py-2.5 border border-[#E0E4EF] rounded-lg text-[#1A1D23] bg-white outline-none transition-all focus:border-[#0070CC] focus:ring-4 focus:ring-[#0070CC]/10" />
              </div>
              <button type="submit" disabled={isPending}
                className="w-full h-11 rounded-xl bg-[#00135D] text-white font-bold text-sm flex items-center justify-center gap-2 mt-1 cursor-pointer border-none font-[inherit] shadow-[0_4px_14px_rgba(0,19,93,0.3)] hover:bg-[#1E3A8A] disabled:opacity-70 disabled:cursor-not-allowed transition-colors">
                {isPending ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />ログイン中...</>
                ) : (
                  <><LogIn className="h-4 w-4" />ログイン</>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © アタックス・ビジネス・コンサルティング
          </p>
        </div>
      </div>
    </div>
  );
}
