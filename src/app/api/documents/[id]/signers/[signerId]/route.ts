import { getDatabase } from '@/lib/db';
import { documentForUser } from '@/lib/documents';
import { canManageDocument } from '@/lib/access-policy';
import { requireUser, requireSameOrigin, uuidField, HttpError, apiError } from '@/lib/api';
export async function DELETE(request: Request, context: {params: Promise<{id: string; signerId: string}>}) {
 try {
  requireSameOrigin(request); const actor = await requireUser(); const {id,signerId} = await context.params; uuidField(signerId);
  const document = await documentForUser(id,actor);
  if (!canManageDocument(actor,{uploader_id:document.uploader_id})) throw new HttpError(403,'Only the owner or an administrator may remove a signer.');
  if (document.status !== 'DRAFT') throw new HttpError(403,'Participants cannot be changed after signing opens.');
  const sql = getDatabase();
  const results = await sql.transaction([
   sql`SELECT id FROM agreements WHERE id=${id} FOR UPDATE`,
   sql`WITH removed_fields AS (
    DELETE FROM document_fields WHERE agreement_id=${id} AND signatory_id=${signerId}
    AND EXISTS(SELECT 1 FROM signatories s WHERE s.id=${signerId} AND s.agreement_id=${id} AND NOT s.has_signed) RETURNING id
   ), removed AS (
    DELETE FROM signatories WHERE id=${signerId} AND agreement_id=${id} AND NOT has_signed
    AND (SELECT count(*) FROM removed_fields)>=0 RETURNING id
   ), audit AS (
    INSERT INTO audit_logs(agreement_id,actor_email,action) SELECT ${id},${actor.email},'REMOVE_SIGNER' FROM removed RETURNING id
   ) INSERT INTO user_activities(user_id,agreement_id,action)
    SELECT ${actor.id},${id},'Removed document signer' FROM removed RETURNING id`,
  ]);
  if (!results[1].length) throw new HttpError(409,'Signer was not removed. Signed participants are protected.');
  return Response.json({message:'Signer removed. Their assignment no longer grants document access.'});
 } catch(error) { return apiError(error); }
}
