import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { parse } from 'lossless-json';
import { buildApp } from '../../src/app.js';
import { useTestDatabase } from './harness.js';

useTestDatabase();
const app = buildApp();

const validFund = {
  name: 'Titanbay Growth Fund I',
  vintage_year: 2024,
  target_size_usd: 250000000.0,
  status: 'Fundraising',
};

/** supertest parses JSON with JSON.parse (float); for exact money assertions we
 *  re-parse the raw text with lossless-json. */
function losslessBody(res: request.Response): Record<string, unknown> {
  return parse(res.text) as Record<string, unknown>;
}

describe('Funds API', () => {
  it('POST /funds creates a fund (201) with id and Z timestamp', async () => {
    const res = await request(app).post('/funds').send(validFund);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.name).toBe(validFund.name);
    expect(res.body.vintage_year).toBe(2024);
    expect(res.body.status).toBe('Fundraising');
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(losslessBody(res).target_size_usd?.toString()).toBe('250000000.00');
  });

  it('POST /funds missing name → 400 VALIDATION_ERROR', async () => {
    const { name: _omit, ...noName } = validFund;
    const res = await request(app).post('/funds').send(noName);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /funds bad status enum → 400', async () => {
    const res = await request(app).post('/funds').send({ ...validFund, status: 'Open' });
    expect(res.status).toBe(400);
  });

  it('POST /funds negative target_size_usd → 400', async () => {
    const res = await request(app).post('/funds').send({ ...validFund, target_size_usd: -1 });
    expect(res.status).toBe(400);
  });

  it('POST /funds with id/created_at in body → ignored, server generates them', async () => {
    const res = await request(app)
      .post('/funds')
      .send({ ...validFund, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', created_at: '1999-01-01T00:00:00Z' });
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(res.body.created_at).not.toContain('1999');
  });

  it('GET /funds returns an array including the created fund', async () => {
    await request(app).post('/funds').send(validFund);
    const res = await request(app).get('/funds');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('GET /funds/:id existing → 200; absent uuid → 404; malformed uuid → 400', async () => {
    const created = await request(app).post('/funds').send(validFund);
    const id = created.body.id as string;

    const ok = await request(app).get(`/funds/${id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(id);

    const absent = await request(app).get('/funds/00000000-0000-0000-0000-000000000000');
    expect(absent.status).toBe(404);
    expect(absent.body.error.code).toBe('NOT_FOUND');

    const malformed = await request(app).get('/funds/not-a-uuid');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PUT /funds updates fields and preserves created_at', async () => {
    const created = await request(app).post('/funds').send(validFund);
    const id = created.body.id as string;
    const originalCreatedAt = created.body.created_at as string;

    const res = await request(app)
      .put('/funds')
      .send({ id, name: 'Renamed Fund', vintage_year: 2024, target_size_usd: 300000000.0, status: 'Investing' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Fund');
    expect(res.body.status).toBe('Investing');
    expect(losslessBody(res).target_size_usd?.toString()).toBe('300000000.00');
    expect(res.body.created_at).toBe(originalCreatedAt);
  });

  it('PUT /funds with created_at in body does not overwrite it', async () => {
    const created = await request(app).post('/funds').send(validFund);
    const id = created.body.id as string;
    const originalCreatedAt = created.body.created_at as string;
    const res = await request(app)
      .put('/funds')
      .send({ id, ...validFund, created_at: '1990-01-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(res.body.created_at).toBe(originalCreatedAt);
  });

  it('PUT /funds non-existent id → 404', async () => {
    const res = await request(app)
      .put('/funds')
      .send({ id: '00000000-0000-0000-0000-000000000000', ...validFund });
    expect(res.status).toBe(404);
  });

  it('malformed JSON → 400, not 500', async () => {
    const res = await request(app)
      .post('/funds')
      .set('Content-Type', 'application/json')
      .send('{ "name": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('non-JSON content type on write → 415', async () => {
    const res = await request(app)
      .post('/funds')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(res.status).toBe(415);
  });
});
