'use server';

import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';

  // ① 入力チェック
  if (!email || !password) {
    return 'メールアドレスとパスワードを入力してください';
  }

  // ② DB で事前検証（具体的なエラーメッセージを返す）
  //    ※ credentials が正しければここで通過し、下の signIn でも必ず成功する
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return `「${email}」は登録されていません`;
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return 'パスワードが正しくありません';
    }
  } catch {
    return 'サーバーエラーが発生しました。しばらく待ってから再試行してください';
  }

  // ③ NextAuth でセッション発行
  //    redirectTo: '/' → ルートページ（サーバーサイド）が role に応じて
  //    /dashboard または /home へ安全にリダイレクトする。
  //    /home へ直接飛ばすとクライアントの useSession() のタイミング問題で
  //    一瞬 status==='unauthenticated' になり /login に戻るループが発生する。
  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (error) {
    if (error instanceof AuthError) {
      // ここに来るのは NEXT_REDIRECT 以外の本物のエラーのみ
      return `ログインに失敗しました。ページを再読み込みして再試行してください（${error.type}）`;
    }
    // NEXT_REDIRECT は正常なリダイレクト指示なので必ず再スロー
    throw error;
  }
}
