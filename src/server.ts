import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { getPool, closePool } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './shared/logger.js';

/** Entry point: validate config, run migrations, then start listening. */
async function main(): Promise<void> {
  const config = loadConfig();
  const pool = getPool(config.DATABASE_URL);

  // Apply migrations on boot so the schema is always present and reproducible.
  const applied = await runMigrations(pool);
  logger.info('migrations', { applied });

  const app = buildApp();
  const server = app.listen(config.PORT, () => {
    logger.info('listening', { port: config.PORT, env: config.NODE_ENV });
  });

  const shutdown = (signal: string) => {
    logger.info('shutdown', { signal });
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('startup_failed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
