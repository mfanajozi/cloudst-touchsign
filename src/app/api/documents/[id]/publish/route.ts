import {requireUser,requireSameOrigin,jsonBody,HttpError,apiError} from '@/lib/api';
import {workflowState,originalPdf} from '@/lib/signing/workflow';
import {validateSigningLayout} from '@/lib/signing/validation.mjs';
import {getDatabase} from '@/lib/db';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const user=await requireUser();const {id}=await context.params;const state=await workflowState(id,user,true);const body=await jsonBody(request);
  if(state.document.status!=='DRAFT')throw new HttpError(403,'This document is already published or locked.');
  if(!Number.isInteger(body.revision)||body.confirm!==true)throw new HttpError(400,'Confirm that fields and participants are final.');
  const {info}=await originalPdf(state.document);validateSigningLayout(state.fields,state.signers,info.pageCount);
  const rows=await getDatabase()`SELECT touchsign_publish(${id},${user.id},${body.revision as number}) AS revision`;
  return Response.json({message:'Signing is open. Participant details and field positions are now frozen.',revision:rows[0].revision});
 }catch(error){return apiError(error);}
}
