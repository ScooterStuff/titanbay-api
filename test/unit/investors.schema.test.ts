import { describe, it, expect } from 'vitest';
import { parse } from 'lossless-json';
import { investorCreateSchema } from '../../src/modules/investors/investors.schema.js';

const body = (json: string): unknown => parse(json);

describe('investorCreateSchema', () => {
  it('accepts a valid investor and lowercases the email', () => {
    const r = investorCreateSchema.safeParse(
      body(
        '{"name":"CalPERS","investor_type":"Institution","email":"PrivateEquity@CalPERS.ca.gov"}',
      ),
    );
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('privateequity@calpers.ca.gov');
  });

  it('rejects a bad investor_type', () => {
    expect(
      investorCreateSchema.safeParse(body('{"name":"X","investor_type":"Robot","email":"a@b.com"}'))
        .success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      investorCreateSchema.safeParse(
        body('{"name":"X","investor_type":"Individual","email":"not-an-email"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    expect(
      investorCreateSchema.safeParse(
        body('{"name":"X","investor_type":"Individual","email":"a@b.com","extra":1}'),
      ).success,
    ).toBe(false);
  });
});
