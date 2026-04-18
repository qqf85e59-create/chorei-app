'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-primary/5 via-white to-brand-accent/5 px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo area */}
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.attax.co.jp/group/wp-content/uploads/group_logo_head.png"
            alt="アタックスグループ"
            className="mx-auto h-12 w-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-brand-primary">
            仙台事務所 朝礼運営
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            朝礼運営アプリケーションにログインしてください
          </p>
        </div>

        <Card className="border-brand-border shadow-lg shadow-brand-primary/5">
          <CardHeader className="text-center">
            <CardTitle className="text-lg text-brand-primary">
              ログイン
            </CardTitle>
            <CardDescription>
              メールアドレスとパスワードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-brand-danger/20 bg-red-50 p-3 text-sm text-brand-danger animate-fade-in">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-brand-text">
                  メールアドレス
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@attax.co.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-brand-border focus:ring-brand-accent"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-brand-text">
                  パスワード
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-brand-border focus:ring-brand-accent"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ログイン中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    ログイン
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © アタックス・ビジネス・コンサルティング
        </p>
      </div>
    </div>
  );
}
