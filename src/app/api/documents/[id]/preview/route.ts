import { privatePdfResponse } from '@/lib/document-response';
import { requireUser, apiError } from '@/lib/api';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 try {const user=await requireUser();const {id}=await context.params;return await privatePdfResponse(id,user,'inline');}
 catch(error){return apiError(error);}
}
