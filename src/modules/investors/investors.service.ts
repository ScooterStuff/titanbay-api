import { ConflictError } from '../../shared/errors.js';
import { timestampZ } from '../../shared/serializers.js';
import { InvestorsRepository, type InvestorRow } from './investors.repository.js';
import type { InvestorCreateInput, InvestorType } from './investors.schema.js';

export interface InvestorDto {
  id: string;
  name: string;
  investor_type: InvestorType;
  email: string;
  created_at: string;
}

export function serializeInvestor(row: InvestorRow): InvestorDto {
  return {
    id: row.id,
    name: row.name,
    investor_type: row.investor_type,
    email: row.email,
    created_at: timestampZ(row.created_at),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export class InvestorsService {
  constructor(private readonly repo: InvestorsRepository = new InvestorsRepository()) {}

  async list(): Promise<InvestorDto[]> {
    const rows = await this.repo.findAll();
    return rows.map(serializeInvestor);
  }

  async create(input: InvestorCreateInput): Promise<InvestorDto> {
    try {
      const row = await this.repo.create({
        name: input.name,
        investor_type: input.investor_type,
        email: input.email,
      });
      return serializeInvestor(row);
    } catch (err) {
      // The DB unique constraint is the real guard against duplicate emails
      // (also safe under concurrent inserts). Map it to a clean 409.
      if (isUniqueViolation(err)) {
        throw new ConflictError('An investor with this email already exists', [
          { field: 'email', issue: 'must be unique' },
        ]);
      }
      throw err;
    }
  }
}
