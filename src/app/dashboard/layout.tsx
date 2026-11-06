import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/page-user';
export default async function DashboardLayout({children}:{children:React.ReactNode}) {
 const user=await requirePageUser();
 return <><nav className="workspace-nav" aria-label="Workspace"><Link href="/dashboard">Overview</Link><Link href="/dashboard/documents">Documents</Link><Link href="/dashboard/activity">My activity</Link><Link href="/dashboard/profile">My profile</Link>{user.role==='ADMIN'&&<Link href="/dashboard/users">Manage users</Link>}</nav>{children}</>;
}
