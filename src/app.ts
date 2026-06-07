import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './shared/error-handler.js';
import { jsonBody } from './shared/json-body.js';
import { requestLogger } from './shared/request-logger.js';
import { fundsRouter } from './modules/funds/funds.routes.js';
import { investorsRouter } from './modules/investors/investors.routes.js';

/**
 * Build the Express app without starting a listener, so tests can import it and
 * drive it via Supertest. Middleware order matters:
 *   requestLogger -> raw body capture -> lossless JSON parse -> routes -> 404 -> errors
 */
export function buildApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger);

  // Capture the raw body for ALL content types; we parse it ourselves (see jsonBody).
  app.use(express.raw({ type: () => true, limit: '1mb' }));
  app.use(jsonBody);

  // Health check (handy for Docker / load balancers; not part of the 8 endpoints).
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/funds', fundsRouter());
  app.use('/investors', investorsRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
