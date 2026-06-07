import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../src/app.js';
import { useTestDatabase } from './harness.js';

useTestDatabase();
const app = buildApp();

const validInvestor = {
  name: 'Goldman Sachs Asset Management',
  investor_type: 'Institution',
  email: 'investments@gsam.com',
};

describe('Investors API', () => {
  it('POST /investors creates an investor (201)', async () => {
    const res = await request(app).post('/investors').send(validInvestor);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.email).toBe('investments@gsam.com');
    expect(res.body.investor_type).toBe('Institution');
    expect(res.body.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('POST /investors duplicate email → 409 (case-insensitive)', async () => {
    await request(app).post('/investors').send(validInvestor);
    const res = await request(app)
      .post('/investors')
      .send({ ...validInvestor, email: 'INVESTMENTS@GSAM.COM' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /investors bad investor_type → 400', async () => {
    const res = await request(app)
      .post('/investors')
      .send({ ...validInvestor, investor_type: 'Robot' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /investors invalid email → 400', async () => {
    const res = await request(app)
      .post('/investors')
      .send({ ...validInvestor, email: 'nope' });
    expect(res.status).toBe(400);
  });

  it('GET /investors returns an array', async () => {
    await request(app).post('/investors').send(validInvestor);
    await request(app)
      .post('/investors')
      .send({ name: 'Jane Doe', investor_type: 'Individual', email: 'jane@example.com' });
    const res = await request(app).get('/investors');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
