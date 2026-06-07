import { LosslessNumber } from 'lossless-json';
import { NotFoundError } from '../../shared/errors.js';
import { money, timestampZ } from '../../shared/serializers.js';
import { FundsRepository, type FundRow } from './funds.repository.js';
import type { FundCreateInput, FundStatus, FundUpdateInput } from './funds.schema.js';

/** The wire shape of a fund. Money is a LosslessNumber → exact JSON number. */
export interface FundDto {
  id: string;
  name: string;
  vintage_year: number;
  target_size_usd: LosslessNumber;
  status: FundStatus;
  created_at: string;
}

export function serializeFund(row: FundRow): FundDto {
  return {
    id: row.id,
    name: row.name,
    vintage_year: row.vintage_year,
    target_size_usd: money(row.target_size_usd),
    status: row.status,
    created_at: timestampZ(row.created_at),
  };
}

export class FundsService {
  constructor(private readonly repo: FundsRepository = new FundsRepository()) {}

  async list(): Promise<FundDto[]> {
    const rows = await this.repo.findAll();
    return rows.map(serializeFund);
  }

  async getById(id: string): Promise<FundDto> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError(`Fund ${id} not found`);
    return serializeFund(row);
  }

  async create(input: FundCreateInput): Promise<FundDto> {
    const row = await this.repo.create({
      name: input.name,
      vintage_year: input.vintage_year,
      target_size_usd: input.target_size_usd,
      status: input.status,
    });
    return serializeFund(row);
  }

  async update(input: FundUpdateInput): Promise<FundDto> {
    const row = await this.repo.update(input.id, {
      name: input.name,
      vintage_year: input.vintage_year,
      target_size_usd: input.target_size_usd,
      status: input.status,
    });
    if (!row) throw new NotFoundError(`Fund ${input.id} not found`);
    return serializeFund(row);
  }
}
