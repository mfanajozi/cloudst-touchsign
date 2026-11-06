import 'server-only';
import {getDatabase} from '@/lib/db';
import {documentForUser} from '@/lib/documents';
import {canManageDocument} from '@/lib/access-policy';
import {HttpError} from '@/lib/api';
import type {WorkspaceUser} from '@/lib/auth/user';
import {readPrivateObject,sha256} from './store';
import {inspectPdf} from './pdf.mjs';
export async function workflowState(id:string,user:WorkspaceUser,manager=false){
 const document=await documentForUser(id,user);
 if(manager&&!canManageDocument(user,{uploader_id:document.uploader_id}))throw new HttpError(403,'Only the owner or an administrator may manage this agreement.');
 const sql=getDatabase();
 const [signers,fields,records]=await Promise.all([
  sql`SELECT id,auth_user_id,email,full_name,has_signed,signed_at,location_text FROM signatories WHERE agreement_id=${id} ORDER BY created_at,id`,
  sql`SELECT id,signatory_id,page_number,type,x_coord,y_coord,width,height FROM document_fields WHERE agreement_id=${id} ORDER BY page_number,id`,
  sql`SELECT * FROM signature_records WHERE agreement_id=${id} ORDER BY signed_at,signatory_id`,
 ]);
 return {document,signers,fields,records};
}
export async function originalPdf(document:Record<string,any>){
 const bytes=await readPrivateObject(document.id,document.original_pdf_url,document.original_sha256);
 const info=await inspectPdf(bytes);return {bytes,info,hash:sha256(bytes)};
}
export async function existingEvidence(id:string,records:Record<string,any>[]){
 return Promise.all(records.map(async record=>({
  signatoryId:record.signatory_id,
  signature:await readPrivateObject(id,record.signature_key,record.signature_sha256,160000),
  initials:record.initials_key?await readPrivateObject(id,record.initials_key,record.initials_sha256,160000):null,
  signedAt:new Date(record.signed_at).toISOString(),locationText:record.location_text,
  locationConsent:record.location_consent,ipAddress:record.ip_address,signatureHash:record.signature_sha256,
 })));
}
export async function auditSnapshot(id:string){return getDatabase()`SELECT actor_email,action,ip_address,created_at FROM audit_logs WHERE agreement_id=${id} ORDER BY created_at,id`;}
