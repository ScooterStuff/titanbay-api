import { describe, it, expect } from 'vitest';
import { parse } from 'lossless-json';
import { fundCreateSchema, fundUpdateSchema } from '../../src/modules/funds/funds.schema.js';

/** Parse like the real body parser does, so numbers arrive as LosslessNumber. */
function body(json: string): unknown {
  return parse(json);
}

describe('fundCreateSchema', () => {
  it('accepts a valid fund', () => {
    const r = fundCreateSchema.safeParse(
      body(
        '{"name":"Growth Fund","vintage_year":2024,"target_size_usd":250000000.00,"status":"Fundraising"}',
      ),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.target_size_usd).toBe('250000000.00');
      expect(r.data.vintage_year).toBe(2024);
    }
  });

  it('trims and rejects an empty name', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"   ","vintage_year":2024,"target_size_usd":1,"status":"Closed"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects a bad status enum', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024,"target_size_usd":1,"status":"Open"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects negative and zero money', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024,"target_size_usd":-5,"status":"Closed"}'),
      ).success,
    ).toBe(false);
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024,"target_size_usd":0,"status":"Closed"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects money with more than 2 decimals', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024,"target_size_usd":100.005,"status":"Closed"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects money given as a string (wrong type)', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024,"target_size_usd":"lots","status":"Closed"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects a float vintage_year', () => {
    expect(
      fundCreateSchema.safeParse(
        body('{"name":"X","vintage_year":2024.5,"target_size_usd":1,"status":"Closed"}'),
      ).success,
    ).toBe(false);
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(
      fundCreateSchema.safeParse(
        body(
          '{"name":"X","vintage_year":2024,"target_size_usd":1,"status":"Closed","sneaky":true}',
        ),
      ).success,
    ).toBe(false);
  });
});

describe('fundUpdateSchema', () => {
  it('requires a valid uuid id', () => {
    expect(
      fundUpdateSchema.safeParse(
        body(
          '{"id":"not-a-uuid","name":"X","vintage_year":2024,"target_size_usd":1,"status":"Closed"}',
        ),
      ).success,
    ).toBe(false);
  });
  it('accepts a valid update body', () => {
    expect(
      fundUpdateSchema.safeParse(
        body(
          '{"id":"550e8400-e29b-41d4-a716-446655440000","name":"X","vintage_year":2024,"target_size_usd":1,"status":"Investing"}',
        ),
      ).success,
    ).toBe(true);
  });
});
