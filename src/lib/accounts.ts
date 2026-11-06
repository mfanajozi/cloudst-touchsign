import 'server-only';
import { enrollManagedIdentity } from '@/lib/auth/enroll';
import { getDatabase } from '@/lib/db';
import { HttpError, providerError, passwordField, requireUser } from '@/lib/api';

export async function createWorkspaceAccount(input:{email:string;name:string;phone:string;password:string;role:'UPLOADER'|'SIGNER';origin:string}) {
 // Workspace enrollment is an application-admin operation. It does not depend
 // on the optional Neon Admin plugin (feature_not_supported on this branch).
 await requireUser(true);
 const sql=getDatabase();
 const existing=await sql`SELECT id FROM users WHERE lower(email)=${input.email}`;
 if(existing.length)throw new HttpError(409,'This user already has a workspace account.');
 const findIdentity=async()=>{
  // Read-only lookup of Neon's documented managed directory. Passwords, roles,
  // account records and sessions are never written directly in neon_auth.
  const rows=await sql`SELECT id,email FROM neon_auth."user" WHERE lower(email)=${input.email} LIMIT 1`;
  return rows[0];
 };
 let identity=await findIdentity();let created=false;
 if(!identity){
  const result=await enrollManagedIdentity({origin:input.origin,email:input.email,password:passwordField(input.password),name:input.name});
  const duplicate=['USER_ALREADY_EXISTS','USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL','EMAIL_ALREADY_EXISTS'].includes(result.error?.code||'');
  if(!duplicate)providerError(result.error,'enroll-signer');
  // The database is authoritative: this also avoids linking a synthetic ID
  // returned by providers that conceal whether an email already exists.
  identity=await findIdentity();
  if(!duplicate&&result.identity&&identity?.id!==result.identity.id)throw new HttpError(503,'The new login could not be matched to this database branch. Check the Neon Auth URL and database connection.');
  created=!duplicate;
 }
 if(!identity||typeof identity.id!=='string'||identity.email?.toLowerCase()!==input.email)throw new HttpError(503,'The managed login could not be verified in this database. Check that Auth and PostgreSQL use the same Neon branch.');
 const rows=await sql`INSERT INTO users(auth_user_id,email,role,display_name,phone_number)
 VALUES(${identity.id},${input.email},${input.role},${input.name},${input.phone||null}) RETURNING id,auth_user_id`;
 return {id:String(rows[0].id),auth_user_id:String(rows[0].auth_user_id),created};
}
