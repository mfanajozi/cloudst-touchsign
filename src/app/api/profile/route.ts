import { auth } from '@/lib/auth/server';
import { getDatabase } from '@/lib/db';
import { requireUser, requireSameOrigin, jsonBody, stringField, phoneField, providerError, apiError } from '@/lib/api';
export async function PATCH(request: Request) {
 try {
  requireSameOrigin(request); const user = await requireUser(); const body = await jsonBody(request);
  const name = stringField(body.name, 'Full name', 2, 100); const phone = phoneField(body.phone);
  const result = await auth.updateUser({name}); providerError(result.error,'update-own-profile');
  const sql = getDatabase();
  await sql.transaction([
   sql`UPDATE users SET display_name=${name},phone_number=${phone || null} WHERE id=${user.id}`,
   sql`INSERT INTO user_activities(user_id,action) VALUES(${user.id},'Updated profile')`,
  ]);
  return Response.json({message: 'Profile updated.'});
 } catch(error) { return apiError(error); }
}
