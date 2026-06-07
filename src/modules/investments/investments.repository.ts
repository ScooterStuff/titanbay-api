import type { Pool } from 'pg';
import { getPool } from '../../db/pool.js';

export interface InvestmentRow {
  id: string;
  investor_id: string;
  fund_id: string;
  amount_usd: string; // NUMERIC -> exact string
  investment_date: string; // DATE -> 'YYYY-MM-DD' string
}

export interface InvestmentWrite {
  investor_id: string;
  fund_id: string;
  amount_usd: string;
  investment_date: string;
}

const COLUMNS = 'id, investor_id, fund_id, amount_usd, investment_date';

export class InvestmentsRepository {
  constructor(private readonly explicitPool?: Pool) {}
  private get db(): Pool {
    return this.explicitPool ?? getPool();
  }

  async findByFundId(fundId: string): Promise<InvestmentRow[]> {
    const { rows } = await this.db.query<InvestmentRow>(
      `SELECT ${COLUMNS} FROM investments WHERE fund_id = $1 ORDER BY investment_date ASC, id ASC`,
      [fundId],
    );
    return rows;
  }

  async create(input: InvestmentWrite): Promise<InvestmentRow> {
    const { rows } = await this.db.query<InvestmentRow>(
      `INSERT INTO investments (investor_id, fund_id, amount_usd, investment_date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [input.investor_id, input.fund_id, input.amount_usd, input.investment_date],
    );
    return rows[0]!;
  }
}
