import 'server-only';
import { createNeonAuth } from '@neon/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL || process.env.NEON_AUTH_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl || !secret || secret.length < 32) {
 throw new Error('Neon Auth requires NEON_AUTH_BASE_URL and a 32+ character NEON_AUTH_COOKIE_SECRET.');
}
export const auth = createNeonAuth({ baseUrl, cookies: { secret } });

// SDK 0.8.2 checks the serialized string before consulting its local cookie cache.
// Use a fresh managed session for workspace permissions and account operations.
export function getVerifiedSession() {
 const options = {query: {disableCookieCache: 'true'}} as unknown as Parameters<typeof auth.getSession>[0];
 return auth.getSession(options);
}
