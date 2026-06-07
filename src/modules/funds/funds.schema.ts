import { z } from 'zod';
import { moneyInput, nameInput, vintageYearInput } from '../../shared/validators.js';

export const FUND_STATUSES = ['Fundraising', 'Investing', 'Closed'] as const;
export type FundStatus = (typeof FUND_STATUSES)[number];

const statusInput = z.enum(FUND_STATUSES, {
  errorMap: () => ({ message: `must be one of: ${FUND_STATUSES.join(', ')}` }),
});

/**
 * Create body. `.strict()` so unknown fields (typos) surface as 400 rather than
 * being silently dropped. Server-managed fields (id, created_at) are stripped
 * before validation by the route, so supplying them is ignored — not an error.
 */
export const fundCreateSchema = z
  .object({
    name: nameInput,
    vintage_year: vintageYearInput,
    target_size_usd: moneyInput,
    status: statusInput,
  })
  .strict();

/** Update body: full replace. `id` lives in the body per the (unusual) spec contract. */
export const fundUpdateSchema = z
  .object({
    id: z.string().uuid({ message: 'must be a valid UUID' }),
    name: nameInput,
    vintage_year: vintageYearInput,
    target_size_usd: moneyInput,
    status: statusInput,
  })
  .strict();

export type FundCreateInput = z.infer<typeof fundCreateSchema>;
export type FundUpdateInput = z.infer<typeof fundUpdateSchema>;
