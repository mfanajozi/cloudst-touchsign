import 'server-only';
import {getDatabase} from '@/lib/db';
import {HttpError} from '@/lib/api';
import type {WorkspaceUser} from '@/lib/auth/user';
import {workflowState,originalPdf,existingEvidence,auditSnapshot} from './workflow';
import {writePrivateObject,removeStagedObjects,sha256} from './store';
import {validateSigningLayout,pngBytes,locationEvidence} from './validation.mjs';
import {renderAgreementPdf} from './pdf.mjs';
import {signingRequestContext} from './request-context';

export async function submitSignature(id:string,user:WorkspaceUser,body:Record<string,unknown>,request:Request){
 const state=await workflowState(id,user);const own=state.signers.find(s=>s.auth_user_id===user.authId);
 if(!own)throw new HttpError(403,'You are not assigned to sign this agreement.');
 if(state.document.status!=='SIGNING'||own.has_signed)throw new HttpError(403,'This agreement is not open for your signature.');
 if(!Number.isInteger(body.revision)||body.revision!==state.document.revision)throw new HttpError(409,'The document changed. Refresh it before signing.');
 if(body.intent!==true)throw new HttpError(400,'Confirm that you reviewed the agreement and intend to sign it.');
 const original=await originalPdf(state.document);validateSigningLayout(state.fields,state.signers,original.info.pageCount);
 const fields=state.fields.filter(f=>f.signatory_id===own.id);const signature=pngBytes(body.signature)!;const needsInitials=fields.some(f=>f.type==='INITIAL');
 const initials=needsInitials?pngBytes(body.initials):null;if(needsInitials&&body.applyInitials!==true)throw new HttpError(400,'Confirm applying your initials to every required page.');
 const location=locationEvidence(body.location);const signedAt=new Date().toISOString();const context=signingRequestContext(request);
 const evidence=await existingEvidence(id,state.records);const signatureHash=sha256(signature);const initialsHash=initials?sha256(initials):null;
 evidence.push({signatoryId:own.id,signature,initials,signedAt,locationText:location.text,locationConsent:location.consent,ipAddress:context.ip,signatureHash});
 const final=state.signers.every(s=>s.id===own.id||s.has_signed);const audit=final?await auditSnapshot(id):[];
 if(final)audit.push({actor_email:user.email,action:'SIGN',ip_address:context.ip,created_at:signedAt},{actor_email:user.email,action:'LOCK',ip_address:context.ip,created_at:signedAt});
 const pdf=await renderAgreementPdf({original:original.bytes,fields:state.fields,evidence,certificate:final?{id,title:state.document.title,revision:state.document.revision+1,originalHash:original.hash,finalizedAt:signedAt,reason:'All assigned participants signed',signers:state.signers,audit}:null});
 const keys:string[]=[];let attemptedCommit=false;let signatureKey='';
 try{
  signatureKey=await writePrivateObject(id,`signatures/${own.id}/signature`,signature,'image/png');keys.push(signatureKey);
  const initialsKey=initials?await writePrivateObject(id,`signatures/${own.id}/initials`,initials,'image/png'):null;if(initialsKey)keys.push(initialsKey);
  const pdfKey=await writePrivateObject(id,`versions/${state.document.revision+1}`,pdf,'application/pdf');keys.push(pdfKey);
  const record={signature_key:signatureKey,initials_key:initialsKey,signature_sha256:signatureHash,initials_sha256:initialsHash,location_text:location.text,location_consent:location.consent,signed_at:signedAt,ip_address:context.ip,user_agent:context.userAgent};
  attemptedCommit=true;
  const rows=await getDatabase()`SELECT touchsign_commit_signature(${id},${user.authId},${body.revision as number},${JSON.stringify(record)}::jsonb,${pdfKey},${sha256(pdf)},${original.hash},${final}) AS result`;
  return rows[0].result;
 }catch(error){
  // A transport timeout might happen AFTER commit. Never remove a canonical
  // object on an uncertain outcome; reconcile by this operation's immutable key.
  if(attemptedCommit&&!/^[0-9A-Z]{5}$/.test((error as {code?:string}).code||'')){
   try{const rows=await getDatabase()`SELECT a.status,a.revision FROM agreements a JOIN signature_records r ON r.agreement_id=a.id WHERE a.id=${id} AND r.signature_key=${signatureKey}`;if(rows.length)return rows[0];}
   catch{throw error;}
  }
  await removeStagedObjects(keys);throw error;
 }
}
export async function finalizeDocument(id:string,user:WorkspaceUser,body:Record<string,unknown>,request:Request){
 const state=await workflowState(id,user,true);
 if(state.document.status==='LOCKED')throw new HttpError(403,'This document is already locked.');
 if(body.confirm!==true||body.revision!==state.document.revision)throw new HttpError(409,'Confirm finalization of the current document version.');
 const original=await originalPdf(state.document);const evidence=await existingEvidence(id,state.records);const time=new Date().toISOString();const context=signingRequestContext(request);
 const audit=await auditSnapshot(id);audit.push({actor_email:user.email,action:'FORCE_LOCK',ip_address:context.ip,created_at:time});
 const pdf=await renderAgreementPdf({original:original.bytes,fields:state.fields,evidence,certificate:{id,title:state.document.title,revision:state.document.revision+1,originalHash:original.hash,finalizedAt:time,reason:'Finalized by uploader / administrator; unsigned participants remain listed',signers:state.signers,audit}});
 const key=await writePrivateObject(id,`versions/${state.document.revision+1}-final`,pdf,'application/pdf');let attempted=false;
 try{
  attempted=true;const rows=await getDatabase()`SELECT touchsign_finalize(${id},${user.id},${state.document.revision},${key},${sha256(pdf)},${original.hash},${time}::timestamptz,${context.ip}::inet) AS result`;return rows[0].result;
 }catch(error){
  if(attempted&&!/^[0-9A-Z]{5}$/.test((error as {code?:string}).code||'')){
   try{const rows=await getDatabase()`SELECT status,revision FROM agreements WHERE id=${id} AND signed_pdf_url=${key}`;if(rows.length)return rows[0];}catch{throw error;}
  }
  await removeStagedObjects([key]);throw error;
 }
}
