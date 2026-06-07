import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { getPool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Minimal forward-only migration runner. Each numbered .sql file is applied once
 * and recorded in schema_migrations. Files are applied in filename order. Each
 * file runs inside its own transaction so a failure leaves no partial schema.
 */
export async function runMigrations(pool: Pool = getPool()): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const allFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  const newlyApplied: string[] = [];
  for (const file of allFiles) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return newlyApplied;
}

// Allow running directly: `npm run migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = getPool();
  runMigrations(pool)
    .then((applied) => {
      if (applied.length === 0) {
        console.log('[migrate] up to date — no new migrations.');
      } else {
        console.log(`[migrate] applied: ${applied.join(', ')}`);
      }
      return pool.end();
    })
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exitCode = 1;
      return pool.end();
    });
}
