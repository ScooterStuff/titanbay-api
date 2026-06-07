import type { Pool } from 'pg';
import { getPool } from '../../db/pool.js';
import type { FundStatus } from './funds.schema.js';

/** A fund row exactly as stored. Money is a string (NUMERIC), created_at a Date (timestamptz). */
export interface FundRow {
  id: string;
  name: string;
  vintage_year: number;
  target_size_usd: string;
  status: FundStatus;
  created_at: Date;
}

export interface FundWrite {
  name: string;
  vintage_year: number;
  target_size_usd: string; // exact decimal string
  status: FundStatus;
}

const COLUMNS = 'id, name, vintage_year, target_size_usd, status, created_at';

/**
 * Repository: SQL only. Knows nothing about HTTP. All queries are parameterised
 * (no string interpolation) so SQL injection is structurally impossible.
 */
export class FundsRepository {
  // Pool is resolved lazily (per query) so the singleton can be configured at
  // boot or swapped by tests before the first query runs.
  constructor(private readonly explicitPool?: Pool) {}
  private get db(): Pool {
    return this.explicitPool ?? getPool();
  }

  async findAll(): Promise<FundRow[]> {
    const { rows } = await this.db.query<FundRow>(
      `SELECT ${COLUMNS} FROM funds ORDER BY created_at ASC`,
    );
    return rows;
  }

  async findById(id: string): Promise<FundRow | null> {
    const { rows } = await this.db.query<FundRow>(`SELECT ${COLUMNS} FROM funds WHERE id = $1`, [
      id,
    ]);
    return rows[0] ?? null;
  }

  async create(input: FundWrite): Promise<FundRow> {
    const { rows } = await this.db.query<FundRow>(
      `INSERT INTO funds (name, vintage_year, target_size_usd, status)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [input.name, input.vintage_year, input.target_size_usd, input.status],
    );
    return rows[0]!;
  }

  /** Update all mutable fields; created_at is never touched. Returns null if not found. */
  async update(id: string, input: FundWrite): Promise<FundRow | null> {
    const { rows } = await this.db.query<FundRow>(
      `UPDATE funds
          SET name = $2, vintage_year = $3, target_size_usd = $4, status = $5
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, input.name, input.vintage_year, input.target_size_usd, input.status],
    );
    return rows[0] ?? null;
  }

  async exists(id: string): Promise<boolean> {
    const { rowCount } = await this.db.query('SELECT 1 FROM funds WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
