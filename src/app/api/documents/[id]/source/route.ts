import {requireUser,apiError} from '@/lib/api';
import {workflowState,originalPdf} from '@/lib/signing/workflow';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try{const user=await requireUser();const {id}=await context.params;const state=await workflowState(id,user,true);const original=await originalPdf(state.document);
 return new Response(Buffer.from(original.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN'}});
 }catch(error){return apiError(error);}
}
