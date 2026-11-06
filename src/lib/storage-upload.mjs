import {PutObjectCommand,CreateBucketCommand} from '@aws-sdk/client-s3';
export async function uploadPrivatePdf(client,input,allowBucketCreation=false) {
 const put=()=>client.send(new PutObjectCommand({...input,ContentType:'application/pdf'}));
 try {return await put();}
 catch(error) {
  // Neon creates private buckets by default. Never send an ACL or public policy.
  // Only administrators may provision the app's configured bucket on first use.
  if(!allowBucketCreation||error.name!=='NoSuchBucket')throw error;
  try {await client.send(new CreateBucketCommand({Bucket:input.Bucket}));}
  catch(createError){if(!['BucketAlreadyExists','BucketAlreadyOwnedByYou'].includes(createError.name))throw createError;}
  return put();
 }
}
