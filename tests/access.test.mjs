import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import {fixturePdf,pngDataUrl} from './helpers/pdf-fixtures.mjs';
const validPdf=await fixturePdf();

// Exercise the actual route handlers against fake external boundaries. No Neon
// accounts, passwords, objects or production data are created by this suite.
const root = fileURLToPath(new URL('../',import.meta.url));
const mock = source => 'data:text/javascript,' + encodeURIComponent(source);
const fixture = globalThis.__touchsignTests = {};
const userModule = mock('export async function getWorkspaceUser(){return globalThis.__touchsignTests.user}');
const dbModule = mock(`export function getDatabase(){return globalThis.__touchsignTests.sql}`);
const authModule = mock(`export const auth={
 changePassword:input=>globalThis.__touchsignTests.auth.changePassword(input),
 updateUser:input=>globalThis.__touchsignTests.auth.updateUser(input),
 admin: new Proxy({}, {get:(_,name)=>input=>globalThis.__touchsignTests.auth.admin(name,input)})
}; export async function getVerifiedSession(){return globalThis.__touchsignTests.session}`);
const storageModule = mock(`export function getStorageBucket(){return 'private-test'};export async function putPrivatePdf(input){return globalThis.__touchsignTests.storage({input})};export function getStorage(){return {send:command=>globalThis.__touchsignTests.storage(command)}}`);
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='server-only')return {url:mock('export {}'),shortCircuit:true};
  if(specifier==='@/lib/auth/user')return {url:userModule,shortCircuit:true};
  if(specifier==='@/lib/db')return {url:dbModule,shortCircuit:true};
  if(specifier==='@/lib/auth/enroll')return {url:mock('export async function enrollManagedIdentity(input){return globalThis.__touchsignTests.enroll(input)}'),shortCircuit:true};
  if(specifier==='@/lib/auth/server'||(specifier==='./server'&&context.parentURL?.includes('/src/lib/auth/')))return {url:authModule,shortCircuit:true};
  if(specifier==='@/lib/storage')return {url:storageModule,shortCircuit:true};
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const base=specifier.startsWith('@/')?pathToFileURL(root+'src/'+specifier.slice(2)).href:new URL(specifier,context.parentURL).href;
   for(const suffix of ['', '.ts','.tsx']){
    const url=base+suffix;
    if(url.startsWith('file:')&&existsSync(fileURLToPath(url))&&!url.endsWith('/'))return {url,shortCircuit:true};
   }
  }
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith(pathToFileURL(root+'src/').href)&&/\.tsx?$/.test(url)){
   return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText};
  }
  return next(url,context);
 }
});
const owner={id:'11111111-1111-4111-8111-111111111111',authId:'auth-owner',role:'UPLOADER',email:'owner@example.test',name:'Owner'};
const other={...owner,id:'22222222-2222-4222-8222-222222222222',authId:'auth-other',email:'other@example.test'};
const admin={...owner,id:'33333333-3333-4333-8333-333333333333',authId:'auth-admin',role:'ADMIN'};
const docId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const document={id:docId,uploader_id:owner.id,title:'Private agreement',status:'DRAFT',original_pdf_url:`agreements/${docId}/original.pdf`};
const request=(path,method='POST',body={},origin='http://localhost:3000')=>new Request('http://localhost:3000'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
const params=id=>({params:Promise.resolve({id})});
beforeEach(()=>{
 fixture.user={...owner};fixture.session={data:{user:{id:owner.authId,name:'Owner'}},error:null};fixture.queries=[];fixture.providerCalls=[];fixture.storageCalls=[];
 fixture.sql=(strings,...values)=>{
  const text=strings.join('?');fixture.queries.push({text,values});
  return Promise.resolve(fixture.rows?.(text,values)||[]);
 };
 fixture.sql.transaction=async queries=>Promise.all(queries);
 fixture.auth={
  changePassword:async input=>{fixture.providerCalls.push(input);return {data:{},error:null}},
  updateUser:async input=>{fixture.providerCalls.push(input);return {data:{},error:null}},
  admin:async (name,input)=>{fixture.providerCalls.push({name,input});return {data:{},error:null}},
 };
 fixture.objectBytes=null;fixture.rows=()=>[];fixture.enroll=async()=>{throw new Error('Unexpected enrollment')};
 fixture.storage=async command=>{fixture.storageCalls.push(command);return {Body:{transformToByteArray:async()=>fixture.objectBytes||new TextEncoder().encode('%PDF-test'),transformToWebStream:()=>new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('%PDF-test'));controller.close()}})}}};
});
const {POST:createUser}=await import('../src/app/api/admin/users/route.ts');
const {PATCH:editUser}=await import('../src/app/api/admin/users/[id]/route.ts');
const {POST:resetPassword}=await import('../src/app/api/admin/users/[id]/password/route.ts');
const {PATCH:updateProfile}=await import('../src/app/api/profile/route.ts');
const {DELETE:removeSigner}=await import('../src/app/api/documents/[id]/signers/[signerId]/route.ts');
const {POST:changePassword}=await import('../src/app/api/profile/password/route.ts');
const {GET:listDocuments,POST:upload}=await import('../src/app/api/documents/route.ts');
const {POST:addSigner}=await import('../src/app/api/documents/[id]/signers/route.ts');
const {GET:download}=await import('../src/app/api/documents/[id]/download/route.ts');
const {GET:activity}=await import('../src/app/api/activity/route.ts');
const {getWorkspaceUser:realWorkspaceUser}=await import('../src/lib/auth/user.ts');
const policy=await import('../src/lib/access-policy.ts');

test('unauthenticated admin operations never reach identity or database mutation',async()=>{
 fixture.user=null;const response=await createUser(request('/api/admin/users'));assert.equal(response.status,401);assert.equal(fixture.providerCalls.length,0);assert.equal(fixture.queries.length,0);
});
test('non-admin cannot list/create other identities through workspace routes',async()=>{
 fixture.user=other;const response=await createUser(request('/api/admin/users'));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('cross-origin mutation is rejected before credentials or permissions are used',async()=>{
 fixture.user=admin;const response=await createUser(request('/api/admin/users','POST',{},'https://attacker.example'));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('admin cannot reset their own password through another-user endpoint',async()=>{
 fixture.user=admin;fixture.rows=()=>[{id:admin.id,role:'ADMIN',auth_user_id:admin.authId}];const response=await resetPassword(request('/api/admin/users/'+admin.id+'/password','POST',{password:'example-new-password'}),params(admin.id));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('admin accounts cannot be demoted or disabled by user editor',async()=>{
 fixture.user=admin;fixture.rows=()=>[{id:other.id,role:'ADMIN',auth_user_id:other.authId}];const response=await editUser(request('/api/admin/users/'+other.id,'PATCH',{name:'Other',role:'SIGNER',active:false}),params(other.id));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('password confirmation mismatch never calls identity provider',async()=>{
 const response=await changePassword(request('/api/profile/password','POST',{currentPassword:'current-password',newPassword:'new-password-value',confirmPassword:'different-password'}));assert.equal(response.status,400);assert.equal(fixture.providerCalls.length,0);
});
test('self password change ignores forged target identity and revokes other sessions',async()=>{
 const response=await changePassword(request('/api/profile/password','POST',{userId:other.id,currentPassword:'current-password',newPassword:'new-password-value',confirmPassword:'new-password-value'}));assert.equal(response.status,200);assert.deepEqual(fixture.providerCalls[0],{currentPassword:'current-password',newPassword:'new-password-value',revokeOtherSessions:true});assert.ok(fixture.queries.every(q=>!q.values.includes('current-password')&&!q.values.includes('new-password-value')));
});
test('signer cannot upload documents',async()=>{
 fixture.user={...other,role:'SIGNER'};const response=await upload(request('/api/documents'));assert.equal(response.status,403);assert.equal(fixture.storageCalls.length,0);
});
test('document listing scope uses server identity, never caller-supplied user ID',async()=>{
 fixture.user=other;await listDocuments(request('/api/documents?userId='+owner.id,'GET'));const query=fixture.queries[0];assert.ok(query.text.includes('s.auth_user_id='));assert.ok(query.values.includes(other.authId));assert.ok(query.values.includes(other.id));assert.ok(!query.values.includes(owner.id));assert.equal(query.values[0],false);
});
test('unassigned document ID returns 404 without touching private storage',async()=>{
 fixture.user=other;const response=await download(request('/api/documents/'+docId+'/download','GET'),params(docId));assert.equal(response.status,404);assert.equal(fixture.storageCalls.length,0);assert.ok(fixture.queries[0].values.includes(other.authId));
});
test('assigned signer cannot add another signer to someone else’s document',async()=>{
 fixture.user={...other,role:'SIGNER'};fixture.rows=()=>[document];const response=await addSigner(request('/api/documents/'+docId+'/signers'),params(docId));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('locked documents reject signer additions before account creation',async()=>{
 fixture.rows=()=>[{...document,status:'LOCKED'}];const response=await addSigner(request('/api/documents/'+docId+'/signers'),params(docId));assert.equal(response.status,403);assert.equal(fixture.providerCalls.length,0);
});
test('database-supplied public URL cannot bypass authenticated private download',async()=>{
 fixture.rows=()=>[{...document,original_pdf_url:'https://external.example/private.pdf'}];const response=await download(request('/api/documents/'+docId+'/download','GET'),params(docId));assert.equal(response.status,404);assert.equal(fixture.storageCalls.length,0);
});
test('authorised download uses only document-owned key and prevents caching',async()=>{
 fixture.rows=text=>text.includes('SELECT a.*')?[document]:[];const response=await download(request('/api/documents/'+docId+'/download?key=another-file.pdf','GET'),params(docId));assert.equal(response.status,200);assert.equal(fixture.storageCalls[0].input.Key,document.original_pdf_url);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(await response.text(),'%PDF-test');
});
test('personal activity ignores forged user IDs and omits other actors',async()=>{
 fixture.user=other;await activity(request('/api/activity?userId='+owner.id,'GET'));assert.deepEqual(fixture.queries[0].values,[other.id]);assert.ok(!fixture.queries[0].text.includes('actor_email'));
});
test('disabled workspace account is rejected despite valid managed session',async()=>{
 fixture.rows=()=>[{...other,is_active:false,display_name:'Other'}];assert.equal(await realWorkspaceUser(),null);
});
test('document access policy covers owner, assigned signer, admin and unrelated user',()=>{
 assert.equal(policy.canReadDocument(owner,document,[]),true);assert.equal(policy.canReadDocument(other,document,[]),false);assert.equal(policy.canReadDocument(other,document,[other.authId]),true);assert.equal(policy.canReadDocument(admin,document,[]),true);assert.equal(policy.canManageDocument({...other,role:'SIGNER'},document),false);
});

test('profile changes cannot grant role or modify a caller-supplied identity',async()=>{
 fixture.user=other;const response=await updateProfile(request('/api/profile','PATCH',{name:'New Name',phone:'',id:owner.id,role:'ADMIN',auth_user_id:owner.authId}));assert.equal(response.status,200);assert.deepEqual(fixture.providerCalls[0],{name:'New Name'});const update=fixture.queries.find(q=>q.text.includes('UPDATE users'));assert.ok(update.values.includes(other.id));assert.ok(!update.values.includes(owner.id));assert.ok(!update.text.includes('role='));
});
test('assigned signer cannot revoke another person’s assignment',async()=>{
 fixture.user={...other,role:'SIGNER'};fixture.rows=()=>[document];const response=await removeSigner(request('/api/documents/'+docId+'/signers/'+owner.id,'DELETE'),{params:Promise.resolve({id:docId,signerId:owner.id})});assert.equal(response.status,403);assert.ok(fixture.queries.every(q=>!q.text.includes('DELETE')));
});
test('signed-out private downloads cannot touch storage',async()=>{
 fixture.user=null;const response=await download(request('/api/documents/'+docId+'/download','GET'),params(docId));assert.equal(response.status,401);assert.equal(fixture.storageCalls.length,0);
});
const pdfRequest=()=>{
 const form=new FormData();form.set('title','Private test PDF');form.set('file',new File([new Uint8Array(validPdf)],'test.pdf',{type:'application/pdf'}));
 return new Request('http://localhost:3000/api/documents',{method:'POST',headers:{Origin:'http://localhost:3000'},body:form});
};
test('storage rejection reports storage stage without returning upstream secrets',async()=>{
 fixture.storage=async()=>{throw Object.assign(new Error('FAKE_SECRET_SHOULD_NOT_LEAK'),{name:'SignatureDoesNotMatch',$metadata:{httpStatusCode:403}})};
 const logs=[];const original=console.error;console.error=(...args)=>logs.push(args);
 try{
  const response=await upload(pdfRequest());const body=await response.json();assert.equal(response.status,503);assert.match(body.error,/credentials/);assert.ok(body.reference);assert.equal(logs[0][1].stage,'storage');assert.ok(!JSON.stringify(logs).includes('FAKE_SECRET_SHOULD_NOT_LEAK'));assert.ok(!JSON.stringify(body).includes('FAKE_SECRET_SHOULD_NOT_LEAK'));
 }finally{console.error=original;}
});
test('database failure after upload removes the staged PDF and identifies missing migration',async()=>{
 fixture.rows=text=>{if(text.includes('INSERT INTO agreements'))throw Object.assign(new Error('private database detail'),{code:'42P01'});return []};
 const original=console.error;const logs=[];console.error=(...args)=>logs.push(args);
 try{const response=await upload(pdfRequest());const body=await response.json();assert.equal(response.status,503);assert.match(body.error,/migrations/);assert.equal(logs[0][1].stage,'database');assert.equal(fixture.storageCalls.length,2);assert.equal(fixture.storageCalls[1].constructor.name,'DeleteObjectCommand');assert.equal(fixture.storageCalls[0].input.Key,fixture.storageCalls[1].input.Key);}finally{console.error=original;}
});
test('successful upload records the document without deleting its object',async()=>{
 const response=await upload(pdfRequest());const body=await response.json();assert.equal(response.status,201);assert.match(body.id,/^[a-f0-9-]{36}$/);assert.equal(fixture.storageCalls.length,1);assert.ok(fixture.queries.some(query=>query.text.includes('INSERT INTO agreements')&&query.values.includes(owner.id)));
});
const {GET:preview}=await import('../src/app/api/documents/[id]/preview/route.ts');
const {GET:adminDiagnostics}=await import('../src/app/api/admin/diagnostics/route.ts');
const {classifyProviderError}=await import('../src/lib/auth/provider-errors.mjs');
test('a new account uses isolated enrollment without requiring the unsupported admin API',async()=>{
 fixture.user=admin;let enrolled=false;
 fixture.enroll=async input=>{enrolled=true;fixture.providerCalls.push({name:'signUp.email',input});return {identity:{id:'auth-new-signer',email:input.email},error:null}};
 fixture.rows=text=>text.includes('neon_auth.')?(enrolled?[{id:'auth-new-signer',email:'new@example.test'}]:[]):text.includes('INSERT INTO users')?[{id:other.id,auth_user_id:'auth-new-signer'}]:[];
 const response=await createUser(request('/api/admin/users','POST',{name:'New Signer',email:'new@example.test',phone:'+27821234567',role:'SIGNER',password:'temporary-test-password'}));
 assert.equal(response.status,201);assert.deepEqual(fixture.providerCalls.map(call=>call.name),['signUp.email']);assert.equal(fixture.providerCalls[0].input.origin,'http://localhost:3000');assert.ok(fixture.queries.some(q=>q.text.includes('INSERT INTO users')&&q.values.includes('SIGNER')));
});
test('existing managed identity is linked read-only without signup, admin APIs or password changes',async()=>{
 fixture.user=admin;
 fixture.rows=text=>text.includes('neon_auth.')?[{id:'auth-existing',email:'existing@example.test'}]:text.includes('INSERT INTO users')?[{id:other.id,auth_user_id:'auth-existing'}]:[];
 const response=await createUser(request('/api/admin/users','POST',{name:'Existing Signer',email:'existing@example.test',phone:'',role:'SIGNER',password:''}));
 assert.equal(response.status,201);assert.equal(fixture.providerCalls.length,0);assert.match((await response.json()).message,/password is unchanged/);assert.ok(fixture.queries.every(q=>!/^\s*(?:UPDATE|INSERT INTO|DELETE FROM) neon_auth/.test(q.text)));
});
test('invalid origin is never misreported as missing administrator role',async()=>{
 fixture.user=admin;fixture.enroll=async()=>({identity:null,error:{code:'INVALID_ORIGIN',status:403,message:'unsafe upstream body'}});
 const original=console.error;console.error=()=>{};
 try{const response=await createUser(request('/api/admin/users','POST',{name:'New Signer',email:'new@example.test',phone:'',role:'SIGNER',password:'temporary-test-password'}));const body=await response.json();assert.equal(response.status,403);assert.match(body.error,/trusted domains/);assert.ok(!body.error.includes('Make admin'));assert.ok(!body.error.includes('unsafe upstream body'));assert.ok(!fixture.queries.some(q=>q.text.includes('INSERT INTO users')));}finally{console.error=original;}
});
test('provider errors distinguish role denial, origin, session, service outage and unknown 403',()=>{
 assert.match(classifyProviderError({code:'YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS',status:403}).message,/administrator/);
 assert.match(classifyProviderError({code:'INVALID_ORIGIN',status:403}).message,/trusted domains/);
 assert.equal(classifyProviderError({code:'SESSION_EXPIRED',status:401}).status,401);
 assert.equal(classifyProviderError({code:'NETWORK_DNS_ERROR',status:502}).status,503);
 assert.ok(!classifyProviderError({code:'UNKNOWN_FORBIDDEN',status:403}).message.includes('Make admin'));
});
test('admin diagnostics do not expose directory data or credentials',async()=>{
 fixture.user=admin;fixture.session={data:{user:{id:admin.authId,role:'admin'}}};fixture.auth.admin=async()=>({data:{users:[{email:'PRIVATE_DIRECTORY_DATA'}]},error:null});
 const response=await adminDiagnostics();const body=await response.json();assert.equal(response.status,200);assert.equal(body.neonAdministrator,true);assert.equal(body.canListNeonUsers,true);assert.ok(!JSON.stringify(body).includes('PRIVATE_DIRECTORY_DATA'));
});
test('ordinary users cannot inspect admin diagnostics',async()=>{
 fixture.user=other;assert.equal((await adminDiagnostics()).status,403);assert.equal(fixture.providerCalls.length,0);
});
test('authorised PDF preview is inline, uncached and restricted to same-origin framing',async()=>{
 fixture.rows=text=>text.includes('SELECT a.*')?[document]:[];
 const response=await preview(request('/api/documents/'+docId+'/preview','GET'),params(docId));assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/^inline;/);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.equal(response.headers.get('Content-Security-Policy'),"frame-ancestors 'self'");assert.equal(await response.text(),'%PDF-test');assert.ok(fixture.queries.some(query=>query.values.includes('VIEW')));
});
test('unassigned and signed-out preview requests cannot fetch document bytes',async()=>{
 fixture.user=other;assert.equal((await preview(request('/api/documents/'+docId+'/preview','GET'),params(docId))).status,404);fixture.user=null;assert.equal((await preview(request('/api/documents/'+docId+'/preview','GET'),params(docId))).status,401);assert.equal(fixture.storageCalls.length,0);
});

test('unsupported admin feature is identified separately from role denial',()=>{
 const failure=classifyProviderError({code:'feature_not_supported',status:403});assert.equal(failure.status,501);assert.match(failure.message,/does not support/);assert.ok(!failure.message.includes('Make admin'));
});
test('enrollment cannot link a synthetic user ID or a mismatched Auth database branch',async()=>{
 fixture.user=admin;let enrolled=false;fixture.enroll=async()=>{enrolled=true;return {identity:{id:'synthetic-id',email:'new@example.test'},error:null}};
 fixture.rows=text=>text.includes('neon_auth.')?(enrolled?[{id:'different-id',email:'new@example.test'}]:[]):[];
 const response=await createUser(request('/api/admin/users','POST',{name:'New Signer',email:'new@example.test',phone:'',role:'SIGNER',password:'temporary-test-password'}));assert.equal(response.status,503);assert.match((await response.json()).error,/branch/);assert.ok(!fixture.queries.some(q=>q.text.includes('INSERT INTO users')));
});
test('adding a new document signer enrolls and assigns the verified managed user ID',async()=>{
 fixture.user=admin;let enrolled=false;
 fixture.enroll=async input=>{enrolled=true;fixture.providerCalls.push({name:'signUp.email',input});return {identity:{id:'auth-document-signer',email:input.email},error:null}};
 fixture.rows=text=>{
  if(text.includes('SELECT a.*'))return [document];
  if(text.includes('count(*)::int AS total'))return [{total:0}];
  if(text.includes('neon_auth.'))return enrolled?[{id:'auth-document-signer',email:'signer@example.test'}]:[];
  if(text.includes('INSERT INTO users'))return [{id:other.id,auth_user_id:'auth-document-signer'}];
  return [];
 };
 const response=await addSigner(request('/api/documents/'+docId+'/signers','POST',{name:'Document Signer',email:'signer@example.test',phone:'+27821234567',idNumber:'TEST-PASSPORT',password:'temporary-test-password'}),params(docId));
 assert.equal(response.status,201);assert.deepEqual(fixture.providerCalls.map(call=>call.name),['signUp.email']);const insert=fixture.queries.find(query=>query.text.includes('INSERT INTO signatories'));assert.ok(insert.values.includes('auth-document-signer'));assert.ok(insert.values.includes(docId));assert.ok(!insert.values.includes(admin.authId));assert.ok(!JSON.stringify(await response.json()).includes('TEST-PASSPORT'));
});
test('workspace account edits work without the unsupported managed admin plugin',async()=>{
 fixture.user=admin;fixture.rows=text=>text.includes('SELECT id,role,auth_user_id')?[{id:other.id,role:'UPLOADER',auth_user_id:other.authId}]:[];
 const response=await editUser(request('/api/admin/users/'+other.id,'PATCH',{name:'Updated Person',phone:'',role:'SIGNER',active:false}),params(other.id));assert.equal(response.status,200);assert.equal(fixture.providerCalls.length,0);const update=fixture.queries.find(query=>query.text.includes('UPDATE users'));assert.ok(update.values.includes(false));assert.ok(update.values.includes(other.id));
});
