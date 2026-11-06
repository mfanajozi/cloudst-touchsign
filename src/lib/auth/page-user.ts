import 'server-only';
import { redirect } from 'next/navigation';
import { getWorkspaceUser } from './user';
import { getVerifiedSession } from './server';
export async function requirePageUser(admin=false) {
 const {data:session}=await getVerifiedSession();
 if(!session?.user)redirect('/auth/sign-in');
 const user=await getWorkspaceUser();
 if(!user)redirect('/auth/access-denied');
 if(admin && user.role!=='ADMIN')redirect('/dashboard');
 return user;
}
