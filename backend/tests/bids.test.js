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

describe('Bids Reporting API — Sprint 21', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispToken  = () => makeToken({ ...SEED.DISPATCHER });

  // GET /bids/my
  describe('GET /bids/my', () => {
    test('returns merged auction bids + WD bookings', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [
          { channel: 'GTCP', bid_id: 1, ref: 'BID-1', product_type: 'MONTHLY', point: 'KIREVO-ENTRY',
            volume_kwh_h: 500000, price_eur: 0.66, fee_eur: 330000, status: 'SUBMITTED',
            shipper_code: 'SHP-001', created_at: '2026-04-19' },
        ] })
        .mockResolvedValueOnce({ rows: [
          { channel: 'WD', bid_id: 10, ref: 'WD-10', product_type: 'WITHIN_DAY', point: 'KIREVO-ENTRY',
            volume_kwh_h: 100000, price_eur: null, fee_eur: null, status: 'ACTIVE',
            shipper_code: 'SHP-001', created_at: '2026-04-19' },
        ] });

      const res = await request(app)
        .get(`${API}/bids/my`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map(b => b.channel)).toEqual(expect.arrayContaining(['GTCP', 'WD']));
    });

    test('filters by channel', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ channel: 'GTCP', bid_id: 1, ref: 'BID-1' }] })
        .mockResolvedValueOnce({ rows: [{ channel: 'WD', bid_id: 10, ref: 'WD-10' }] });

      const res = await request(app)
        .get(`${API}/bids/my?channel=GTCP`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.every(b => b.channel === 'GTCP')).toBe(true);
    });

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/bids/my`);
      expect(res.status).toBe(401);
    });
  });

  // GET /bids/report
  describe('GET /bids/report', () => {
    test('returns KPI summary + breakdown', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{
          total_bids: 5, draft: 1, submitted: 2, won: 1, lost: 1, contracted: 0,
          won_volume_kwh_h: '500000', won_fee_eur: '330000.00',
        }] })
        .mockResolvedValueOnce({ rows: [{ wd_count: 3, wd_total_kwh_h: '300000' }] })
        .mockResolvedValueOnce({ rows: [
          { product_type: 'MONTHLY', bid_count: 3, total_volume: '800000', avg_price: '0.6600', won_count: 1, win_rate_pct: '33.3' },
          { product_type: 'QUARTERLY', bid_count: 2, total_volume: '1000000', avg_price: '1.8500', won_count: 0, win_rate_pct: '0.0' },
        ] });

      const res = await request(app)
        .get(`${API}/bids/report`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.total_bids).toBe(5);
      expect(res.body.summary.wd_count).toBe(3);
      expect(res.body.breakdown).toHaveLength(2);
    });
  });

  // GET /bids/export
  describe('GET /bids/export', () => {
    test('returns CSV by default', async () => {
      db.query.mockResolvedValueOnce({ rows: [
        { ref: 'BID-1', product_type: 'MONTHLY', point: 'KIREVO-ENTRY', volume_kwh_h: 500000,
          price_eur: 0.66, fee_eur: 330000, status: 'WON', shipper_code: 'SHP-001' },
      ] });

      const res = await request(app)
        .get(`${API}/bids/export`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    test('returns XLSX when format=xlsx', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`${API}/bids/export?format=xlsx`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .responseType('blob');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/bids/export`);
      expect(res.status).toBe(401);
    });
  });
});
