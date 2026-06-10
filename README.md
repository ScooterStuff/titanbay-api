# Titanbay API — Funds, Investors & Investments

![CI](https://github.com/ScooterStuff/titanbay-api/actions/workflows/ci.yml/badge.svg)

A small RESTful API for a private-markets investment platform. It manages **funds**, **investors**, and the **investments** that connect them, exposing the **8 endpoints** required by the brief. Built with TypeScript, Express, Zod and `pg` over Postgres 16, with a strict layered architecture and money handled as exact decimals — never as a floating-point number.

## Quick start

### With Docker (one command)

```bash
docker compose up --build
```

This starts Postgres 16 and the API. Migrations run automatically on boot, so the schema is ready immediately. The API listens on `http://localhost:3000`.

To populate demo data (3 funds, 4 investors, 6 investments):

```bash
docker compose run --rm seed
```

A couple of `curl` examples:

```bash
# Create a fund
curl -s -X POST http://localhost:3000/funds \
  -H 'Content-Type: application/json' \
  -d '{"name":"Titanbay Growth Fund II","vintage_year":2025,"target_size_usd":500000000.00,"status":"Fundraising"}'

# List all funds
curl -s http://localhost:3000/funds

# Create an investor
curl -s -X POST http://localhost:3000/investors \
  -H 'Content-Type: application/json' \
  -d '{"name":"CalPERS","investor_type":"Institution","email":"privateequity@calpers.ca.gov"}'
```

### Without Docker

Requires Node 20+ and a running Postgres 16.

```bash
npm ci
cp .env.example .env            # then set DATABASE_URL
npm run migrate                 # create the schema
npm run seed                    # optional demo data
npm run dev                     # start with hot reload (or: npm run build && npm start)
```

## Try the API

Two ready-made ways to exercise every endpoint (and the error paths) once the stack is up:

**Postman.** Import [`postman/Titanbay-API.postman_collection.json`](./postman/Titanbay-API.postman_collection.json), then either click through the requests top-to-bottom or use the Collection Runner. IDs are saved to collection variables between requests, so you never copy-paste UUIDs. Run from the CLI with Newman:

```bash
npx newman run postman/Titanbay-API.postman_collection.json
```

**PowerShell smoke script.** A single command that hits all 8 endpoints plus the 400/404/409/415/422 error paths, with green/red assertions:

```powershell
./scripts/smoke.ps1
```

## API reference

Base path `/`, content type `application/json`. Request and response bodies follow the brief; the table below is the canonical list of supported routes.

| Method | Path                           | Description                              | Success |
| ------ | ------------------------------ | ---------------------------------------- | ------- |
| GET    | `/funds`                       | List all funds                           | 200     |
| POST   | `/funds`                       | Create a fund                            | 201     |
| PUT    | `/funds`                       | Update a fund (**id in body**, per spec) | 200     |
| GET    | `/funds/{id}`                  | Get one fund                             | 200     |
| GET    | `/investors`                   | List all investors                       | 200     |
| POST   | `/investors`                   | Create an investor                       | 201     |
| GET    | `/funds/{fund_id}/investments` | List a fund's investments                | 200     |
| POST   | `/funds/{fund_id}/investments` | Create an investment                     | 201     |

There is also an unauthenticated `GET /health` for container/load-balancer checks (not one of the 8).

All errors share one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "…",
    "details": [{ "field": "vintage_year", "issue": "must be between 1900 and 2026" }]
  }
}
```

Status codes: `400` (bad JSON / failed schema / malformed UUID), `404` (missing path resource), `409` (duplicate investor email), `415` (non-JSON write), `422` (body references a non-existent entity), `500` (unexpected — generic message, full detail logged server-side).

## Architecture

The codebase is organised in strict layers with a one-way dependency direction: **routes → service → repository → db**. Routes only parse input, call a service, and serialize the response — they contain no SQL. Repositories only run parameterised SQL and return plain row objects — they know nothing about HTTP. Services hold the business rules (existence checks, error mapping, serialization).

```
src/
  app.ts            # builds the Express app (no listen) — imported by tests
  server.ts         # config + migrate + listen
  config.ts         # env parsed/validated with Zod (fail fast on missing DATABASE_URL)
  db/               # pg Pool (+ type parsers), migration runner, 0001_init.sql
  modules/
    funds/          # funds.{schema,repository,service,routes}.ts
    investors/      # …same shape
    investments/    # …same shape
  shared/           # errors, central error handler, serializers, validators,
                    # lossless JSON body parser, request logger, uuid helper
scripts/seed.ts     # idempotent demo data
test/unit/          # schemas, serializers, service logic (repos mocked)
test/integration/   # Supertest against a real Postgres (Testcontainers)
```

**Why Express + `pg` + Zod.** Express is mature, minimal and familiar to reviewers; at this scale its small performance disadvantage versus Fastify is irrelevant (Fastify's built-in schema validation would be the main reason to switch). `pg` with hand-written SQL keeps the data layer transparent and demonstrates the schema directly. Zod is the single source of truth for request shapes, and TypeScript types are inferred from the schemas so validation and types can never drift.

## Design decisions & trade-offs

**Money is `NUMERIC(20,2)`, never a float — the headline decision.** A JS `number` is an IEEE-754 double and cannot represent values like `0.1 + 0.2` exactly; in a platform that moves capital, silent rounding is unacceptable. Two things would normally leak a float in anyway: Express's `express.json()` runs the body through `JSON.parse` (every number becomes a double _before_ my code runs), and `res.json()` does the same on the way out. So I parse and serialize request/response bodies with **`lossless-json`**, which keeps every JSON number as a string-backed value. Money therefore travels client → Zod → Postgres `NUMERIC(20,2)` → client as an exact decimal string and is only ever emitted as a JSON number token, with no float in the path. `pg` is configured to return `NUMERIC` as a string, validation uses `decimal.js`, and amounts with more than two decimals are **rejected**, not rounded. The round-trip is proven by tests that store `0.30`, `75000000.01`, and an 18-digit value and read them back byte-for-byte.

**`PUT /funds` takes the id in the body.** This is what the spec dictates, so that is what is implemented. In a real design review I would push back: `PUT /funds/{id}` is more RESTful, makes the addressed resource explicit in the URL, and avoids ambiguity when the body and a URL disagree. The deviation is called out here precisely because it was deliberate, not an oversight.

**404 vs empty array, and 404 vs 422.** Listing investments for a fund that does not exist returns **404**, not `[]` — an empty array would mask a real client bug (a bad fund id) as a legitimately empty fund. For creation I distinguish the _path_ resource from a _body_ reference: a missing `fund_id` (in the URL) is **404** because the addressed resource does not exist, while a missing `investor_id` (in the body) is **422** because the request is well-formed but references something that is not there. The rule is applied consistently.

**Investor email is unique → 409; investments are not unique per (fund, investor).** A duplicate investor email is almost always a data-entry mistake, so `email` is a case-insensitive (`citext`) unique column and a duplicate `POST /investors` returns **409 Conflict**. The constraint lives in the database, so it holds even under concurrent inserts; the app maps the violation rather than crashing. By contrast, `(fund_id, investor_id)` is deliberately **not** unique: in private markets an investor routinely commits to the same fund more than once (top-ups), so enforcing uniqueness there would be wrong. Both calls are documented because a reviewer might reasonably expect the opposite default.

**Raw SQL over an ORM.** Hand-written parameterised SQL keeps the data access honest and the schema visible, and avoids a heavy dependency for three tables. The cost is more boilerplate and no compile-time guarantee that a query matches the row type I annotate — acceptable here, and mitigated by the integration tests that run every query against a real database.

**Native enums vs CHECK constraints.** `fund_status` and `investor_type` are native Postgres `ENUM` types: self-documenting and impossible to violate even from a buggy client. The trade-off is that adding a value later needs `ALTER TYPE` rather than editing a `CHECK`. For a stable, small domain that is a good deal; if these were expected to churn, a `CHECK` on `text` would be more flexible.

**Timestamps.** `created_at` is generated by the database (`DEFAULT now()`), not the app, so it is authoritative and consistent, and is serialized as UTC with a trailing `Z` (no milliseconds) to match the spec exactly. `investment_date` is a `DATE` and is returned as `YYYY-MM-DD`.

**Scope: 8 endpoints, not 13.** The published spec lists 13 endpoints, but the brief asks for 8. The transaction/admin block (`/transactions`, `/transactions/process`, `/transactions/{id}/reverse`, `/funds/{id}/total-value`, `/admin/recalculate-fees`) is **intentionally out of scope for this stage** — building it now would be scope creep against an explicit instruction. It is also where the original spec hides patterns I would challenge in design review: a `bypass_validation` flag, retroactive fee rewrites, and money represented inconsistently as string-vs-float. Those are exactly the things a financial backend should not ship, and I would raise them before implementing that block safely.

## Testing

```bash
npm test            # unit + integration
npm run test:unit   # fast, no database
npm run test:int    # integration only
```

Unit tests cover the Zod schemas (every accept/reject case from the validation spec), the serializers (money with no float drift, `Z` timestamps, date-only formatting), and service logic with the repositories mocked (e.g. a `null` from the repo becomes a 404). Integration tests run the real app via Supertest against a **real Postgres 16** and assert status code, response shape, and that data actually persisted — covering the full contract for all three resources plus cross-cutting cases (malformed JSON → 400, unknown field on a strict write → 400) and the money-precision round-trip.

Integration tests get their database one of two ways: if `TEST_DATABASE_URL` is set they use it directly; otherwise they start a throwaway Postgres 16 container via **Testcontainers** (what CI does). Tables are truncated between tests for isolation.

## Assumptions

- No authentication/authorization is required (not in scope); every endpoint is public.
- Investor email is unique and case-insensitive (a judgement call, not in the spec).
- An investor may invest in the same fund multiple times (top-ups allowed).
- `investment_date` may not be in the future; money must be positive with at most two decimal places.
- Writes must use `Content-Type: application/json` (otherwise **415**), and unknown fields on a write body are rejected (Zod `.strict()`) so typos surface — except `id`/`created_at`, which are stripped and ignored rather than trusted.
- Full arrays are returned (no pagination), matching the spec.

## How I used AI

I used Claude (via an agentic coding workflow) as a pair-programmer and sounding board, and reviewed and owned every line. Concretely: it helped scaffold the layered project structure, generate boilerplate (repository CRUD, Zod schemas, the test matrix) and draft this README. The judgement calls were mine and were made deliberately: representing money as `NUMERIC` and proving it with `lossless-json` end-to-end (rather than accepting the float that `express.json()`/`res.json()` would introduce); the scope decision to build 8 endpoints and flag the dangerous patterns in the other 5; and the status-code semantics (404 vs 422 vs 409). I verified everything against a running Postgres — the integration suite was the arbiter, and I corrected the AI's output where it was wrong (for example, making the repository resolve its pool lazily so tests can inject a database, and fixing money so awkward values round-trip exactly). The aim was effective collaboration with a human in the loop, not unreviewed generation.

## Future considerations

Authentication/authorization and per-tenant scoping; pagination and filtering on the list endpoints; the transaction/admin endpoints implemented _safely_ (no validation-bypass, append-only fee history rather than retroactive rewrites, consistent money typing); richer observability (metrics, tracing) on top of the existing structured request logs; and a generated OpenAPI document derived from the Zod schemas.
