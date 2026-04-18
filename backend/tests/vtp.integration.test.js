'use strict';

/**
 * VTP (Virtual Trading Point) integration tests — NC Art.11
 * Sprint 18 · US-1803
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

const UUID_SHP1 = '22222222-0000-0000-0000-000000000001'; // Газпром
const UUID_SHP2 = '22222222-0000-0000-0000-000000000002'; // NIS
const ADMIN_ID  = '11111111-0000-0000-0000-000000000001';

describe('VTP API — NC Art.11', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken   = () => makeToken({ ...SEED.ADMIN_USER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  // ── GET /vtp/trades ──────────────────────────────────────────────────────

  describe('GET /vtp/trades', () => {

    test('returns trade list with shipper info', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [
          { id: 1, trade_ref: 'VTP-2026-00001', shipper_id: UUID_SHP1, direction: 'SELL',
            volume_kwh_h: 500000, status: 'CONFIRMED', shipper_code: 'SHP-001', shipper_name: 'Газпром Экспорт' },
        ] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await request(app)
        .get(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].trade_ref).toBe('VTP-2026-00001');
      expect(res.headers['x-total-count']).toBe('1');
    });

    test('filters by gas_day and status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const res = await request(app)
        .get(`${API}/vtp/trades?gas_day=2026-04-01&status=CONFIRMED`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('gas_day');
      expect(sql).toContain('status');
    });

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/vtp/trades`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /vtp/trades ─────────────────────────────────────────────────────

  describe('POST /vtp/trades', () => {

    test('creates VTP trade for active shipper', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('shippers') && sql.includes('status')) return Promise.resolve({ rows: [{ id: UUID_SHP1, status: 'ACTIVE' }] });
        if (sql.includes('MAX')) return Promise.resolve({ rows: [{ max_seq: 6 }] });
        if (sql.includes('INSERT INTO vtp_trades')) return Promise.resolve({ rows: [{
          id: 7, trade_ref: 'VTP-2026-00007', shipper_id: UUID_SHP1, direction: 'BUY',
          volume_kwh_h: 300000, status: 'PENDING', trade_type: 'TITLE_TRANSFER',
        }] });
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({
          shipperId: UUID_SHP1,
          gasDay: '2027-06-01',
          volumeKwhH: 300000,
          direction: 'BUY',
          counterpartyId: UUID_SHP2,
          priceEurMwh: 29.50,
        });
      expect(res.status).toBe(201);
      expect(res.body.trade_ref).toBe('VTP-2026-00007');
      expect(res.body.direction).toBe('BUY');
    });

    test('rejects inactive shipper', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: UUID_SHP1, status: 'SUSPENDED' }] });

      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ shipperId: UUID_SHP1, gasDay: '2027-06-01', volumeKwhH: 100000, direction: 'BUY' });
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('Art.11');
    });

    test('rejects past gas day', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: UUID_SHP1, status: 'ACTIVE' }] });

      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ shipperId: UUID_SHP1, gasDay: '2020-01-01', volumeKwhH: 100000, direction: 'SELL' });
      expect(res.status).toBe(422);
    });

    test('rejects negative volume', async () => {
      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ shipperId: UUID_SHP1, gasDay: '2027-06-01', volumeKwhH: -100, direction: 'BUY' });
      expect(res.status).toBe(400);
    });

    test('rejects invalid direction', async () => {
      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ shipperId: UUID_SHP1, gasDay: '2027-06-01', volumeKwhH: 100000, direction: 'SWAP' });
      expect(res.status).toBe(400);
    });

    test('returns 404 for unknown shipper', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`${API}/vtp/trades`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ shipperId: '00000000-0000-0000-0000-000000000099', gasDay: '2027-06-01', volumeKwhH: 100000, direction: 'BUY' });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /vtp/trades/:id ──────────────────────────────────────────────────

  describe('GET /vtp/trades/:id', () => {

    test('returns trade detail', async () => {
      db.query.mockResolvedValueOnce({ rows: [{
        id: 1, trade_ref: 'VTP-2026-00001', shipper_code: 'SHP-001', direction: 'SELL',
      }] });
      const res = await request(app)
        .get(`${API}/vtp/trades/1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.trade_ref).toBe('VTP-2026-00001');
    });

    test('returns 404 for missing trade', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/vtp/trades/9999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /vtp/trades/:id/confirm ────────────────────────────────────────

  describe('PATCH /vtp/trades/:id/confirm', () => {

    test('confirms a pending trade', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 5, status: 'PENDING', trade_ref: 'VTP-2026-00005' }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, status: 'CONFIRMED', confirmed_at: new Date().toISOString() }] });
      const res = await request(app)
        .patch(`${API}/vtp/trades/5/confirm`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    test('rejects confirm on already confirmed trade', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'CONFIRMED' }] });
      const res = await request(app)
        .patch(`${API}/vtp/trades/1/confirm`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(422);
    });

    test('returns 404 for missing trade', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/vtp/trades/9999/confirm`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /vtp/balance ─────────────────────────────────────────────────────

  describe('GET /vtp/balance', () => {

    test('returns net VTP balance per shipper', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { shipper_id: UUID_SHP1, shipper_code: 'SHP-001', buy_kwh_h: '100000', sell_kwh_h: '500000', net_kwh_h: '-400000', trade_count: 3 },
        { shipper_id: UUID_SHP2, shipper_code: 'SHP-002', buy_kwh_h: '500000', sell_kwh_h: '0', net_kwh_h: '500000', trade_count: 1 },
      ] });
      const res = await request(app)
        .get(`${API}/vtp/balance`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.ncRef).toContain('Art.11');
      expect(res.body.balances).toHaveLength(2);
      expect(res.body.balances[0].net_kwh_h).toBe('-400000');
    });

    test('filters by gas_day', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/vtp/balance?gas_day=2026-04-01`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      const sql = db.query.mock.calls[0][0];
      expect(sql).toContain('gas_day');
    });
  });
});
