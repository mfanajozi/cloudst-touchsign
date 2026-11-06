import nextEnv from '@next/env';
const {loadEnvConfig}=nextEnv;
import {S3Client,HeadBucketCommand,CreateBucketCommand,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
import {resolveStorageConfiguration,safeFailureDetails,storageFailureMessage} from '../src/lib/storage-config.mjs';
loadEnvConfig(process.cwd(),true, {info(){},error(){}});
let stage='configuration';let client;let probe;let written=false;
try{
 const {bucket,...config}=resolveStorageConfiguration();
 client=new S3Client({...config,maxAttempts:1});
 const send=command=>client.send(command,{abortSignal:AbortSignal.timeout(15000)});
 stage='bucket';
 try {await send(new HeadBucketCommand({Bucket:bucket}));}
 catch(error){
  const missing=error.name==='NoSuchBucket'||error.$metadata?.httpStatusCode===404;
  if(!missing||!process.argv.includes('--setup'))throw error;
  stage='create-private-bucket';
  try {await send(new CreateBucketCommand({Bucket:bucket}));}
  catch(createError){if(!['BucketAlreadyExists','BucketAlreadyOwnedByYou'].includes(createError.name))throw createError;}
  console.log('PASS: declared private bucket provisioned.');
 }
 console.log('PASS: configured storage bucket is reachable.');
 probe={Bucket:bucket,Key:`setup-check/${randomUUID()}.pdf`};
 const content='%PDF-1.7\nTouchSign temporary storage verification\n%%EOF';
 stage='write';await send(new PutObjectCommand({...probe,Body:content,ContentType:'application/pdf'}));written=true;
 stage='read';const object=await send(new GetObjectCommand(probe));
 if(await object.Body.transformToString()!==content)throw new Error('RoundtripMismatch');
 console.log('PASS: private object write/read roundtrip.');
 stage='anonymous-read';
 const url=new URL(config.endpoint);url.pathname=`${url.pathname.replace(/\/$/,'')}/${bucket}/${probe.Key}`;
 const anonymous=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
 await anonymous.body?.cancel();
 if(![403,404].includes(anonymous.status))throw Object.assign(new Error('PrivateBucketRequired'),{code:'BUCKET_NOT_PRIVATE'});
 console.log('PASS: anonymous reads are denied.');
}catch(error){
 console.error('Storage check failed:',{stage,...safeFailureDetails(error)});
 console.error(error.code==='BUCKET_NOT_PRIVATE'?'The bucket must be private before storing agreements.':storageFailureMessage(error));
 if(stage==='bucket'&&(error.name==='NoSuchBucket'||error.$metadata?.httpStatusCode===404))console.error('Run npm run storage:setup to provision the declared private bucket and retry.');
 process.exitCode=1;
}finally{
 if(written&&probe&&client){try{await client.send(new DeleteObjectCommand(probe),{abortSignal:AbortSignal.timeout(15000)});console.log('PASS: temporary probe removed.');}catch(error){console.error('Probe cleanup failed:',safeFailureDetails(error));process.exitCode=1;}}
 client?.destroy();
}
