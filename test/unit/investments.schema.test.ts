import { describe, it, expect } from 'vitest';
import { parse } from 'lossless-json';
import { investmentCreateSchema } from '../../src/modules/investments/investments.schema.js';

const body = (json: string): unknown => parse(json);
const UUID = '880e8400-e29b-41d4-a716-446655440003';

describe('investmentCreateSchema', () => {
  it('accepts a valid investment', () => {
    const r = investmentCreateSchema.safeParse(
      body(`{"investor_id":"${UUID}","amount_usd":75000000.00,"investment_date":"2024-09-22"}`),
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount_usd).toBe('75000000.00');
  });

  it('rejects an invalid investor_id uuid', () => {
    expect(
      investmentCreateSchema.safeParse(
        body('{"investor_id":"nope","amount_usd":1,"investment_date":"2024-09-22"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    expect(
      investmentCreateSchema.safeParse(
        body(`{"investor_id":"${UUID}","amount_usd":1,"investment_date":"2024-13-40"}`),
      ).success,
    ).toBe(false);
  });

  it('rejects a future date', () => {
    expect(
      investmentCreateSchema.safeParse(
        body(`{"investor_id":"${UUID}","amount_usd":1,"investment_date":"2999-01-01"}`),
      ).success,
    ).toBe(false);
  });

  it('rejects amount with 3 decimals', () => {
    expect(
      investmentCreateSchema.safeParse(
        body(`{"investor_id":"${UUID}","amount_usd":100.005,"investment_date":"2024-01-01"}`),
      ).success,
    ).toBe(false);
  });

  it('rejects a stray fund_id (strict)', () => {
    expect(
      investmentCreateSchema.safeParse(
        body(`{"investor_id":"${UUID}","amount_usd":1,"investment_date":"2024-01-01","fund_id":"${UUID}"}`),
      ).success,
    ).toBe(false);
  });
});
