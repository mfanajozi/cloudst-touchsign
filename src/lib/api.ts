import 'server-only';
import { randomUUID } from 'node:crypto';
import { SigningInputError } from '@/lib/signing/validation.mjs';
import { classifyProviderError } from '@/lib/auth/provider-errors.mjs';
import { getWorkspaceUser } from '@/lib/auth/user';
export class HttpError extends Error {
 constructor(public status: number, message: string) { super(message); }
}
export async function requireUser(admin = false) {
 const user = await getWorkspaceUser();
 if (!user) throw new HttpError(401, 'Sign in with an active workspace account.');
 if (admin && user.role !== 'ADMIN') throw new HttpError(403, 'Administrator access required.');
 return user;
}
export function requireSameOrigin(request: Request) {
 const origin = request.headers.get('origin');
 if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, 'Request origin is not allowed.');
}
export async function jsonBody(request: Request, maxBytes=20000) {
 const length = Number(request.headers.get('content-length') || 0);
 if (length > maxBytes) throw new HttpError(413, 'Request is too large.');
 try { const text = await request.text(); if (text.length > maxBytes) throw new HttpError(413, 'Request is too large.'); const data = JSON.parse(text); if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error(); return data as Record<string, unknown>; }
 catch(error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid request.'); }
}
export function stringField(value: unknown, label: string, min = 1, max = 255) {
 if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new HttpError(400, `${label} must contain ${min}–${max} characters.`);
 return value.trim();
}
export function emailField(value: unknown) {
 const email = stringField(value, 'Email', 3, 254).toLowerCase();
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
 return email;
}
export function passwordField(value: unknown) {
 if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new HttpError(400, 'Use a password of 12–128 characters.');
 return value;
}
export function phoneField(value: unknown, required = false) {
 const phone = typeof value === 'string' ? value.trim() : '';
 if ((!phone && required) || (phone && !/^\+27[1-9][0-9]{8}$/.test(phone))) throw new HttpError(400, 'Use a South African phone number, e.g. +27821234567.');
 return phone;
}
export function uuidField(value: string) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(404, 'Record not found.'); return value; }
export function apiError(error: unknown) {
 if (error instanceof SigningInputError) return Response.json({error:error.message},{status:400});
 if (error instanceof HttpError) return Response.json({error: error.message}, {status: error.status});
 const code = (error as {code?: string})?.code;
 if(code==='P0409')return Response.json({error:'This document changed while you were working. Refresh it and try again.'},{status:409});
 if(code==='P0403')return Response.json({error:'This document is locked, its signing setup is frozen, or this action is not permitted.'},{status:403});
 if(code==='P0400')return Response.json({error:'Every signer needs an assigned signature field before signing can start.'},{status:400});
 if(['42P01','42703','42883'].includes(code||''))return Response.json({error:'The signing database needs its latest update. Contact your administrator.'},{status:503});
 if (code === '23505') return Response.json({error: 'This account or signer already exists.'}, {status: 409});
 if (code === 'P0001') return Response.json({error: 'This document is locked or already has the maximum ten signers.'}, {status: 409});
 return Response.json({error: 'The request could not be completed. Please try again.'}, {status: 503});
}
export function providerError(error: {status?: number; code?: string; message?: string} | null | undefined, operation='account-operation') {
 if (!error) return;
 const failure=classifyProviderError(error);
 const reference=randomUUID();
 console.error('[touchsign] neon_account_operation_failed',{reference,operation,code:failure.code,upstreamStatus:error.status});
 throw new HttpError(failure.status,`${failure.message} Reference: ${reference}`);
}
