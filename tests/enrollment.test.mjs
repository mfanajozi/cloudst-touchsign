import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrollWithNeon} from '../src/lib/auth/enrollment.mjs';
test('isolated SDK enrollment forwards no admin cookies and returns no session token',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{
  calls.push({url:String(url),init});
  return new Response(JSON.stringify({user:{id:'test-managed-id',email:'new@example.test',name:'Test'},token:'TEST_SESSION_MUST_NOT_ESCAPE'}),{headers:{'Content-Type':'application/json','Set-Cookie':'neon-auth.session_token=TEST_COOKIE_MUST_NOT_ESCAPE; HttpOnly; Secure'}});
 };
 try{
  const result=await enrollWithNeon({baseUrl:'https://auth.example.test/db/auth',origin:'http://localhost:3000',email:'new@example.test',password:'fake-enrollment-password',name:'Test'});
  assert.equal(result.error,null);assert.deepEqual(result.identity,{id:'test-managed-id',email:'new@example.test'});assert.ok(!JSON.stringify(result).includes('TEST_SESSION_MUST_NOT_ESCAPE'));assert.ok(!JSON.stringify(result).includes('TEST_COOKIE_MUST_NOT_ESCAPE'));
  const call=calls.find(call=>call.url.endsWith('/sign-up/email'));assert.ok(call);assert.equal(call.url,'https://auth.example.test/db/auth/sign-up/email');assert.equal(call.init.credentials,'omit');assert.equal(new Headers(call.init.headers).get('Cookie'),null);assert.equal(new Headers(call.init.headers).get('Origin'),'http://localhost:3000');
  assert.ok(calls.every(call=>!call.url.includes('/admin/')));
 }finally{globalThis.fetch=original;}
});
