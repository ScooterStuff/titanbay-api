import { Router } from 'express';
import { asyncHandler, sendJson } from '../../shared/http.js';
import { stripServerFields, validateBody } from '../../shared/parse.js';
import { parseUuidParam } from '../../shared/uuid.js';
import { fundCreateSchema, fundUpdateSchema } from './funds.schema.js';
import { FundsService } from './funds.service.js';

/**
 * Routes: parse/validate input → call the service → serialize the response.
 * No SQL, no business rules here. The service owns those.
 */
export function fundsRouter(service: FundsService = new FundsService()): Router {
  const router = Router();

  // GET /funds
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      sendJson(res, 200, await service.list());
    }),
  );

  // POST /funds
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = validateBody(fundCreateSchema, stripServerFields(req.body));
      sendJson(res, 201, await service.create(input));
    }),
  );

  // PUT /funds — note: id is in the body, per the spec contract.
  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const input = validateBody(fundUpdateSchema, stripServerFields(req.body, ['created_at']));
      sendJson(res, 200, await service.update(input));
    }),
  );

  // GET /funds/:id
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseUuidParam(String(req.params.id), 'id');
      sendJson(res, 200, await service.getById(id));
    }),
  );

  return router;
}
