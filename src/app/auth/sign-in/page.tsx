import { getVerifiedSession } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import SignInForm from './sign-in-form';
export const dynamic = 'force-dynamic';
export default async function SignIn() {
 const { data: session } = await getVerifiedSession();
 if (session?.user) redirect('/dashboard');
 return <main><section className="auth-card"><p className="eyebrow">CLOUDST TOUCHSIGN</p><h1>Welcome back.</h1><p>Sign in to manage your agreements and signing workspace.</p><SignInForm /><p className="auth-help">Use the email address and password for your TouchSign account.</p><a className="secondary" href="/">← Back to TouchSign</a></section></main>;
}
