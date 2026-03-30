'use strict';

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

describe('Stub Routes Coverage', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const creditToken = () => makeToken({ ...SEED.CREDIT_USER });

  // ── Credits (/api/v1/credits) ─────────────────────────────────────────

  describe('Credits — NC Art.5', () => {
    test('GET /credits — list all', async () => {
      db.query.mockResolvedValue({ rows: [
        { id: 1, code: 'SHP-001', credit_limit: 5000000, current_exposure: 2100000, available_credit: 2900000 },
      ] });
      const res = await request(app)
        .get(`${API}/credits`)
        .set('Authorization', `Bearer ${creditToken()}`);
      expect(res.status).toBe(200);
      expect(res.body[0].available_credit).toBe(2900000);
    });

    test('GET /credits/:shipperId', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, code: 'SHP-001', credit_limit: 5000000 }] });
      const res = await request(app)
        .get(`${API}/credits/1`)
        .set('Authorization', `Bearer ${creditToken()}`);
      expect(res.status).toBe(200);
    });

    test('GET /credits/:shipperId — 404', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/credits/999`)
        .set('Authorization', `Bearer ${creditToken()}`);
      expect(res.status).toBe(404);
    });

    test('PATCH /credits/:shipperId — update credit limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, credit_limit: 5000000 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, credit_limit: 6000000 }] })
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .patch(`${API}/credits/1`)
        .set('Authorization', `Bearer ${creditToken()}`)
        .send({ creditLimit: 6000000 });
      expect(res.status).toBe(200);
    });

    test('returns 403 for billing role', async () => {
      const res = await request(app)
        .get(`${API}/credits`)
        .set('Authorization', `Bearer ${makeToken({ ...SEED.BILLING_USER })}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Capacity (/api/v1/capacity) ───────────────────────────────────────

  describe('Capacity', () => {
    test('GET /capacity — list bookings', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, point: 'KIREVO-ENTRY', capacity_kwh_h: 13752230 }] });
      const res = await request(app)
        .get(`${API}/capacity`)
        .set('Authorization', `Bearer ${makeToken({ ...SEED.DISPATCHER })}`);
      expect(res.status).toBe(200);
    });

    test('GET /capacity — filter by point', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/capacity?point=KIREVO-ENTRY`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('POST /capacity — create booking', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, point: 'KIREVO-ENTRY' }] })
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .post(`${API}/capacity`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          shipperId: 1, contractId: 1, point: 'KIREVO-ENTRY',
          capacityKwhH: 5000000, startDate: '2026-10-01', endDate: '2027-09-30',
        });
      expect(res.status).toBe(201);
    });
  });

  // ── Balance (/api/v1/balance) ─────────────────────────────────────────

  describe('Balance — NC Art.15', () => {
    test('GET /balance — list imbalance charges', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/balance`)
        .set('Authorization', `Bearer ${makeToken({ ...SEED.BILLING_USER })}`);
      expect(res.status).toBe(200);
    });

    test('GET /balance — filter by gas_day', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/balance?gas_day=2026-03-30&shipper_id=1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ── Audit (/api/v1/audit) ─────────────────────────────────────────────

  describe('Audit', () => {
    test('GET /audit — admin can read', async () => {
      db.query.mockResolvedValue({ rows: [
        { id: 1, action_type: 'LOGIN', entity_type: 'user', username: 'admin' },
      ] });
      const res = await request(app)
        .get(`${API}/audit`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('GET /audit — filter by entity_type', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/audit?entity_type=invoice&action_type=CREATE`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('returns 403 for billing role', async () => {
      const res = await request(app)
        .get(`${API}/audit`)
        .set('Authorization', `Bearer ${makeToken({ ...SEED.BILLING_USER })}`);
      expect(res.status).toBe(403);
    });
  });

  // ── System Params (/api/v1/system-params) ─────────────────────────────

  describe('System Params', () => {
    test('GET /system-params', async () => {
      db.query.mockResolvedValue({ rows: [
        { key: 'euribor_6m_pct', value: '2.64' },
        { key: 'fuel_gas_price_eur_mwh', value: '32.50' },
      ] });
      const res = await request(app)
        .get(`${API}/system-params`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('PATCH /system-params/:key', async () => {
      db.query.mockResolvedValue({ rows: [{ key: 'euribor_6m_pct', value: '3.00' }] });
      const res = await request(app)
        .patch(`${API}/system-params/euribor_6m_pct`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ value: '3.00' });
      expect(res.status).toBe(200);
    });

    test('PATCH /system-params/:key — 404 if key not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .patch(`${API}/system-params/nonexistent`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ value: '1' });
      expect(res.status).toBe(404);
    });
  });

  // ── Reserve Prices (/api/v1/reserve-prices) ───────────────────────────

  describe('Reserve Prices', () => {
    test('GET /reserve-prices', async () => {
      db.query.mockResolvedValue({ rows: [
        { point: 'KIREVO-ENTRY', product_type: 'ANNUAL', price_eur: 6.00 },
      ] });
      const res = await request(app)
        .get(`${API}/reserve-prices`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── Health ─────────────────────────────────────────────────────────────

  describe('Health check', () => {
    test('GET /health', async () => {
      const res = await request(app).get(`${API}/health`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
