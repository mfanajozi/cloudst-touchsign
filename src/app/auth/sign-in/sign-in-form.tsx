'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
export default function SignInForm() {
 const router = useRouter();
 const [pending, setPending] = useState(false);
 const [error, setError] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (pending) return;
  const form = new FormData(event.currentTarget);
  setPending(true); setError('');
  try {
   const result = await authClient.signIn.email({ email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') });
   if (result.error) {
    setError(result.error.code === 'EMAIL_NOT_VERIFIED' ? 'Please verify your email address before signing in.' : 'Sign-in failed. Check your email and password and try again.');
    setPending(false); return;
   }
   router.replace('/dashboard'); router.refresh();
  } catch {
   setError('Unable to reach the sign-in service. Please try again.');
   setPending(false);
  }
 }
 return <form className="auth-form" onSubmit={submit} aria-busy={pending}>
  <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} placeholder="you@company.co.za" />
  <label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} disabled={pending} /><button type="button" className="password-toggle" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
  <p className="form-error" role="alert" aria-live="polite">{error}</p>
  <button className="button" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in to workspace'}<span aria-hidden>↗</span></button>
 </form>;
}
