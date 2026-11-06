'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
export default function SignOutButton() {
 const router = useRouter();
 const [pending, setPending] = useState(false);
 const [error, setError] = useState('');
 async function signOut() {
  setPending(true); setError('');
  try {
   const result = await authClient.signOut();
   if (result.error) throw new Error('Sign-out failed');
   router.replace('/auth/sign-in'); router.refresh();
  } catch { setError('Could not sign out. Please try again.'); setPending(false); }
 }
 return <div><button className="outline-button" disabled={pending} onClick={signOut}>{pending ? 'Signing out…' : 'Sign out'}</button><p className="form-error" role="alert">{error}</p></div>;
}
