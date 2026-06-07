import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  AppError,
  ConflictError,
  type ErrorCode,
  type FieldIssue,
  UnprocessableError,
  ValidationError,
} from './errors.js';
import { sendJson } from './http.js';
import { logger } from './logger.js';

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldIssue[];
  };
}

/** Convert a ZodError into our ValidationError with per-field details. */
export function zodToValidationError(err: ZodError): ValidationError {
  const details: FieldIssue[] = err.issues.map((i) => ({
    field: i.path.length ? i.path.join('.') : '(body)',
    issue: i.message,
  }));
  return new ValidationError('Request validation failed', details);
}

interface PgError {
  code: string;
  constraint?: string;
}
function isPgError(err: unknown): err is PgError {
  return typeof err === 'object' && err !== null && typeof (err as PgError).code === 'string';
}

/** Map known Postgres SQLSTATE codes to AppErrors as a backstop behind app checks. */
function mapPgError(err: PgError): AppError | undefined {
  switch (err.code) {
    case '23505': // unique_violation
      return new ConflictError('A resource with these unique values already exists');
    case '23503': // foreign_key_violation
      return new UnprocessableError('A referenced entity does not exist');
    case '23514': // check_violation
    case '22003': // numeric_value_out_of_range
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
    case '22P02': // invalid_text_representation
      return new ValidationError('Request violates a data constraint');
    default:
      return undefined;
  }
}

/**
 * Central error middleware. Every error funnels through here and is rendered as
 * the single JSON envelope. Stack traces and DB internals are never sent to the
 * client; 5xx are logged in full server-side.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let appErr: AppError;
  if (err instanceof AppError) {
    appErr = err;
  } else if (err instanceof ZodError) {
    appErr = zodToValidationError(err);
  } else if (err instanceof SyntaxError) {
    // Belt-and-braces: malformed JSON that slipped past the body parser.
    appErr = new ValidationError('Request body is not valid JSON');
  } else if (isPgError(err)) {
    appErr = mapPgError(err) ?? new InternalError();
  } else {
    appErr = new InternalError();
  }

  if (appErr.status >= 500) {
    logger.error('unhandled_error', {
      method: req.method,
      path: req.originalUrl,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    });
  }

  const envelope: ErrorEnvelope = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...(appErr.details ? { details: appErr.details } : {}),
    },
  };
  sendJson(res, appErr.status, envelope);
};

/** 500 — never leaks internals; message is generic. */
class InternalError extends AppError {
  readonly status = 500;
  readonly code = 'INTERNAL_ERROR';
  constructor() {
    super('An unexpected error occurred');
  }
}

/** 404 fallback for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  sendJson(res, 404, {
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.path}` },
  });
}
