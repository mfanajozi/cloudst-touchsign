import { auth } from '@/lib/auth/server';
export default auth.middleware({ loginUrl: '/auth/sign-in', publicRoutes: ['/', '/api/health'] });
export const config = { matcher: ['/dashboard/:path*'] };
