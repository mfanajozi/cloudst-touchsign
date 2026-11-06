import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';
import { uploadPrivatePdf } from './storage-upload.mjs';
import { resolveStorageConfiguration } from './storage-config.mjs';
export function getStorageBucket() { return resolveStorageConfiguration().bucket; }
export function getStorage() {
 const {bucket: _bucket,...config}=resolveStorageConfiguration();
 return new S3Client({...config,maxAttempts:3});
}
export function putPrivatePdf(input:{Bucket:string;Key:string;Body:Buffer}, allowBucketCreation=false) {
 return uploadPrivatePdf(getStorage(),input,allowBucketCreation);
}
