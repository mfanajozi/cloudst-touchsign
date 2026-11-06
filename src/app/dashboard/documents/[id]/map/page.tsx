import Link from 'next/link';
import {requirePageUser} from '@/lib/auth/page-user';
import {workflowState} from '@/lib/signing/workflow';
import FieldMapper from '@/components/field-mapper';
export const dynamic='force-dynamic';
export default async function MappingPage({params}:{params:Promise<{id:string}>}){const user=await requirePageUser();const {id}=await params;await workflowState(id,user,true);return <main className="dashboard"><p className="eyebrow">PREPARE FOR SIGNING</p><h1 className="page-title">Place your fields.</h1><Link href={`/dashboard/documents/${id}`} className="secondary">← Back to agreement</Link><section className="workspace-panel mapping-panel"><FieldMapper id={id}/></section></main>;}
