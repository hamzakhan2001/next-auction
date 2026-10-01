import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const protectedPaths = ['/dashboard', '/products/new'];
const authPaths = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  const isAuctionConfig = /^\/products\/[^/]+\/auction$/.test(pathname);
  const isAuthPage = authPaths.some((p) => pathname === p);

  if (isProtected || isAuctionConfig) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('token');
      return response;
    }
  }

  if (isAuthPage && token) {
    const decoded = await verifyToken(token);
    if (decoded) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/products/new',
    '/products/:productId/auction',
    '/login',
    '/register',
  ],
};
