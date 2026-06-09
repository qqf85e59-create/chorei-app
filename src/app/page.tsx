import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const userRole = session.user.role;

  if (userRole === 'admin') {
    redirect('/dashboard');
  } else {
    redirect('/home');
  }
}
