import { loadConfig } from '../src/config.js';
import { getPool, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { logger } from '../src/shared/logger.js';

/**
 * Idempotent demo seed. Uses fixed UUIDs + ON CONFLICT DO NOTHING so it is safe
 * to run repeatedly. Refuses to run against NODE_ENV=production.
 *
 * Shape of the data (so the list endpoints are meaningful):
 *  - 3 funds, one in each status, across different vintage years.
 *  - 4 investors covering all three investor_type values.
 *  - 6 investments, including one investor in two funds and funds with multiple
 *    investors (and a top-up: the same investor committing to one fund twice).
 */
const FUNDS = [
  [
    '11111111-1111-1111-1111-111111111111',
    'Titanbay Growth Fund I',
    2024,
    '250000000.00',
    'Fundraising',
  ],
  [
    '22222222-2222-2222-2222-222222222222',
    'Titanbay Buyout Fund II',
    2022,
    '500000000.00',
    'Investing',
  ],
  ['33333333-3333-3333-3333-333333333333', 'Titanbay Legacy Fund', 2018, '125000000.00', 'Closed'],
] as const;

const INVESTORS = [
  [
    '44444444-4444-4444-4444-444444444444',
    'Goldman Sachs Asset Management',
    'Institution',
    'investments@gsam.com',
  ],
  [
    '55555555-5555-5555-5555-555555555555',
    'CalPERS',
    'Institution',
    'privateequity@calpers.ca.gov',
  ],
  ['66666666-6666-6666-6666-666666666666', 'Jane Patel', 'Individual', 'jane.patel@example.com'],
  [
    '77777777-7777-7777-7777-777777777777',
    'The Larsson Family Office',
    'Family Office',
    'office@larssonfo.com',
  ],
] as const;

const INVESTMENTS = [
  // Growth Fund I — three investors
  [
    '88888888-8888-8888-8888-888888888881',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    '50000000.00',
    '2024-03-15',
  ],
  [
    '88888888-8888-8888-8888-888888888882',
    '55555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    '40000000.00',
    '2024-04-01',
  ],
  [
    '88888888-8888-8888-8888-888888888883',
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '10000000.00',
    '2024-05-20',
  ],
  // Buyout Fund II — GSAM also invests here (one investor, two funds)
  [
    '88888888-8888-8888-8888-888888888884',
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '75000000.01',
    '2024-09-22',
  ],
  // ...and a top-up: GSAM commits to Buyout II again (same fund, same investor)
  [
    '88888888-8888-8888-8888-888888888885',
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '25000000.00',
    '2025-01-10',
  ],
  // Legacy Fund — Jane (an individual)
  [
    '88888888-8888-8888-8888-888888888886',
    '66666666-6666-6666-6666-666666666666',
    '33333333-3333-3333-3333-333333333333',
    '5000000.00',
    '2023-11-30',
  ],
] as const;

async function seed(): Promise<void> {
  const config = loadConfig();
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }
  const pool = getPool(config.DATABASE_URL);
  await runMigrations(pool);

  for (const [id, name, vintage, size, status] of FUNDS) {
    await pool.query(
      `INSERT INTO funds (id, name, vintage_year, target_size_usd, status)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id, name, vintage, size, status],
    );
  }
  for (const [id, name, type, email] of INVESTORS) {
    await pool.query(
      `INSERT INTO investors (id, name, investor_type, email)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, name, type, email],
    );
  }
  for (const [id, investorId, fundId, amount, date] of INVESTMENTS) {
    await pool.query(
      `INSERT INTO investments (id, investor_id, fund_id, amount_usd, investment_date)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id, investorId, fundId, amount, date],
    );
  }

  const counts = await pool.query<{ funds: string; investors: string; investments: string }>(
    `SELECT
       (SELECT count(*) FROM funds)       AS funds,
       (SELECT count(*) FROM investors)   AS investors,
       (SELECT count(*) FROM investments) AS investments`,
  );
  logger.info('seed complete', counts.rows[0]);
  console.log(
    `Seeded: ${counts.rows[0]!.funds} funds, ${counts.rows[0]!.investors} investors, ${counts.rows[0]!.investments} investments.`,
  );
}

seed()
  .then(() => closePool())
  .catch((err) => {
    logger.error('seed_failed', { err: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
    return closePool();
  });
