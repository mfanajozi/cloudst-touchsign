import {notFound} from 'next/navigation';
import {requirePageUser} from '@/lib/auth/page-user';
import {workflowState} from '@/lib/signing/workflow';
import SigningForm from '@/components/signing-form';
import type {PlacedField} from '@/lib/signing/types';
export const dynamic='force-dynamic';
export default async function SignPage({params}:{params:Promise<{id:string}>}){const user=await requirePageUser();const {id}=await params;const state=await workflowState(id,user);const own=state.signers.find(s=>s.auth_user_id===user.authId);if(!own)notFound();return <main className="dashboard"><p className="eyebrow">REVIEW AND SIGN</p><h1 className="page-title">{state.document.title}</h1><SigningForm state={{id,title:state.document.title,status:state.document.status,revision:state.document.revision,signer:{id:own.id,name:own.full_name,hasSigned:own.has_signed},fields:state.fields.filter(f=>f.signatory_id===own.id) as PlacedField[]}}/></main>;}
