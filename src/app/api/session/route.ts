import { getVerifiedSession } from '@/lib/auth/server';
import { getWorkspaceUser } from '@/lib/auth/user';
export async function GET() {
 try {
  const { data: session } = await getVerifiedSession();
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await getWorkspaceUser();
  if (!user) return Response.json({ error: 'Workspace access required' }, { status: 403 });
  return Response.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
 } catch { return Response.json({ error: 'Session service unavailable' }, { status: 503 }); }
}
