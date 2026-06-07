import type { ZodTypeAny, z } from 'zod';
import { zodToValidationError } from './error-handler.js';
import { ValidationError } from './errors.js';

/**
 * Remove server-managed fields from a write body so that supplying them is
 * silently ignored (never trusted), while still allowing `.strict()` to reject
 * genuine typos. Returns a shallow copy.
 *
 * On create, strip both `id` and `created_at`. On update (PUT), `id` is part of
 * the contract (it lives in the body), so strip only `created_at`.
 */
export function stripServerFields(
  body: unknown,
  fields: readonly string[] = ['id', 'created_at'],
): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const f of fields) delete copy[f];
  return copy;
}

/** Validate a request body against a Zod schema, throwing our ValidationError on failure. */
export function validateBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  if (body === undefined) {
    throw new ValidationError('Request body is required and must be a JSON object');
  }
  const result = schema.safeParse(body);
  if (!result.success) throw zodToValidationError(result.error);
  return result.data;
}
