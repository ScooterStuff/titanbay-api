import { Router } from 'express';
import { asyncHandler, sendJson } from '../../shared/http.js';
import { stripServerFields, validateBody } from '../../shared/parse.js';
import { parseUuidParam } from '../../shared/uuid.js';
import { investmentCreateSchema } from './investments.schema.js';
import { InvestmentsService } from './investments.service.js';

/**
 * Mounted at /funds. Handles the nested investments resource:
 *   GET  /funds/:fund_id/investments
 *   POST /funds/:fund_id/investments
 */
export function investmentsRouter(service: InvestmentsService = new InvestmentsService()): Router {
  const router = Router();

  router.get(
    '/:fund_id/investments',
    asyncHandler(async (req, res) => {
      const fundId = parseUuidParam(String(req.params.fund_id), 'fund_id');
      sendJson(res, 200, await service.listForFund(fundId));
    }),
  );

  router.post(
    '/:fund_id/investments',
    asyncHandler(async (req, res) => {
      const fundId = parseUuidParam(String(req.params.fund_id), 'fund_id');
      const input = validateBody(investmentCreateSchema, stripServerFields(req.body));
      sendJson(res, 201, await service.createForFund(fundId, input));
    }),
  );

  return router;
}
