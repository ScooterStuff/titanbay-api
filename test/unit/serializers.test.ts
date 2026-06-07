import { describe, it, expect } from 'vitest';
import { stringify } from 'lossless-json';
import { money, timestampZ, dateOnly } from '../../src/shared/serializers.js';

describe('money serializer', () => {
  it('emits exact 2dp numbers with no float drift', () => {
    expect(stringify(money('75000000.01'))).toBe('75000000.01');
    expect(stringify(money('250000000.00'))).toBe('250000000.00');
    expect(stringify(money('0.30'))).toBe('0.30');
  });

  it('normalises to exactly 2 decimal places', () => {
    expect(stringify(money('100'))).toBe('100.00');
    expect(stringify(money('100.5'))).toBe('100.50');
  });

  it('preserves very large 18-integer-digit values exactly', () => {
    const big = '999999999999999999.99';
    expect(stringify(money(big))).toBe(big);
  });

  it('does not use scientific notation', () => {
    expect(stringify(money('1000000000000.00'))).not.toMatch(/e/i);
  });
});

describe('timestampZ serializer', () => {
  it('formats UTC with trailing Z and no milliseconds', () => {
    expect(timestampZ(new Date('2024-01-15T10:30:00.000Z'))).toBe('2024-01-15T10:30:00Z');
  });
  it('accepts a string and normalises it', () => {
    expect(timestampZ('2024-02-10T09:15:00.123Z')).toBe('2024-02-10T09:15:00Z');
  });
});

describe('dateOnly serializer', () => {
  it('passes through a YYYY-MM-DD string', () => {
    expect(dateOnly('2024-03-15')).toBe('2024-03-15');
  });
});
