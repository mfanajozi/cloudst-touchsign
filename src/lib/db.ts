import 'server-only';
import { neon } from '@neondatabase/serverless';
export function getDatabase() {
 const url = process.env.DATABASE_URL;
 if (!url) throw new Error('DATABASE_URL is missing. Run neon deploy.');
 return neon(url);
}
