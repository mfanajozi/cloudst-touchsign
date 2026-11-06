import {requireUser,requireSameOrigin,jsonBody,apiError} from '@/lib/api';
import {finalizeDocument} from '@/lib/signing/mutations';
export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{requireSameOrigin(request);const user=await requireUser();const {id}=await context.params;const body=await jsonBody(request);const result=await finalizeDocument(id,user,body,request);return Response.json({message:'Document finalized and locked. The completed PDF includes its completion record.',...result});}
 catch(error){return apiError(error);}
}
