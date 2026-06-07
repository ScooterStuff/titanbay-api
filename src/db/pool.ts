import pg from 'pg';

const { Pool, types } = pg;

/**
 * Custom type parsers — critical for exact money + date handling.
 *
 * 1. NUMERIC (OID 1700): node-postgres already returns NUMERIC as a string by
 *    default, which is exactly what we want — no float, no precision loss. We set
 *    it explicitly here to make the intent obvious and guard against config drift.
 * 2. DATE (OID 1082): by default node-postgres parses DATE into a JS Date at local
 *    midnight, which can shift across timezones. We keep the raw 'YYYY-MM-DD' string.
 * 3. timestamptz (OID 1184) is left as the default JS Date; we serialize it to the
 *    required UTC 'Z' format in the serializer layer.
 */
const NUMERIC_OID = 1700;
const DATE_OID = 1082;

types.setTypeParser(NUMERIC_OID, (val) => val); // keep as exact string
types.setTypeParser(DATE_OID, (val) => val); // keep as 'YYYY-MM-DD' string

let pool: pg.Pool | undefined;

/** Lazily-created singleton pool. */
export function getPool(connectionString?: string): pg.Pool {
  if (!pool) {
    const url = connectionString ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set; cannot create a connection pool.');
    }
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

/** For tests: inject a pool built against an ephemeral database. */
export function setPool(p: pg.Pool): void {
  pool = p;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
