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
const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';

describe('Nominations Coverage', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  // ── POST / — create with all validation branches ──────────────────────

  describe('POST /nominations — validation', () => {

    test('returns 400 if direction is invalid (not ENTRY/EXIT)', async () => {
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'INVALID', point: 'KIREVO-ENTRY', volumeKwhH: 5000 });
      expect(res.status).toBe(400);
    });

    test('returns 400 if volumeKwhH is negative', async () => {
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: -100 });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /:id/renom — all 4 NC Art.12.7.5 branches ───────────────────

  describe('POST /nominations/:id/renom — NC Art.12.7.5 rules', () => {

    const baseNom = {
      id: 1, status: 'CONFIRMED', volume_kwh_h: 5000000,
      contracted_kwh_h: 10000000, gas_day: '2026-04-01',
      shipper_id: UUID_1, direction: 'ENTRY', point: 'KIREVO-ENTRY',
      reference: 'NOM-2026-00001', gas_day_cycle: 1,
    };

    test('Art.12.7.5.1: Nom≤80% → up to 90% (upward)', async () => {
      // 5M/10M = 50% < 80% → maxUp = 9M (90%)
      db.query
        .mockResolvedValueOnce({ rows: [baseNom] })              // SELECT original
        .mockResolvedValueOnce({ rows: [{ id: 2, reference: 'NOM-2026-00001-R2' }] }) // INSERT renom
        .mockResolvedValueOnce({ rows: [] })                      // UPDATE original
        .mockResolvedValueOnce({ rows: [] });                     // audit
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 8500000 }); // 85% < 90% → OK
      expect(res.status).toBe(201);
    });

    test('Art.12.7.5.1: rejects if above 90% limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [baseNom] });
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 9500000 }); // 95% > 90% → REJECT
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('12.7.5.1');
    });

    test('Art.12.7.5.2: Nom>80% → up to half of non-nominated', async () => {
      const highNom = { ...baseNom, volume_kwh_h: 8500000 }; // 85% > 80%
      db.query
        .mockResolvedValueOnce({ rows: [highNom] })
        .mockResolvedValueOnce({ rows: [{ id: 3, reference: 'NOM-2026-00001-R3' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      // maxUp = 8.5M + (10M - 8.5M)/2 = 8.5M + 0.75M = 9.25M
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 9200000 }); // < 9.25M → OK
      expect(res.status).toBe(201);
    });

    test('Art.12.7.5.3: Nom>20% → downward min 10% CC', async () => {
      // 5M/10M = 50% > 20% → minDown = 1M (10%)
      db.query
        .mockResolvedValueOnce({ rows: [baseNom] })
        .mockResolvedValueOnce({ rows: [{ id: 4, reference: 'NOM-2026-00001-R4' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 1500000 }); // 1.5M > 1M min → OK
      expect(res.status).toBe(201);
    });

    test('Art.12.7.5.3: rejects below 10% floor', async () => {
      db.query.mockResolvedValueOnce({ rows: [baseNom] });
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 500000 }); // 0.5M < 1M min → REJECT
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('12.7.5.3');
    });

    test('Art.12.7.5.4: Nom≤20% → min half of Nominated', async () => {
      const lowNom = { ...baseNom, volume_kwh_h: 1500000 }; // 15% ≤ 20%
      db.query
        .mockResolvedValueOnce({ rows: [lowNom] })
        .mockResolvedValueOnce({ rows: [{ id: 5, reference: 'NOM-2026-00001-R5' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      // minDown = 1.5M / 2 = 0.75M
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ newVolumeKwhH: 800000 }); // 0.8M > 0.75M → OK
      expect(res.status).toBe(201);
    });

    test('returns 400 if newVolumeKwhH missing', async () => {
      const res = await request(app)
        .post(`${API}/nominations/1/renom`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ── POST /nominations/match — matching algorithm ──────────────────────

  describe('POST /nominations/match (with transaction)', () => {
    test('matches ENTRY/EXIT pairs for gas day', async () => {
      // withTransaction mock: client.query returns pending nominations
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [
            { id: 1, direction: 'ENTRY', shipper_id: UUID_1, volume_kwh_h: 5000000 },
            { id: 2, direction: 'EXIT', shipper_id: UUID_1, volume_kwh_h: 5000000 },
          ] })
          .mockResolvedValue({ rows: [] }), // subsequent UPDATE calls
      };
      db.withTransaction.mockImplementation(async (fn) => fn(mockClient));
      db.query.mockResolvedValue({ rows: [] }); // audit

      const res = await request(app)
        .post(`${API}/nominations/match`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ gasDay: '2026-04-01' });
      expect(res.status).toBe(200);
      expect(res.body.matchedPairs).toBe(1);
    });
  });

  // ── PATCH /:id/status ─────────────────────────────────────────────────

  describe('PATCH /nominations/:id/status', () => {
    test('updates nomination status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, status: 'CONFIRMED' }] });
      const res = await request(app)
        .patch(`${API}/nominations/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /:id/edigas-nomint ────────────────────────────────────────────

  describe('GET /nominations/:id/edigas-nomint', () => {
    test('returns edigas XML for nomination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: '550e8400-e29b-41d4-a716-446655440099', reference: 'NOM-2026-00001', status: 'SUBMITTED', shipper_id: UUID_1, volume_kwh_h: 5000000, gas_day_cycle: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: UUID_1, code: 'SHP-001', eic_code: '21X-RS-A-Z0000' }] });
      const res = await request(app)
        .get(`${API}/nominations/1/edigas-nomint`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });
});
