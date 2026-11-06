import {createAuthClient} from '@neon/auth';
import {BetterAuthVanillaAdapter} from '@neon/auth/vanilla/adapters';

// This is a separate server-only enrollment client, NOT the Next auth instance.
// It sends no administrator cookies and cannot set the browser's session cookie.
export async function enrollWithNeon({baseUrl,origin,email,password,name}) {
 const url=new URL(baseUrl);
 if(url.protocol!=='https:')throw new Error('Neon Auth requires HTTPS.');
 const isolated=createAuthClient(baseUrl,{adapter:BetterAuthVanillaAdapter({fetchOptions:{headers:{Origin:origin},credentials:'omit',redirect:'error',timeout:15000}})});
 const result=await isolated.signUp.email({email,password,name});
 if(result.error)return {identity:null,error:result.error};
 const user=result.data?.user;
 // Never return the signup session token or upstream Set-Cookie headers.
 return {identity:user?{id:user.id,email:user.email}:null,error:null};
}
