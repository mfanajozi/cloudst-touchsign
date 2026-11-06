import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getStorage, getStorageBucket, putPrivatePdf } from '@/lib/storage';
import { safeFailureDetails, storageFailureMessage } from '@/lib/storage-config.mjs';
import { inspectPdf } from '@/lib/signing/pdf.mjs';
import { sha256 } from '@/lib/signing/store';
import { SigningInputError } from '@/lib/signing/validation.mjs';
import { getDatabase } from '@/lib/db';
import { documentsForUser } from '@/lib/documents';
import { canUpload } from '@/lib/access-policy';
import { requireUser, requireSameOrigin, stringField, HttpError, apiError } from '@/lib/api';
export const runtime = 'nodejs';
const MAX_PDF_BYTES = 4 * 1024 * 1024;
export async function GET() {
 try { const user = await requireUser(); return Response.json({documents: await documentsForUser(user)}, {headers: {'Cache-Control':'private, no-store'}}); } catch(error) { return apiError(error); }
}
export async function POST(request: Request) {
 let uploaded: {Key: string; Bucket: string} | null = null;
 let stage='authentication';
 const reference=randomUUID();
 try {
  requireSameOrigin(request); const user = await requireUser();
  if (!canUpload(user.role)) throw new HttpError(403, 'Only administrators and uploaders may upload documents.');
  stage='validation';
  if (Number(request.headers.get('content-length') || 0) > MAX_PDF_BYTES + 50000) throw new HttpError(413, 'PDF must be no larger than 4 MB.');
  const form = await request.formData(); const title = stringField(form.get('title'), 'Title', 2, 255); const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > MAX_PDF_BYTES || file.type !== 'application/pdf') throw new HttpError(400, 'Choose a PDF no larger than 4 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0,5).toString() !== '%PDF-') throw new HttpError(400, 'The selected file is not a valid PDF.');
  await inspectPdf(bytes);
  stage='storage';
  const id = randomUUID(); const Key = `agreements/${id}/original.pdf`; const Bucket = getStorageBucket();
  await putPrivatePdf({Bucket,Key,Body:bytes},user.role==='ADMIN'); uploaded = {Key,Bucket};
  stage='database';
  const sql = getDatabase();
  await sql.transaction([
   sql`INSERT INTO agreements(id,uploader_id,title,original_pdf_url,original_sha256) VALUES(${id},${user.id},${title},${Key},${sha256(bytes)})`,
   sql`INSERT INTO audit_logs(agreement_id,actor_email,action) VALUES(${id},${user.email},'UPLOAD')`,
   sql`INSERT INTO user_activities(user_id,agreement_id,action) VALUES(${user.id},${id},'Uploaded document')`,
  ]);
  uploaded = null;
  return Response.json({id,message:'PDF uploaded privately. Add the people who may access it.'}, {status:201});
 } catch(error) {
  if (uploaded) { try { await getStorage().send(new DeleteObjectCommand(uploaded)); } catch(cleanupError) { console.error('[touchsign] document_upload_cleanup_failed',{reference,...safeFailureDetails(cleanupError)}); } }
  if(error instanceof HttpError||error instanceof SigningInputError)return apiError(error);
  console.error('[touchsign] document_upload_failed',{reference,stage,...safeFailureDetails(error)});
  if(stage==='storage')return Response.json({error:`${storageFailureMessage(error)} Reference: ${reference}`,reference},{status:503});
  if(stage==='database'){
   const code=(error as {code?:string}).code;
   const message=code==='42P01'||code==='42703'?'The workspace database needs its latest migrations. Ask your administrator to update it.':'The PDF could not be recorded in the workspace. Please try again or contact your administrator.';
   return Response.json({error:`${message} Reference: ${reference}`,reference},{status:503});
  }
  return apiError(error);
 }
}
