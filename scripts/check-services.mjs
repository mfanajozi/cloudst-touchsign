import nextEnv from '@next/env';
import {neon} from '@neondatabase/serverless';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {safeFailureDetails} from '../src/lib/storage-config.mjs';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
let failed=false;
try {
 if(!process.env.DATABASE_URL)throw Object.assign(new Error(),{code:'DATABASE_URL_MISSING'});
 await neon(process.env.DATABASE_URL)`SELECT 1 AS connected`;
 console.log('PASS PostgreSQL query');
}catch(error){console.error('Database check failed:',safeFailureDetails(error));failed=true;}
for(const script of ['check-auth.mjs','check-storage.mjs']){
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL(script,import.meta.url))],{stdio:'inherit',env:process.env});
  child.on('error',reject);child.on('exit',code=>resolve(code??1));
 }).catch(()=>1);
 if(code!==0)failed=true;
}
process.exitCode=failed?1:0;
