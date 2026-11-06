import 'server-only';
import { readPrivateObject } from '@/lib/signing/store';
import { documentForUser } from '@/lib/documents';
import { getDatabase } from '@/lib/db';
import { HttpError } from '@/lib/api';
import type { WorkspaceUser } from '@/lib/auth/user';

export async function privatePdfResponse(id:string,user:WorkspaceUser,disposition:'inline'|'attachment') {
 const document=await documentForUser(id,user);
 const key=document.signed_pdf_url?document.signed_pdf_url:document.original_pdf_url;
 if(typeof key!=='string'||!key.startsWith(`agreements/${id}/`)||!key.endsWith('.pdf'))throw new HttpError(404,'Private PDF not available.');
 const bytes=await readPrivateObject(id,key,document.signed_pdf_url?document.signed_sha256:document.original_sha256);
 const sql=getDatabase();
 const action=disposition==='inline'?'VIEW':'DOWNLOAD';
 const activity=disposition==='inline'?'Viewed document':'Downloaded document';
 await sql.transaction([
  sql`INSERT INTO audit_logs(agreement_id,actor_email,action) VALUES(${id},${user.email},${action})`,
  sql`INSERT INTO user_activities(user_id,agreement_id,action) VALUES(${user.id},${id},${activity})`,
 ]);
 const filename=String(document.title).replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,100)||'agreement';
 return new Response(Buffer.from(bytes),{headers:{
  'Content-Type':'application/pdf',
  'Content-Length':String(bytes.length),
  ...(document.signed_sha256?{'X-Document-SHA256':String(document.signed_sha256)}:{}),
  'Content-Disposition':`${disposition}; filename="${filename}.pdf"`,
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'SAMEORIGIN',
  'Content-Security-Policy':"frame-ancestors 'self'",
  'Referrer-Policy':'no-referrer',
 }});
}
