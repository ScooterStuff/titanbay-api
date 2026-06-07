import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import pg from 'pg';
import { setPool, closePool } from '../../src/db/pool.js';
import { runMigrations } from '../../src/db/migrate.js';
import { DB_URL_FILE } from './global-setup.js';

function resolveDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    return readFileSync(DB_URL_FILE, 'utf8').trim();
  } catch {
    throw new Error('No test database URL available. Global setup did not run.');
  }
}

/**
 * Wire a real Postgres into the app's singleton pool for a test file:
 *  - connect + migrate once before the suite,
 *  - truncate all tables before each test for isolation,
 *  - close the pool after the suite.
 *
 * The same custom type parsers (NUMERIC → string, DATE → string) apply because
 * we go through src/db/pool.ts.
 */
export function useTestDatabase(): { getPool: () => pg.Pool } {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: resolveDbUrl() });
    setPool(pool);
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE investments, investors, funds RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await closePool();
  });

  return { getPool: () => pool };
}
