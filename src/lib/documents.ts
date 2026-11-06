import 'server-only';
import { getDatabase } from '@/lib/db';
import { HttpError, uuidField } from '@/lib/api';
import type { WorkspaceUser } from '@/lib/auth/user';
export async function documentForUser(id: string, user: WorkspaceUser) {
 uuidField(id);
 const sql = getDatabase();
 const rows = await sql`SELECT a.* FROM agreements a WHERE a.id=${id} AND (
  ${user.role === 'ADMIN'} OR a.uploader_id=${user.id} OR EXISTS (
   SELECT 1 FROM signatories s WHERE s.agreement_id=a.id AND s.auth_user_id=${user.authId}
  ))`;
 if (!rows[0]) throw new HttpError(404, 'Document not found.');
 return rows[0];
}
export async function documentsForUser(user: WorkspaceUser) {
 const sql = getDatabase();
 return sql`SELECT a.id,a.title,a.status,a.uploader_id,a.created_at,
 (SELECT count(*)::int FROM signatories s WHERE s.agreement_id=a.id) AS signer_count
 FROM agreements a WHERE ${user.role === 'ADMIN'} OR a.uploader_id=${user.id} OR EXISTS (
  SELECT 1 FROM signatories s WHERE s.agreement_id=a.id AND s.auth_user_id=${user.authId}
 ) ORDER BY a.created_at DESC LIMIT 100`;
}
