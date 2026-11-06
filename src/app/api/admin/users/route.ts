import { createWorkspaceAccount } from '@/lib/accounts';
import { getDatabase } from '@/lib/db';
import { requireUser, requireSameOrigin, jsonBody, stringField, emailField, phoneField, HttpError, apiError } from '@/lib/api';
export async function POST(request: Request) {
 try {
  requireSameOrigin(request); const actor = await requireUser(true); const body = await jsonBody(request);
  if (body.role !== 'UPLOADER' && body.role !== 'SIGNER') throw new HttpError(400, 'Choose uploader or signer.');
  const account = await createWorkspaceAccount({name: stringField(body.name, 'Full name', 2, 100), email: emailField(body.email), phone: phoneField(body.phone), password: typeof body.password==='string'?body.password:'', role: body.role, origin: new URL(request.url).origin});
  const sql = getDatabase();
  await sql`INSERT INTO user_activities(user_id,action) VALUES(${actor.id},'Added a workspace user')`;
  return Response.json({message: account.created ? 'User created. Share their temporary password securely and ask them to change it in Profile.' : 'Existing Neon login linked to the workspace. Their existing password is unchanged.'}, {status: 201});
 } catch(error) { return apiError(error); }
}
