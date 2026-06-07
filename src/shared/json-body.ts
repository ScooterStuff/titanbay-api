import type { NextFunction, Request, Response } from 'express';
import { parse } from 'lossless-json';
import { UnsupportedMediaTypeError, ValidationError } from './errors.js';

/**
 * Body parsing middleware. We deliberately do NOT use express.json():
 *
 *  - express.json() runs the body through JSON.parse, turning every number into a
 *    JS float. For money that means precision loss before our code ever sees it.
 *  - Instead we read the raw bytes (via express.raw upstream) and parse with
 *    lossless-json, which keeps every number as a LosslessNumber (string-backed),
 *    so money survives end-to-end with exact precision.
 *
 * It also enforces the write content-type and turns malformed JSON into a clean
 * 400 instead of a 500.
 */
export function jsonBody(req: Request, _res: Response, next: NextFunction): void {
  const isWrite = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH';

  if (!isWrite) {
    req.body = undefined;
    return next();
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    return next(new UnsupportedMediaTypeError('Content-Type must be application/json'));
  }

  const raw: unknown = req.body;
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.alloc(0);
  if (buf.length === 0) {
    // Empty body — let the per-route schema produce a clear validation error.
    req.body = undefined;
    return next();
  }

  try {
    req.body = parse(buf.toString('utf8'));
  } catch {
    return next(new ValidationError('Request body is not valid JSON'));
  }
  next();
}
