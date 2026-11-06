import {requireUser,requireSameOrigin,jsonBody,apiError} from '@/lib/api';
import {submitSignature} from '@/lib/signing/mutations';
export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{requireSameOrigin(request);const user=await requireUser();const {id}=await context.params;const body=await jsonBody(request,500000);const result=await submitSignature(id,user,body,request);return Response.json({message:result.status==='LOCKED'?'Signature recorded. All participants have signed; the document is locked.':'Signature recorded.',...result});}
 catch(error){return apiError(error);}
}
