import Link from 'next/link';
import {requirePageUser} from '@/lib/auth/page-user';
import {getDatabase} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function Activity(){const user=await requirePageUser();const sql=getDatabase();
 // Even administrators see only their own actions in this personal feed. Do not join
 // document titles after an assignment is revoked: activity must not restore access.
 const events=await sql`SELECT action,created_at FROM user_activities WHERE user_id=${user.id} ORDER BY created_at DESC,id LIMIT 100`;
 return <main className="dashboard"><p className="eyebrow">MY WORKSPACE</p><h1 className="page-title">Your activity.</h1><section className="workspace-panel"><p className="field-hint">Only actions taken by your account are shown here.</p>{events.length?events.map((event,index)=><div className="activity-row" key={index}><span>{event.action}</span><time>{new Date(event.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</time></div>):<p>No activity yet. <Link href="/dashboard/documents">View your documents →</Link></p>}</section></main>;
}
