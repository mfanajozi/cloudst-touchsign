import {requireUser,requireSameOrigin,jsonBody,HttpError,apiError} from '@/lib/api';
import {getDatabase} from '@/lib/db';
import {workflowState,originalPdf} from '@/lib/signing/workflow';
import {validateFields} from '@/lib/signing/validation.mjs';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{const user=await requireUser();const {id}=await context.params;const state=await workflowState(id,user,true);const {info}=await originalPdf(state.document);
  return Response.json({revision:state.document.revision,status:state.document.status,fields:state.fields,signers:state.signers.map(s=>({id:s.id,name:s.full_name})),...info},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){
 try{
  requireSameOrigin(request);const user=await requireUser();const {id}=await context.params;const state=await workflowState(id,user,true);
  if(state.document.status!=='DRAFT')throw new HttpError(403,'Published field mappings cannot be edited.');
  const body=await jsonBody(request,300000);if(!Number.isInteger(body.revision))throw new HttpError(400,'Document revision is required.');
  const {info}=await originalPdf(state.document);const fields=validateFields(body.fields,state.signers.map(s=>s.id),info.pageCount);
  const rows=await getDatabase()`SELECT touchsign_save_fields(${id},${user.id},${body.revision as number},${JSON.stringify(fields)}::jsonb) AS revision`;
  return Response.json({message:'Field mapping saved.',revision:rows[0].revision});
 }catch(error){return apiError(error);}
}
