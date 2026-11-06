import 'server-only';
import {enrollWithNeon} from './enrollment.mjs';
export function enrollManagedIdentity(input:{origin:string;email:string;password:string;name:string}) {
 const baseUrl=process.env.NEON_AUTH_BASE_URL||process.env.NEON_AUTH_URL;
 if(!baseUrl)throw new Error('Neon Auth URL is missing.');
 return enrollWithNeon({...input,baseUrl});
}
