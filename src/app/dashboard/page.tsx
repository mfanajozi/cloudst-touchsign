import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/page-user';
import { getDatabase } from '@/lib/db';
import SignOutButton from './sign-out-button';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
 const user = await requirePageUser();
 const sql = getDatabase();
 // Administrators see all records; other accounts see owned or assigned agreements.
 const counts = user.role === 'ADMIN'
  ? await sql`SELECT status, count(*)::int AS total FROM agreements GROUP BY status`
  : await sql`SELECT a.status, count(*)::int AS total FROM agreements a WHERE a.uploader_id=${user.id} OR EXISTS(SELECT 1 FROM signatories s WHERE s.agreement_id=a.id AND s.auth_user_id=${user.authId}) GROUP BY a.status`;
 const total = (status: string) => Number(counts.find(row => row.status === status)?.total || 0);
 return <main className="dashboard"><div className="dashboard-heading"><div><p className="eyebrow">{user.role === 'ADMIN' ? 'ADMINISTRATOR WORKSPACE' : user.role === 'SIGNER' ? 'SIGNER WORKSPACE' : 'UPLOADER WORKSPACE'}</p><h1>Welcome, {user.name || 'back'}.</h1><p className="intro">{user.email}</p></div><SignOutButton /></div><section className="dashboard-stats" aria-label="Agreement status">{[['Draft agreements', 'DRAFT'], ['Awaiting signatures', 'SIGNING'], ['Completed agreements', 'LOCKED']].map(([label, status]) => <article key={status}><p>{label}</p><strong>{total(status)}</strong></article>)}</section><section className="workspace-panel"><p className="eyebrow">YOUR AGREEMENTS</p><h2>Your agreements, in one place.</h2><p>You’re signed in with {user.role.toLowerCase()} access. Manage your profile, review your activity and open the documents available to your account.</p><div className="actions"><Link className="button" href="/dashboard/documents">Open documents ↗</Link><Link className="secondary" href="/dashboard/profile">Manage my profile →</Link>{user.role === 'ADMIN' && <Link className="secondary" href="/dashboard/users">Manage users →</Link>}</div></section></main>;
}
