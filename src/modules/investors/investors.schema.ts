import { z } from 'zod';
import { nameInput } from '../../shared/validators.js';

export const INVESTOR_TYPES = ['Individual', 'Institution', 'Family Office'] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

const investorTypeInput = z.enum(INVESTOR_TYPES, {
  errorMap: () => ({ message: `must be one of: ${INVESTOR_TYPES.join(', ')}` }),
});

/** Email: trimmed + lowercased before validation, RFC-ish format, length-capped. */
const emailInput = z
  .string({ message: 'must be a string' })
  .transform((s) => s.trim().toLowerCase())
  .pipe(
    z
      .string()
      .email('must be a valid email address')
      .max(254, 'must be at most 254 characters'),
  );

export const investorCreateSchema = z
  .object({
    name: nameInput,
    investor_type: investorTypeInput,
    email: emailInput,
  })
  .strict();

export type InvestorCreateInput = z.infer<typeof investorCreateSchema>;
