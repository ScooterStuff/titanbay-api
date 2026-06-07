import { LosslessNumber } from 'lossless-json';
import { NotFoundError, UnprocessableError } from '../../shared/errors.js';
import { dateOnly, money } from '../../shared/serializers.js';
import { FundsRepository } from '../funds/funds.repository.js';
import { InvestorsRepository } from '../investors/investors.repository.js';
import { InvestmentsRepository, type InvestmentRow } from './investments.repository.js';
import type { InvestmentCreateInput } from './investments.schema.js';

export interface InvestmentDto {
  id: string;
  investor_id: string;
  fund_id: string;
  amount_usd: LosslessNumber;
  investment_date: string;
}

export function serializeInvestment(row: InvestmentRow): InvestmentDto {
  return {
    id: row.id,
    investor_id: row.investor_id,
    fund_id: row.fund_id,
    amount_usd: money(row.amount_usd),
    investment_date: dateOnly(row.investment_date),
  };
}

export class InvestmentsService {
  constructor(
    private readonly repo: InvestmentsRepository = new InvestmentsRepository(),
    private readonly funds: FundsRepository = new FundsRepository(),
    private readonly investors: InvestorsRepository = new InvestorsRepository(),
  ) {}

  /** List investments for a fund. A missing fund is a 404 — not an empty array. */
  async listForFund(fundId: string): Promise<InvestmentDto[]> {
    if (!(await this.funds.exists(fundId))) {
      throw new NotFoundError(`Fund ${fundId} not found`);
    }
    const rows = await this.repo.findByFundId(fundId);
    return rows.map(serializeInvestment);
  }

  /**
   * Create an investment.
   *  - Missing fund (addressed by the URL path) → 404.
   *  - Missing investor (referenced in the body) → 422.
   * The FK constraints are the backstop against a race between check and insert.
   */
  async createForFund(fundId: string, input: InvestmentCreateInput): Promise<InvestmentDto> {
    if (!(await this.funds.exists(fundId))) {
      throw new NotFoundError(`Fund ${fundId} not found`);
    }
    if (!(await this.investors.exists(input.investor_id))) {
      throw new UnprocessableError(`Investor ${input.investor_id} does not exist`, [
        { field: 'investor_id', issue: 'must reference an existing investor' },
      ]);
    }
    const row = await this.repo.create({
      investor_id: input.investor_id,
      fund_id: fundId,
      amount_usd: input.amount_usd,
      investment_date: input.investment_date,
    });
    return serializeInvestment(row);
  }
}
