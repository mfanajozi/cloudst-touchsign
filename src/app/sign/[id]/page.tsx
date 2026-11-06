import {redirect} from 'next/navigation';
import {requirePageUser} from '@/lib/auth/page-user';
import {uuidField} from '@/lib/api';
export default async function SignLink({params}:{params:Promise<{id:string}>}){await requirePageUser();const {id}=await params;uuidField(id);redirect(`/dashboard/documents/${id}/sign`);}
