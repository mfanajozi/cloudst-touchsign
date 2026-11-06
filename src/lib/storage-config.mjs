export class StorageConfigurationError extends Error {
 constructor(code) { super('Document storage configuration is incomplete or invalid.'); this.name='StorageConfigurationError'; this.code=code; }
}
export function resolveStorageConfiguration(env=process.env) {
 const value=(primary,fallback)=>String(env[primary]||env[fallback]||'').trim();
 const endpoint=value('NEON_STORAGE_ENDPOINT','AWS_ENDPOINT_URL_S3');
 const accessKeyId=value('NEON_STORAGE_ACCESS_KEY_ID','AWS_ACCESS_KEY_ID');
 const secretAccessKey=value('NEON_STORAGE_SECRET_ACCESS_KEY','AWS_SECRET_ACCESS_KEY');
 if(!endpoint||!accessKeyId||!secretAccessKey)throw new StorageConfigurationError('STORAGE_CONFIGURATION_MISSING');
 try { const url=new URL(endpoint); if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error(); }
 catch {throw new StorageConfigurationError('STORAGE_ENDPOINT_INVALID');}
 const requestedRegion=value('NEON_STORAGE_REGION','AWS_REGION');
 const region=requestedRegion==='auto'?(String(env.AWS_REGION||'').trim()||'us-east-2'):(requestedRegion||'us-east-2');
 return {endpoint,region,forcePathStyle:true,credentials:{accessKeyId,secretAccessKey},bucket:value('NEON_STORAGE_BUCKET','AWS_BUCKET_NAME')||'assets'};
}
export function safeFailureDetails(error) {
 const safe=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(value)?value:undefined;
 return {code:safe(error?.code)||safe(error?.name)||'UnknownError',cause:safe(error?.cause?.code),upstreamStatus:Number.isInteger(error?.$metadata?.httpStatusCode)?error.$metadata.httpStatusCode:undefined};
}
export function storageFailureMessage(error) {
 const code=error?.code||error?.name;
 if(code==='NoSuchBucket'||code==='NotFound')return 'Document storage is not ready. Ask your administrator to finish storage setup.';
 if(['InvalidAccessKeyId','SignatureDoesNotMatch','ExpiredToken','InvalidToken'].includes(code))return 'Document storage credentials were rejected. Ask your administrator to refresh storage access.';
 if(code==='AccessDenied')return 'Document storage denied the upload. Ask your administrator to check storage write permission and the selected Neon branch.';
 if(code==='STORAGE_CONFIGURATION_MISSING'||code==='STORAGE_ENDPOINT_INVALID')return 'Document storage is not configured correctly. Ask your administrator to check its settings.';
 if(['ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNRESET','ECONNREFUSED','TimeoutError','AbortError'].includes(code)||['ENOTFOUND','EAI_AGAIN','ETIMEDOUT','ECONNRESET','ECONNREFUSED'].includes(error?.cause?.code))return 'Unable to reach document storage. Please try again or contact your administrator.';
 if(code==='SlowDown')return 'Document storage is busy. Wait a moment and try again.';
 return 'The PDF could not be stored. Please contact your administrator with the error reference.';
}
