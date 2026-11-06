import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStorageConfiguration,safeFailureDetails,storageFailureMessage} from '../src/lib/storage-config.mjs';
import {uploadPrivatePdf} from '../src/lib/storage-upload.mjs';
const env={AWS_ENDPOINT_URL_S3:'https://storage.example.test',AWS_REGION:'us-east-2',AWS_ACCESS_KEY_ID:'fake-token-id',AWS_SECRET_ACCESS_KEY:'fake-secret'};
const input={Bucket:'assets',Key:'agreements/test/original.pdf',Body:Buffer.from('%PDF-test')};
const missing=()=>Object.assign(new Error('fake error containing sensitive request data'),{name:'NoSuchBucket'});
test('AWS-standard Neon variables configure a path-style private bucket client',()=>{
 const config=resolveStorageConfiguration(env);assert.equal(config.bucket,'assets');assert.equal(config.region,'us-east-2');assert.equal(config.forcePathStyle,true);assert.equal(config.credentials.accessKeyId,env.AWS_ACCESS_KEY_ID);
});
test('explicit Neon aliases and bucket take precedence without changing the supplied region',()=>{
 const config=resolveStorageConfiguration({...env,NEON_STORAGE_ENDPOINT:'https://other.example.test',NEON_STORAGE_BUCKET:'agreements',NEON_STORAGE_REGION:'eu-central-1'});assert.equal(config.endpoint,'https://other.example.test');assert.equal(config.bucket,'agreements');assert.equal(config.region,'eu-central-1');
});
test('missing configuration produces a typed, credential-free error',()=>{
 assert.throws(()=>resolveStorageConfiguration({}),error=>error.code==='STORAGE_CONFIGURATION_MISSING'&&!error.message.includes('fake-secret'));
});
test('credential-bearing or insecure endpoint is rejected',()=>{
 for(const endpoint of ['http://example.test','https://user:secret@example.test','https://example.test?token=secret'])assert.throws(()=>resolveStorageConfiguration({...env,AWS_ENDPOINT_URL_S3:endpoint}),error=>error.code==='STORAGE_ENDPOINT_INVALID');
});
test('ordinary successful upload never provisions a bucket',async()=>{
 const calls=[];await uploadPrivatePdf({send:async command=>{calls.push(command)}},input,true);assert.equal(calls.length,1);assert.equal(calls[0].constructor.name,'PutObjectCommand');assert.equal(calls[0].input.ContentType,'application/pdf');assert.equal(calls[0].input.ACL,undefined);
});
test('admin first upload provisions missing bucket privately then retries the same object',async()=>{
 const calls=[];await uploadPrivatePdf({send:async command=>{calls.push(command);if(calls.length===1)throw missing();}},input,true);assert.deepEqual(calls.map(call=>call.constructor.name),['PutObjectCommand','CreateBucketCommand','PutObjectCommand']);assert.deepEqual(calls[1].input,{Bucket:'assets'});assert.deepEqual(calls[2].input,calls[0].input);
});
test('non-admin upload does not create a missing bucket',async()=>{
 const calls=[];await assert.rejects(uploadPrivatePdf({send:async command=>{calls.push(command);throw missing()}},input,false),{name:'NoSuchBucket'});assert.equal(calls.length,1);
});
test('invalid credentials never trigger bucket creation or an upload retry',async()=>{
 const calls=[];await assert.rejects(uploadPrivatePdf({send:async command=>{calls.push(command);throw Object.assign(new Error('fake secret'),{name:'SignatureDoesNotMatch'})}},input,true),{name:'SignatureDoesNotMatch'});assert.equal(calls.length,1);
});
test('racing bucket creation can retry but access denial remains a failure',async()=>{
 const calls=[];await uploadPrivatePdf({send:async command=>{calls.push(command);if(calls.length===1)throw missing();if(calls.length===2)throw Object.assign(new Error(),{name:'BucketAlreadyOwnedByYou'})}},input,true);assert.equal(calls.length,3);
 await assert.rejects(uploadPrivatePdf({send:async command=>{if(command.constructor.name==='PutObjectCommand')throw missing();throw Object.assign(new Error(),{name:'AccessDenied'})}},input,true),{name:'AccessDenied'});
});
test('safe diagnostics exclude errors, credentials, request payloads and URLs',()=>{
 const secret='FAKE_DO_NOT_LOG';const error=Object.assign(new Error(secret),{name:'SignatureDoesNotMatch',request:{password:secret},$metadata:{httpStatusCode:403}});const diagnostic=JSON.stringify(safeFailureDetails(error));assert.ok(!diagnostic.includes(secret));assert.deepEqual(safeFailureDetails(error),{code:'SignatureDoesNotMatch',cause:undefined,upstreamStatus:403});assert.match(storageFailureMessage(error),/credentials/);assert.match(storageFailureMessage({code:'ENOTFOUND'}),/reach/);
});
test('legacy auto region falls back to the real AWS region for Neon signatures',()=>{
 assert.equal(resolveStorageConfiguration({...env,NEON_STORAGE_REGION:'auto'}).region,'us-east-2');
 assert.equal(resolveStorageConfiguration({...env,NEON_STORAGE_REGION:'auto',AWS_REGION:'eu-central-1'}).region,'eu-central-1');
});
