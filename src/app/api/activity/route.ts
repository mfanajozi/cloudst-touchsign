import { requireUser, apiError } from '@/lib/api';
import { getDatabase } from '@/lib/db';
export async function GET() {
 try {
  const user = await requireUser(); const sql = getDatabase();
  const activities = await sql`SELECT action,created_at FROM user_activities WHERE user_id=${user.id} ORDER BY created_at DESC,id LIMIT 100`;
  return Response.json({activities}, {headers:{'Cache-Control':'private, no-store'}});
 } catch(error) { return apiError(error); }
}
