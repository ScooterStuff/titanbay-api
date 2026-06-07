import { Router } from 'express';
import { asyncHandler, sendJson } from '../../shared/http.js';
import { stripServerFields, validateBody } from '../../shared/parse.js';
import { investorCreateSchema } from './investors.schema.js';
import { InvestorsService } from './investors.service.js';

export function investorsRouter(service: InvestorsService = new InvestorsService()): Router {
  const router = Router();

  // GET /investors
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      sendJson(res, 200, await service.list());
    }),
  );

  // POST /investors
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = validateBody(investorCreateSchema, stripServerFields(req.body));
      sendJson(res, 201, await service.create(input));
    }),
  );

  return router;
}
