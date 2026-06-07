import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Vitest global setup. Provisions a real Postgres for the integration suite:
 *
 *  - If TEST_DATABASE_URL is already set (e.g. CI service container, or a local
 *    rootless Postgres), we use it as-is.
 *  - Otherwise we start a throwaway Postgres 16 via Testcontainers (requires
 *    Docker, which GitHub Actions provides).
 *
 * The resolved URL is written to a temp file that per-file setup reads, because
 * process.env mutations in globalSetup do not reliably reach worker processes.
 */
export const DB_URL_FILE = join(tmpdir(), 'titanbay-test-db-url');

export default async function setup(): Promise<() => Promise<void>> {
  if (process.env.TEST_DATABASE_URL) {
    writeFileSync(DB_URL_FILE, process.env.TEST_DATABASE_URL, 'utf8');
    return async () => {
      rmSync(DB_URL_FILE, { force: true });
    };
  }

  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const dir = mkdtempSync(join(tmpdir(), 'pgtc-'));
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const url = container.getConnectionUri();
  writeFileSync(DB_URL_FILE, url, 'utf8');

  return async () => {
    await container.stop();
    rmSync(DB_URL_FILE, { force: true });
    rmSync(dir, { recursive: true, force: true });
  };
}
