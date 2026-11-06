import {neon} from '@neondatabase/serverless';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Run once against each deployment database before releasing the new mapper.
const supplied=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
if(!supplied)throw new Error('DATABASE_URL is required.');
const address=new URL(supplied);
if(/\.neon\.(tech|build)$/.test(address.hostname))address.hostname=address.hostname.replace('-pooler.','.');
const sql=neon(address.toString());
const name='004_signing_details.sql';
const source=await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8');
const checksum=createHash('sha256').update(source).digest('hex');
try{
 const applied=await sql`SELECT checksum FROM touchsign_migrations WHERE name=${name}`;
 if(applied.length){
  if(applied[0].checksum!==checksum)throw new Error('MIGRATION_CHECKSUM_MISMATCH');
  console.log('Signing details schema is already up to date.');
 }else{
  await sql.transaction([
   ...source.split('-- statement-breakpoint').map(statement=>sql.query(statement.trim())),
   sql`INSERT INTO touchsign_migrations(name,checksum) VALUES(${name},${checksum})`,
  ]);
  console.log('Signing details schema upgraded.');
 }
}catch(error){
 console.error('Signing details upgrade failed:',error.code||error.name);
 process.exitCode=1;
}
