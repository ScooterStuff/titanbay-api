/** Machine-readable error codes used in the JSON error envelope. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR';

export interface FieldIssue {
  field: string;
  issue: string;
}

/** Base class for all expected (operational) errors. The error handler maps these. */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;
  readonly details?: FieldIssue[];

  constructor(message: string, details?: FieldIssue[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** 400 — request body/path failed schema validation or JSON was malformed. */
export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR';
}

/** 404 — a resource addressed by the URL path does not exist. */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
}

/** 409 — a uniqueness constraint was violated (e.g. duplicate investor email). */
export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'CONFLICT';
}

/** 422 — request was well-formed but references an entity that does not exist. */
export class UnprocessableError extends AppError {
  readonly status = 422;
  readonly code = 'UNPROCESSABLE';
}

/** 415 — write request did not use application/json. */
export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';
}
