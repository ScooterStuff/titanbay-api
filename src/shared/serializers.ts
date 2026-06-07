import { Decimal } from 'decimal.js';
import { LosslessNumber } from 'lossless-json';

/**
 * Money serializer. The DB returns NUMERIC(20,2) as an exact string. We wrap it
 * in a LosslessNumber so that when the response is stringified with lossless-json
 * the value is emitted as a JSON *number* with its exact digits — never routed
 * through a JS float. Normalised to exactly 2 decimal places per the spec.
 */
export function money(value: string | number): LosslessNumber {
  const fixed = new Decimal(value).toFixed(2);
  return new LosslessNumber(fixed);
}

/**
 * Timestamp serializer: RFC 3339 / ISO 8601 in UTC with a trailing 'Z' and no
 * milliseconds (e.g. '2024-01-15T10:30:00Z'), matching the spec exactly.
 */
export function timestampZ(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Date-only serializer. The DB returns DATE as 'YYYY-MM-DD' (custom type parser),
 * so this is a pass-through that also defends against a Date sneaking in.
 */
export function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}
