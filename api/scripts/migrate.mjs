import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const sql = await readFile(resolve(process.cwd(), 'migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migración 001 aplicada.');
} finally {
  await pool.end();
}
