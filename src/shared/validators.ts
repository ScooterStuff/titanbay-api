import { Decimal } from 'decimal.js';
import { isLosslessNumber, LosslessNumber } from 'lossless-json';
import { z } from 'zod';

/**
 * NUMERIC(20,2): 18 integer digits + 2 fractional digits. The exclusive upper
 * bound on the absolute value is therefore 10^18.
 */
const MONEY_MAX_EXCLUSIVE = new Decimal('1e18');

/**
 * Money input validator.
 *
 * Input arrives as a LosslessNumber (string-backed) thanks to lossless-json, so
 * we validate the *exact* literal the client sent — no float has touched it. We
 * reject: non-numbers, NaN/Infinity, <= 0, more than 2 decimal places, and values
 * at/above the NUMERIC(20,2) column limit. Output is the exact decimal string we
 * hand to Postgres.
 */
export const moneyInput = z
  .custom<LosslessNumber>((v) => isLosslessNumber(v), { message: 'must be a number' })
  .transform((v, ctx) => {
    const raw = v.toString();
    let d: Decimal;
    try {
      d = new Decimal(raw);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a valid number' });
      return z.NEVER;
    }
    if (!d.isFinite()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a finite number' });
      return z.NEVER;
    }
    if (d.lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be greater than 0' });
      return z.NEVER;
    }
    if (d.decimalPlaces() > 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must have at most 2 decimal places' });
      return z.NEVER;
    }
    if (d.gte(MONEY_MAX_EXCLUSIVE)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'exceeds the maximum supported value' });
      return z.NEVER;
    }
    return d.toFixed(2); // exact, normalised string for Postgres NUMERIC(20,2)
  });

/**
 * Vintage-year validator. Must be an integer (no decimals like 2024.5) within
 * [1900, currentYear + 1]. Output is a JS number (safe — small integer).
 */
export const vintageYearInput = z
  .custom<LosslessNumber>((v) => isLosslessNumber(v), { message: 'must be a number' })
  .transform((v, ctx) => {
    const raw = v.toString();
    if (!/^-?\d+$/.test(raw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be an integer' });
      return z.NEVER;
    }
    const year = Number(raw);
    const max = new Date().getUTCFullYear() + 1;
    if (year < 1900 || year > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `must be between 1900 and ${max}`,
      });
      return z.NEVER;
    }
    return year;
  });

/** Trimmed, non-empty name, 1–200 chars (after trim). */
export const nameInput = z
  .string({ message: 'must be a string' })
  .transform((s) => s.trim())
  .pipe(z.string().min(1, 'must not be empty').max(200, 'must be at most 200 characters'));

/** Date-only string 'YYYY-MM-DD', a real calendar date, not in the future (UTC). */
export const investmentDateInput = z
  .string({ message: 'must be a string' })
  .superRefine((s, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be in YYYY-MM-DD format' });
      return;
    }
    const [y, m, day] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, day));
    const isReal =
      dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
    if (!isReal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'is not a valid calendar date' });
      return;
    }
    const todayUtc = new Date();
    const todayMidnight = Date.UTC(
      todayUtc.getUTCFullYear(),
      todayUtc.getUTCMonth(),
      todayUtc.getUTCDate(),
    );
    if (dt.getTime() > todayMidnight) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must not be in the future' });
    }
  });

/** Validate a UUID path param; throws a 400 ValidationError on bad format. */
export const uuidParam = z.string().uuid();
