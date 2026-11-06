'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export default function ApiForm({endpoint,method='POST',children,submitLabel,resetOnSuccess=false,encoding='json',redirectOnCreate=false}: {endpoint:string;method?:string;children:ReactNode;submitLabel:string;resetOnSuccess?:boolean;encoding?:'json'|'multipart';redirectOnCreate?:boolean}) {
 const [pending,setPending]=useState(false); const [message,setMessage]=useState(''); const [failed,setFailed]=useState(false); const router=useRouter();
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault(); if(pending)return; const form=event.currentTarget; const data=new FormData(form);
  setPending(true);setMessage('');setFailed(false);
  try {
   const body:Record<string,unknown>=Object.fromEntries(data.entries());
   for(const input of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')) body[input.name]=input.checked;
   const response=await fetch(endpoint,{method,headers:encoding==='json'?{'Content-Type':'application/json'}:undefined,body:encoding==='json'?JSON.stringify(body):data});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error || 'Request failed.');
   setMessage(result.message || 'Saved.'); if(resetOnSuccess)form.reset();
   if(redirectOnCreate && result.id)router.push(`/dashboard/documents/${result.id}`);
   router.refresh();
  } catch(error) {setFailed(true);setMessage(error instanceof Error?error.message:'Unable to connect. Please try again.');}
  finally{setPending(false);}
 }
 return <form className="workspace-form" onSubmit={submit} aria-busy={pending}><fieldset disabled={pending}>{children}<button className="button" type="submit">{pending?'Saving…':submitLabel}</button></fieldset><p className={failed?'form-error':'form-success'} role={failed?'alert':'status'} aria-live="polite">{message}</p></form>;
}
