import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  // Edge環境で動作するように、DB等に依存しない getToken を使用
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.AUTH_URL?.startsWith('https://');
  const cookieName = isProduction ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const token = await getToken({ 
    req: request, 
    secret: process.env.AUTH_SECRET,
    secureCookie: isProduction,
    salt: cookieName,
  });
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Admin-only routes
  const adminRoutes = ['/dashboard', '/rotation', '/members'];
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    if (token.role !== 'admin') {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
};
