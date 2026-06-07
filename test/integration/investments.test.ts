import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { parse } from 'lossless-json';
import { buildApp } from '../../src/app.js';
import { useTestDatabase } from './harness.js';

useTestDatabase();
const app = buildApp();

const ABSENT_UUID = '00000000-0000-0000-0000-000000000000';

async function createFund(): Promise<string> {
  const res = await request(app).post('/funds').send({
    name: 'Fund For Investments',
    vintage_year: 2024,
    target_size_usd: 100000000.0,
    status: 'Investing',
  });
  return res.body.id as string;
}

async function createInvestor(email = 'inv@example.com'): Promise<string> {
  const res = await request(app)
    .post('/investors')
    .send({ name: 'An Investor', investor_type: 'Institution', email });
  return res.body.id as string;
}

function losslessBody(res: request.Response): Record<string, unknown> {
  return parse(res.text) as Record<string, unknown>;
}

describe('Investments API', () => {
  let fundId: string;
  let investorId: string;

  beforeEach(async () => {
    fundId = await createFund();
    investorId = await createInvestor();
  });

  it('POST creates an investment (201) linking the right ids', async () => {
    const res = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 75000000.0, investment_date: '2024-09-22' });
    expect(res.status).toBe(201);
    expect(res.body.fund_id).toBe(fundId);
    expect(res.body.investor_id).toBe(investorId);
    expect(res.body.investment_date).toBe('2024-09-22');
    expect(losslessBody(res).amount_usd?.toString()).toBe('75000000.00');
  });

  it('POST to a non-existent fund → 404', async () => {
    const res = await request(app)
      .post(`/funds/${ABSENT_UUID}/investments`)
      .send({ investor_id: investorId, amount_usd: 1000.0, investment_date: '2024-01-01' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST with a non-existent investor_id → 422', async () => {
    const res = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: ABSENT_UUID, amount_usd: 1000.0, investment_date: '2024-01-01' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE');
  });

  it('POST with a future investment_date → 400', async () => {
    const res = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 1000.0, investment_date: '2999-01-01' });
    expect(res.status).toBe(400);
  });

  it('POST with amount_usd having 3 decimals → 400', async () => {
    const res = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 100.005, investment_date: '2024-01-01' });
    expect(res.status).toBe(400);
  });

  it('GET investments for a fund returns the rows', async () => {
    await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 1000.0, investment_date: '2024-01-01' });
    await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 2000.0, investment_date: '2024-02-01' });
    const res = await request(app).get(`/funds/${fundId}/investments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET investments for a non-existent fund → 404 (not an empty array)', async () => {
    const res = await request(app).get(`/funds/${ABSENT_UUID}/investments`);
    expect(res.status).toBe(404);
  });

  it('allows the same investor to commit to the same fund twice (top-ups)', async () => {
    const first = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 1000.0, investment_date: '2024-01-01' });
    const second = await request(app)
      .post(`/funds/${fundId}/investments`)
      .send({ investor_id: investorId, amount_usd: 5000.0, investment_date: '2024-06-01' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  describe('money precision (the headline design decision)', () => {
    it('round-trips an awkward 0.10 + 0.20 = 0.30 value exactly', async () => {
      const create = await request(app)
        .post(`/funds/${fundId}/investments`)
        .send({ investor_id: investorId, amount_usd: 0.3, investment_date: '2024-01-01' });
      expect(losslessBody(create).amount_usd?.toString()).toBe('0.30');

      const list = await request(app).get(`/funds/${fundId}/investments`);
      const rows = parse(list.text) as Array<Record<string, unknown>>;
      expect(rows[0]!.amount_usd?.toString()).toBe('0.30');
    });

    it('round-trips 75000000.01 exactly (no float drift)', async () => {
      // Sent as a raw JSON number literal so we exercise the real wire path.
      const create = await request(app)
        .post(`/funds/${fundId}/investments`)
        .set('Content-Type', 'application/json')
        .send(
          '{"investor_id":"' +
            investorId +
            '","amount_usd":75000000.01,"investment_date":"2024-01-01"}',
        );
      expect(create.status).toBe(201);
      expect(losslessBody(create).amount_usd?.toString()).toBe('75000000.01');
    });

    it('round-trips a very large 18-integer-digit value exactly', async () => {
      const big = '999999999999999999.99';
      const create = await request(app)
        .post(`/funds/${fundId}/investments`)
        .set('Content-Type', 'application/json')
        .send(
          '{"investor_id":"' +
            investorId +
            '","amount_usd":' +
            big +
            ',"investment_date":"2024-01-01"}',
        );
      expect(create.status).toBe(201);
      expect(losslessBody(create).amount_usd?.toString()).toBe(big);

      const list = await request(app).get(`/funds/${fundId}/investments`);
      const rows = parse(list.text) as Array<Record<string, unknown>>;
      expect(rows[0]!.amount_usd?.toString()).toBe(big);
    });
  });
});
