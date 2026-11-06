import { managedAdmin } from '@/lib/auth/admin';
import { getDatabase } from '@/lib/db';
import { canManageUser } from '@/lib/access-policy';
import { requireUser, requireSameOrigin, jsonBody, passwordField, uuidField, HttpError, providerError, apiError } from '@/lib/api';
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
 try {
  requireSameOrigin(request); const actor = await requireUser(true); const id = uuidField((await context.params).id);
  const sql = getDatabase(); const rows = await sql`SELECT id,role,auth_user_id FROM users WHERE id=${id}`;
  const target = rows[0]; if (!target) throw new HttpError(404, 'User not found.');
  if (!canManageUser(actor, {id: target.id,role: target.role})) throw new HttpError(403, 'Use Profile to change your own password. Administrator accounts are protected.');
  const body = await jsonBody(request); const password = passwordField(body.password);
  const result = await managedAdmin.setUserPassword({userId: target.auth_user_id, newPassword: password}); providerError(result.error,'reset-user-password');
  const revoked = await managedAdmin.revokeUserSessions({userId: target.auth_user_id});
  try { await sql`INSERT INTO user_activities(user_id,action) VALUES(${actor.id},'Reset a user password')`; } catch { /* Upstream password change already committed. */ }
  return Response.json({message: revoked.error ? 'Password reset. Existing sessions could not be revoked; retry session revocation in Neon Console.' : 'Password reset and existing sessions revoked. Share the new password securely.'});
 } catch(error) { return apiError(error); }
}
