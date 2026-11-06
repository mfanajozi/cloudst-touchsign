import { requireUser, apiError } from '@/lib/api';
import { getVerifiedSession } from '@/lib/auth/server';
import { managedAdmin } from '@/lib/auth/admin';
import { classifyProviderError } from '@/lib/auth/provider-errors.mjs';
export async function GET(){
 try{
  const user=await requireUser(true);
  const {data:session,error}=await getVerifiedSession();
  if(error||!session?.user)return Response.json({error:'Session could not be verified.'},{status:401});
  const rawRole=(session.user as {role?:unknown}).role;
  const roles=typeof rawRole==='string'?rawRole.split(',').map(role=>role.trim().toLowerCase()):Array.isArray(rawRole)?rawRole.filter(role=>typeof role==='string'):[];
  const listed=await managedAdmin.listUsers({query:{searchValue:user.email,searchField:'email',searchOperator:'contains',limit:1}});
  const failure=listed.error?classifyProviderError(listed.error):null;
  return Response.json({workspaceAdministrator:true,accountEnrollmentMode:'isolated-email-signup',neonAdministrator:roles.includes('admin'),neonRolePresent:roles.length>0,canListNeonUsers:!listed.error,providerCode:failure?.code||null,providerStatus:listed.error?.status||null,authUrlAliasesMatch:!process.env.NEON_AUTH_URL||!process.env.NEON_AUTH_BASE_URL||process.env.NEON_AUTH_URL.replace(/\/$/,'')===process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'')},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error);}
}
