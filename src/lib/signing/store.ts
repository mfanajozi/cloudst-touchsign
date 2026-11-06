import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {GetObjectCommand,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getStorage,getStorageBucket} from '@/lib/storage';
import {HttpError} from '@/lib/api';
export const sha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export async function readPrivateObject(id:string,key:unknown,expectedHash?:string|null,maxBytes=4*1024*1024){
 if(typeof key!=='string'||!key.startsWith(`agreements/${id}/`))throw new HttpError(404,'Private document content is not available.');
 const object=await getStorage().send(new GetObjectCommand({Bucket:getStorageBucket(),Key:key}));
 if(!object.Body||Number(object.ContentLength||0)>maxBytes)throw new HttpError(400,'Document content exceeds its supported size.');
 const bytes=await object.Body.transformToByteArray();
 if(bytes.length>maxBytes)throw new HttpError(400,'Document content exceeds its supported size.');
 if(expectedHash&&sha256(bytes)!==expectedHash)throw new HttpError(409,'Document integrity verification failed. Contact your administrator.');
 return bytes;
}
export async function writePrivateObject(id:string,path:string,bytes:Uint8Array,type:string){
 const key=`agreements/${id}/${path}-${randomUUID()}.${type==='application/pdf'?'pdf':'png'}`;
 await getStorage().send(new PutObjectCommand({Bucket:getStorageBucket(),Key:key,Body:bytes,ContentType:type}));return key;
}
export async function removeStagedObjects(keys:string[]){
 for(const key of keys){try{await getStorage().send(new DeleteObjectCommand({Bucket:getStorageBucket(),Key:key}));}catch{console.error('[touchsign] staged_object_cleanup_failed');}}
}
