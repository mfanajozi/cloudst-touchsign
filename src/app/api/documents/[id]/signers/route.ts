import { getDatabase } from '@/lib/db';
import { documentForUser } from '@/lib/documents';
import { canManageDocument } from '@/lib/access-policy';
import { createWorkspaceAccount } from '@/lib/accounts';
import { requireUser, requireSameOrigin, jsonBody, stringField, emailField, phoneField, HttpError, apiError } from '@/lib/api';
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
 try {
  requireSameOrigin(request); const actor = await requireUser(); const {id} = await context.params;
  const document = await documentForUser(id,actor);
  if (!canManageDocument(actor, {uploader_id: document.uploader_id})) throw new HttpError(403, 'Only the document owner or an administrator may add signers.');
  if (document.status !== 'DRAFT') throw new HttpError(403, 'Participants cannot be changed after signing opens.');
  const body = await jsonBody(request);
  const email = emailField(body.email);
  const sql = getDatabase();
  const count = await sql`SELECT count(*)::int AS total FROM signatories WHERE agreement_id=${id}`;
  if (count[0].total >= 10) throw new HttpError(409, 'Maximum ten signers per document.');
  let [account] = await sql`SELECT u.id,u.auth_user_id,u.is_active,u.display_name,u.phone_number,
   (SELECT s.id_number FROM signatories s WHERE s.auth_user_id=u.auth_user_id ORDER BY s.created_at DESC LIMIT 1) AS id_number
   FROM users u WHERE lower(u.email)=${email}`;
  let name:string;let phone:string;let idNumber:string;
  if (!account) {
   if (actor.role !== 'ADMIN') throw new HttpError(400, 'Ask an administrator to create a workspace login for this signer first.');
   name=stringField(body.name,'Full name',2,100);phone=phoneField(body.phone,true);idNumber=stringField(body.idNumber,'ID / passport number',3,50);
   const created = await createWorkspaceAccount({name,email,phone,password:typeof body.password==='string'?body.password:'',role:'SIGNER',origin:new URL(request.url).origin});
   account = {id:created.id,auth_user_id:created.auth_user_id,is_active:true,display_name:name,phone_number:phone};
  }else{name=account.display_name||stringField(body.name,'Full name',2,100);phone=account.phone_number||phoneField(body.phone,true);idNumber=account.id_number||stringField(body.idNumber,'ID / passport number',3,50);}
  if (!account.is_active) throw new HttpError(400, 'This account is inactive. Activate it in Users first.');
  await sql.transaction([
   sql`INSERT INTO signatories(agreement_id,auth_user_id,email,full_name,phone_number,id_number) VALUES(${id},${account.auth_user_id},${email},${name},${phone},${idNumber})`,
   sql`INSERT INTO audit_logs(agreement_id,actor_email,action) VALUES(${id},${actor.email},'ADD_SIGNER')`,
   sql`INSERT INTO user_activities(user_id,agreement_id,action) VALUES(${actor.id},${id},'Added document signer')`,
  ]);
  return Response.json({message:'Signer added. Their login can now access this document.'}, {status:201});
 } catch(error) { return apiError(error); }
}
