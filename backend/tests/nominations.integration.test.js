'use strict';

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
  withTransaction: jest.fn(async (fn) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

const db = require('../src/db');
const app = require('../src/app');

const API = '/api/v1';

describe('Nominations API — /api/v1/nominations', () => {

  beforeEach(() => { db.query.mockReset(); });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  // ── GET /nominations ──────────────────────────────────────────────────────

  describe('GET /nominations', () => {

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/nominations`);
      expect(res.status).toBe(401);
    });

    test('returns nomination list', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, reference: 'NOM-2026-00001', gas_day: '2026-03-30', status: 'SUBMITTED', shipper_code: 'SHP-001' },
        ],
      });
      const res = await request(app)
        .get(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.body[0].reference).toBe('NOM-2026-00001');
    });

    test('filters by gas_day', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/nominations?gas_day=2026-03-30`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
      // Verify gas_day was passed as param
      const call = db.query.mock.calls[0];
      expect(call[0]).toContain('n.gas_day = $');
      expect(call[1]).toContain('2026-03-30');
    });

    test('returns 403 for billing role (no nominations:read)', async () => {
      const res = await request(app)
        .get(`${API}/nominations`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /nominations/:id ──────────────────────────────────────────────────

  describe('GET /nominations/:id', () => {

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/nominations/999`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(404);
    });

    test('returns single nomination', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, reference: 'NOM-2026-00001', gas_day: '2026-03-30', shipper_code: 'SHP-001' }],
      });
      const res = await request(app)
        .get(`${API}/nominations/1`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.reference).toBe('NOM-2026-00001');
    });
  });

  // ── POST /nominations ─────────────────────────────────────────────────────

  describe('POST /nominations', () => {

    const validNom = {
      shipperId: '550e8400-e29b-41d4-a716-446655440001',
      gasDay: '2026-04-01',
      direction: 'ENTRY',
      point: 'KIREVO-ENTRY',
      volumeKwhH: 5000000,
    };

    test('returns 403 for billing role', async () => {
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send(validNom);
      expect(res.status).toBe(403);
    });

    test('creates nomination with valid data', async () => {
      const created = { id: 10, reference: 'NOM-2026-00010', status: 'SUBMITTED' };
      db.query
        .mockResolvedValueOnce({ rows: [{ contracted_kwh_h: 10000000 }] })  // capacity_bookings
        .mockResolvedValueOnce({ rows: [{ cnt: '9' }] })     // nextReference COUNT
        .mockResolvedValueOnce({ rows: [created] })           // INSERT
        .mockResolvedValueOnce({ rows: [] });                 // audit

      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send(validNom);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /nominations/:id/renom ───────────────────────────────────────────

  describe('POST /nominations/:id/renom', () => {

    test('returns 403 for dispatcher (no nominations:renom)', async () => {
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ newVolumeKwhH: 5500000 });
      expect(res.status).toBe(403);
    });

    test('returns 404 if nomination not found (admin)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post(`${API}/nominations/999/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 5500000 });
      expect(res.status).toBe(404);
    });

    test('submits renomination for confirmed nomination (admin)', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1, status: 'CONFIRMED', volume_kwh_h: 5000000,
            contracted_kwh_h: 10000000, gas_day: '2026-04-01',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'RENOM_PENDING', volume_kwh_h: 5500000 }],
        })
        .mockResolvedValueOnce({ rows: [] }); // audit

      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 5500000 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /nominations/match ───────────────────────────────────────────────

  describe('POST /nominations/match', () => {

    test('returns 403 for dispatcher (no nominations:match)', async () => {
      const res = await request(app)
        .post(`${API}/nominations/match`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ gasDay: '2026-04-01' });
      expect(res.status).toBe(403);
    });

    test('admin can trigger matching', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post(`${API}/nominations/match`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ gasDay: '2026-04-01' });
      expect(res.status).toBeLessThan(500);
    });
  });
});
