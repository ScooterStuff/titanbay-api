import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { stringify } from 'lossless-json';

/**
 * Serialize a payload with lossless-json so LosslessNumber values (money) are
 * emitted as exact JSON numbers, then send it. We bypass res.json() because that
 * uses JSON.stringify, which would route money through a JS float.
 */
export function sendJson(res: Response, status: number, payload: unknown): void {
  res.status(status).type('application/json').send(stringify(payload));
}

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
