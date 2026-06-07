import { z } from 'zod';
import { investmentDateInput, moneyInput } from '../../shared/validators.js';

/**
 * Investment create body. `fund_id` is NOT here — it comes from the URL path.
 * `.strict()` so unexpected fields (including a stray fund_id) surface as 400.
 */
export const investmentCreateSchema = z
  .object({
    investor_id: z.string().uuid({ message: 'must be a valid UUID' }),
    amount_usd: moneyInput,
    investment_date: investmentDateInput,
  })
  .strict();

export type InvestmentCreateInput = z.infer<typeof investmentCreateSchema>;
