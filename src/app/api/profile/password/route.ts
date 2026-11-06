import { auth } from '@/lib/auth/server';
import { getDatabase } from '@/lib/db';
import { requireUser, requireSameOrigin, jsonBody, passwordField, HttpError, apiError } from '@/lib/api';
export async function POST(request: Request) {
 try {
  requireSameOrigin(request); const user = await requireUser(); const body = await jsonBody(request);
  const password = passwordField(body.newPassword);
  if (password !== body.confirmPassword) throw new HttpError(400, 'The new passwords do not match.');
  if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 128) throw new HttpError(400, 'Enter your current password.');
  const result = await auth.changePassword({currentPassword: body.currentPassword, newPassword: password, revokeOtherSessions: true});
  if (result.error) throw new HttpError(400, 'Password was not changed. Check your current password and try again.');
  // Managed Auth persists the password hash. The app stores only a password-free activity.
  const sql = getDatabase();
  try { await sql`INSERT INTO user_activities(user_id,action) VALUES(${user.id},'Changed password')`; } catch { /* Password change already succeeded upstream. */ }
  return Response.json({message: 'Password changed in Neon Auth. Other device sessions have been revoked.'});
 } catch(error) { return apiError(error); }
}
