import { ValidationError } from './errors.js';
import { uuidParam } from './validators.js';

/**
 * Parse a UUID path parameter. A malformed UUID is a *bad request* (400), not a
 * 404 — the request itself is invalid, the resource was never addressable.
 */
export function parseUuidParam(value: string, field: string): string {
  const result = uuidParam.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid UUID in path', [{ field, issue: 'must be a valid UUID' }]);
  }
  return result.data.toLowerCase();
}
