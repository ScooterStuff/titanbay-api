import { describe, it, expect, vi } from 'vitest';
import { FundsService } from '../../src/modules/funds/funds.service.js';
import { InvestmentsService } from '../../src/modules/investments/investments.service.js';
import { NotFoundError, UnprocessableError } from '../../src/shared/errors.js';

/**
 * Service-layer tests with the repositories mocked — no DB. These prove the
 * service maps repository results to the right errors, independent of SQL.
 */
describe('FundsService (repo mocked)', () => {
  it('throws NotFound when the repo returns null for getById', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(null) } as never;
    const service = new FundsService(repo);
    await expect(service.getById('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws NotFound when update targets a missing fund', async () => {
    const repo = { update: vi.fn().mockResolvedValue(null) } as never;
    const service = new FundsService(repo);
    await expect(
      service.update({
        id: '00000000-0000-0000-0000-000000000000',
        name: 'X',
        vintage_year: 2024,
        target_size_usd: '1.00',
        status: 'Closed',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('InvestmentsService (repos mocked)', () => {
  const input = {
    investor_id: '880e8400-e29b-41d4-a716-446655440003',
    amount_usd: '100.00',
    investment_date: '2024-01-01',
  };

  it('throws NotFound (404) when the fund does not exist', async () => {
    const funds = { exists: vi.fn().mockResolvedValue(false) } as never;
    const investors = { exists: vi.fn() } as never;
    const repo = { create: vi.fn() } as never;
    const service = new InvestmentsService(repo, funds, investors);
    await expect(service.createForFund('fund-x', input)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws Unprocessable (422) when the investor does not exist', async () => {
    const funds = { exists: vi.fn().mockResolvedValue(true) } as never;
    const investors = { exists: vi.fn().mockResolvedValue(false) } as never;
    const repo = { create: vi.fn() } as never;
    const service = new InvestmentsService(repo, funds, investors);
    await expect(service.createForFund('fund-x', input)).rejects.toBeInstanceOf(UnprocessableError);
  });

  it('listForFund throws NotFound (404) for a missing fund', async () => {
    const funds = { exists: vi.fn().mockResolvedValue(false) } as never;
    const investors = { exists: vi.fn() } as never;
    const repo = { findByFundId: vi.fn() } as never;
    const service = new InvestmentsService(repo, funds, investors);
    await expect(service.listForFund('fund-x')).rejects.toBeInstanceOf(NotFoundError);
  });
});
