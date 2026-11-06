import { getDatabase } from '@/lib/db';
import { canManageUser } from '@/lib/access-policy';
import { requireUser, requireSameOrigin, jsonBody, stringField, phoneField, uuidField, HttpError, apiError } from '@/lib/api';
export async function PATCH(request: Request, context: {params: Promise<{id: string}>}) {
 try {
  requireSameOrigin(request); const actor = await requireUser(true); const id = uuidField((await context.params).id);
  const sql = getDatabase(); const rows = await sql`SELECT id,role,auth_user_id FROM users WHERE id=${id}`;
  const target = rows[0]; if (!target) throw new HttpError(404, 'User not found.');
  if (!canManageUser(actor, {id: target.id, role: target.role})) throw new HttpError(403, 'Administrator accounts are protected. Use Profile to edit your own account.');
  const body = await jsonBody(request); const name = stringField(body.name, 'Full name', 2, 100); const phone = phoneField(body.phone);
  if (!['UPLOADER','SIGNER'].includes(String(body.role)) || typeof body.active !== 'boolean') throw new HttpError(400, 'Invalid role or account status.');
  await sql.transaction([
   sql`UPDATE users SET display_name=${name},phone_number=${phone || null},role=${body.role as string},is_active=${body.active} WHERE id=${id} AND role <> 'ADMIN'`,
   sql`INSERT INTO user_activities(user_id,action) VALUES(${actor.id},'Updated a workspace user')`,
  ]);
  return Response.json({message: 'Workspace user updated. Inactive accounts cannot access workspace data.'});
 } catch(error) { return apiError(error); }
}
