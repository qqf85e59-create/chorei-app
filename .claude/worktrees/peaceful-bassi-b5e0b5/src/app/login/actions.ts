'use server';

import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    const data = Object.fromEntries(formData);
    await signIn('credentials', { ...data, redirectTo: '/' });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'メールアドレスまたはパスワードが正しくありません';
        default:
          return 'エラーが発生しました';
      }
    }
    throw error;
  }
}
