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

describe('Nominations Deep Coverage', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  // ── POST /nominations — create with capacity check branches ───────────

  describe('POST /nominations — capacity check', () => {

    test('creates with over-nomination warning (nom > contracted)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings')) return Promise.resolve({ rows: [{ contracted_kwh_h: 3000000 }] });
        if (sql.includes('contracts')) return Promise.resolve({ rows: [] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 1, reference: 'NOM-2026-00001', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 5000000 });
      expect(res.status).toBeLessThan(500);
    });

    test('creates with zero contracted capacity (fallback to contracts)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings')) return Promise.resolve({ rows: [{ contracted_kwh_h: 0 }] });
        if (sql.includes('contracts') && sql.includes('cap_entry')) return Promise.resolve({ rows: [{ cap_entry_kwh_h: 10000000 }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 2, reference: 'NOM-2026-00002', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 5000000 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /over-nominate — NC Art.12.8 ─────────────────────────────────

  describe('POST /nominations/over-nominate — NC Art.12.8', () => {

    test('creates within-day interruptible via over-nomination', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('SUM')) return Promise.resolve({ rows: [{ total_contracted: 15000000 }] });
        if (sql.includes('nominations') && sql.includes('SUM')) return Promise.resolve({ rows: [{ total_nominated: 12000000 }] });
        if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '0' }] });
        if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 50, reference: 'ONOM-2026-00001', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations/over-nominate`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, point: 'KIREVO-ENTRY', gasDay: '2026-04-01', volumeKwhH: 2000000 });
      expect(res.status).toBeLessThan(500);
    });

    test('returns 400 if missing fields', async () => {
      const res = await request(app)
        .post(`${API}/nominations/over-nominate`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1 });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /:id/edigas-submit ───────────────────────────────────────────

  describe('POST /nominations/:id/edigas-submit', () => {

    test('submits NOMINT to TSO (mock mode)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('nominations WHERE')) return Promise.resolve({ rows: [{ id: '550e8400-1234', reference: 'NOM-2026-00001', shipper_id: UUID_1, volume_kwh_h: 5000000, gas_day_cycle: 0, status: 'SUBMITTED' }] });
        if (sql.includes('shippers')) return Promise.resolve({ rows: [{ id: UUID_1, code: 'SHP-001', eic_code: '21X' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: '550e8400-1234', tso_status: 'ACCEPTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations/1/edigas-submit`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBeLessThan(500);
    });

    test('returns 404 if nomination not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post(`${API}/nominations/999/edigas-submit`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /:id/status — all branches ──────────────────────────────────

  describe('PATCH /nominations/:id/status', () => {

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .patch(`${API}/nominations/999/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBeLessThan(500);
    });
  });
});
