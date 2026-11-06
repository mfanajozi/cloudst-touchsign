import {requireUser,HttpError,apiError} from '@/lib/api';
import {workflowState} from '@/lib/signing/workflow';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{const user=await requireUser();const {id}=await context.params;const state=await workflowState(id,user);const own=state.signers.find(s=>s.auth_user_id===user.authId);
 if(!own)throw new HttpError(403,'You are not a signatory for this agreement.');
 return Response.json({id,title:state.document.title,status:state.document.status,revision:state.document.revision,signer:{id:own.id,name:own.full_name,hasSigned:own.has_signed},fields:state.fields.filter(f=>f.signatory_id===own.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
