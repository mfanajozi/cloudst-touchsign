import 'server-only';
import {isIP} from 'node:net';
export function signingRequestContext(request:Request){
 // Local requests have no trustworthy remote address in the Web Request API.
 const candidate=process.env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for'):process.env.TRUST_PROXY_HEADERS==='1'?request.headers.get('x-forwarded-for'):null;
 const first=candidate?.split(',')[0]?.trim();
 return {ip:first&&isIP(first)?first:null,userAgent:(request.headers.get('user-agent')||'').slice(0,300)};
}
