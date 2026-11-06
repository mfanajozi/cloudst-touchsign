import 'server-only';
import { getVerifiedSession } from './server';
import { getDatabase } from '@/lib/db';
import type { WorkspaceRole } from '@/lib/access-policy';
export async function getWorkspaceUser() {
 const { data: session, error } = await getVerifiedSession();
 if (error) throw new Error('Unable to verify your session. Please try again.');
 if (!session?.user) return null;
 const sql = getDatabase();
 const rows = await sql`SELECT id, email, role, display_name, phone_number, is_active FROM users WHERE auth_user_id = ${session.user.id} LIMIT 1`;
 const user = rows[0];
 if (!user || !user.is_active || !['ADMIN', 'UPLOADER', 'SIGNER'].includes(user.role)) return null;
 return { id: user.id as string, authId: session.user.id, email: user.email as string, role: user.role as WorkspaceRole, name: (user.display_name || session.user.name || '') as string, phone: (user.phone_number || '') as string };
}
export type WorkspaceUser = NonNullable<Awaited<ReturnType<typeof getWorkspaceUser>>>;
