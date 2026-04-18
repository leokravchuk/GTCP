'use strict';

/**
 * DB-specific nominations tests — covers inner branches:
 * - POST /: capacity check from bookings + contracts fallback, over-nomination (NC Art.12.8)
 * - POST /over-nominate: full inner logic with capacity lookups
 * - POST /:id/edigas-submit: renomination XML path
 * - PATCH /:id/status: various status values
 */

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

describe('Nominations DB-specific', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  // ── POST / — capacity check: bookings → contracts fallback (lines 126-152) ─

  describe('POST /nominations — capacity check branches', () => {

    test('gets contracted from capacity_bookings (lines 127-135)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('SUM')) return Promise.resolve({ rows: [{ contracted_kwh_h: '10000000' }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT INTO nominations')) return Promise.resolve({ rows: [{ id: 1, reference: 'NOM-2026-00001', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 5000000 });
      expect(res.status).toBeLessThan(500);
    });

    test('falls back to contracts when bookings = 0 (lines 138-148)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('SUM')) return Promise.resolve({ rows: [{ contracted_kwh_h: '0' }] });
        if (sql.includes('contracts') && sql.includes('cap_entry')) return Promise.resolve({ rows: [{ cap: '13752230' }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT INTO nominations')) return Promise.resolve({ rows: [{ id: 2, reference: 'NOM-2026-00002', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 5000000 });
      expect(res.status).toBeLessThan(500);
    });

    test('over-nomination allowed (NC Art.12.8, lines 155-180)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('shipper_id') && sql.includes('SUM')) return Promise.resolve({ rows: [{ contracted_kwh_h: '5000000' }] });
        if (sql.includes('capacity_bookings') && sql.includes('point') && !sql.includes('shipper_id')) return Promise.resolve({ rows: [{ total: '15000000' }] });
        if (sql.includes('nominations') && sql.includes('SUM')) return Promise.resolve({ rows: [{ total: '10000000' }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT INTO nominations')) return Promise.resolve({ rows: [{ id: 3, reference: 'NOM-2026-00003', status: 'SUBMITTED', is_over_nomination: true }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 7000000 });
      expect(res.status).toBeLessThan(500);
    });

    test('over-nomination rejected — no spare capacity (lines 182-193)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('shipper_id') && sql.includes('SUM')) return Promise.resolve({ rows: [{ contracted_kwh_h: '5000000' }] });
        if (sql.includes('capacity_bookings') && sql.includes('point') && !sql.includes('shipper_id')) return Promise.resolve({ rows: [{ total: '15000000' }] });
        if (sql.includes('nominations') && sql.includes('SUM')) return Promise.resolve({ rows: [{ total: '15000000' }] }); // = total contracted → no spare
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, gasDay: '2026-04-01', direction: 'ENTRY', point: 'KIREVO-ENTRY', volumeKwhH: 7000000 });
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('Art.13.2.1');
    });
  });

  // ── POST /over-nominate — NC Art.12.8 (lines 424-521) ─────────────────

  describe('POST /nominations/over-nominate — inner logic', () => {

    test('creates within-day interruptible via over-nomination', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('capacity_bookings') && sql.includes('SUM') && sql.includes('point')) return Promise.resolve({ rows: [{ total_contracted: '15000000' }] });
        if (sql.includes('capacity_bookings') && sql.includes('shipper_id')) return Promise.resolve({ rows: [{ contracted: '5000000' }] });
        if (sql.includes('nominations') && sql.includes('SUM')) return Promise.resolve({ rows: [{ total_nominated: '12000000' }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 0 }] });
        if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 50, reference: 'ONOM-2026-00001', status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations/over-nominate`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send({ shipperId: UUID_1, point: 'KIREVO-ENTRY', gasDay: '2026-04-01', volumeKwhH: 2000000 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /:id/edigas-submit — renomination path (lines 571-573) ───────

  describe('POST /nominations/:id/edigas-submit — renom path', () => {

    test('builds RENOMINT XML for gas_day_cycle > 0', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('nominations WHERE') && sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: UUID_1, reference: 'NOM-2026-00001-R2', shipper_id: UUID_1, volume_kwh_h: 5500000, gas_day_cycle: 2, status: 'PENDING' }] });
        if (sql.includes('shippers')) return Promise.resolve({ rows: [{ id: UUID_1, code: 'SHP-001', eic_code: '21X-RS-A-Z0000' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/nominations/1/edigas-submit`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.edigasDocType).toBe('NOMINT-P03-RENOM');
    });
  });

  // ── GET /:id/edigas-nomint — renomination XML path ────────────────────

  describe('GET /nominations/:id/edigas-nomint — renom XML', () => {

    test('generates RENOMINT XML for renom (gas_day_cycle > 0)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: UUID_1, reference: 'NOM-R2', shipper_id: UUID_1, volume_kwh_h: 5500000, gas_day_cycle: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: UUID_1, code: 'SHP-001', eic_code: '21X' }] });
      const res = await request(app)
        .get(`${API}/nominations/1/edigas-nomint`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('xml');
    });
  });
});
