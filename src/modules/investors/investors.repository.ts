import type { Pool } from 'pg';
import { getPool } from '../../db/pool.js';
import type { InvestorType } from './investors.schema.js';

export interface InvestorRow {
  id: string;
  name: string;
  investor_type: InvestorType;
  email: string;
  created_at: Date;
}

export interface InvestorWrite {
  name: string;
  investor_type: InvestorType;
  email: string;
}

const COLUMNS = 'id, name, investor_type, email, created_at';

export class InvestorsRepository {
  constructor(private readonly explicitPool?: Pool) {}
  private get db(): Pool {
    return this.explicitPool ?? getPool();
  }

  async findAll(): Promise<InvestorRow[]> {
    const { rows } = await this.db.query<InvestorRow>(
      `SELECT ${COLUMNS} FROM investors ORDER BY created_at ASC`,
    );
    return rows;
  }

  async findById(id: string): Promise<InvestorRow | null> {
    const { rows } = await this.db.query<InvestorRow>(
      `SELECT ${COLUMNS} FROM investors WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async create(input: InvestorWrite): Promise<InvestorRow> {
    const { rows } = await this.db.query<InvestorRow>(
      `INSERT INTO investors (name, investor_type, email)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [input.name, input.investor_type, input.email],
    );
    return rows[0]!;
  }

  async exists(id: string): Promise<boolean> {
    const { rowCount } = await this.db.query('SELECT 1 FROM investors WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
