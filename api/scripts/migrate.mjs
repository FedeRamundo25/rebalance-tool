import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('DATABASE_URL_UNPOOLED (o DATABASE_URL) es obligatorio para ejecutar migraciones.');
const pool = new pg.Pool({ connectionString: migrationUrl, ssl: { rejectUnauthorized: false } });
try {
  const sql = await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migración 001 aplicada.');
} finally {
  await pool.end();
}
