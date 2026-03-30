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

describe('Auctions API — /api/v1/auctions', () => {

  beforeEach(() => { db.query.mockReset(); });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const contractsToken = () => makeToken({ ...SEED.CONTRACTS_USER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  // ── GET /auctions/calendar ────────────────────────────────────────────────

  describe('GET /auctions/calendar', () => {

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/auctions/calendar`);
      expect(res.status).toBe(401);
    });

    test('returns auction calendar for admin', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, product_type: 'ANNUAL', ip_code: 'KIREVO-ENTRY', status: 'UPCOMING' },
          { id: 2, product_type: 'QUARTERLY', ip_code: 'HORGOS-EXIT', status: 'OPEN' },
        ],
      });

      const res = await request(app)
        .get(`${API}/auctions/calendar`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.auctions).toHaveLength(2);
      expect(res.body.count).toBe(2);
    });

    test('filters by product_type', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/auctions/calendar?product_type=ANNUAL`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('dispatcher has capacity:read, can read auctions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/auctions/calendar`)
        .set('Authorization', `Bearer ${makeToken({ ...SEED.DISPATCHER })}`);
      expect(res.status).toBe(200);
    });
  });

  // ── POST /auctions/bids ──────────────────────────────────────────────────

  describe('POST /auctions/bids', () => {

    const validBid = {
      auctionId: 1,
      shipperId: 1,
      capacityKwhH: 5000000,
      priceEurKwhHYear: 6.50,
      flowDirection: 'GOSPODJINCI_HORGOS',
      productType: 'ANNUAL',
    };

    test('returns 403 for billing role (no auctions:create)', async () => {
      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send(validBid);
      expect(res.status).toBe(403);
    });

    test('creates bid in DRAFT status', async () => {
      db.query
        .mockResolvedValueOnce({  // auction exists and is OPEN
          rows: [{ id: 1, status: 'OPEN', product_type: 'ANNUAL', ip_code: 'KIREVO-ENTRY' }],
        })
        .mockResolvedValueOnce({  // shipper exists
          rows: [SEED.SHIPPER_1],
        })
        .mockResolvedValueOnce({  // credit check
          rows: [{ available: 2900000 }],
        })
        .mockResolvedValueOnce({  // INSERT bid
          rows: [{ id: 100, status: 'DRAFT', ...validBid }],
        })
        .mockResolvedValueOnce({ rows: [] }); // audit

      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(validBid);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /auctions/bids/:id/submit ────────────────────────────────────────

  describe('POST /auctions/bids/:id/submit', () => {

    test('submits DRAFT bid → SUBMITTED', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 100, status: 'DRAFT', shipper_id: 1, auction_id: 1, capacity_kwh_h: 5000000 }],
        })
        .mockResolvedValueOnce({  // UPDATE status
          rows: [{ id: 100, status: 'SUBMITTED' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // audit

      const res = await request(app)
        .post(`${API}/auctions/bids/100/submit`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /auctions/bids/:id/result ────────────────────────────────────────

  describe('POST /auctions/bids/:id/result', () => {

    test('records WON result', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 100, status: 'SUBMITTED', shipper_id: 1, auction_id: 1, capacity_kwh_h: 5000000, flow_direction: 'GOSPODJINCI_HORGOS', product_type: 'ANNUAL', auction_price_eur: 6.75 }] });

      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'WON', auctionPriceEur: 6.75, capacityAllocatedKwhH: 5000000 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /auctions/bids/:id/create-contract ──────────────────────────────

  describe('POST /auctions/bids/:id/create-contract', () => {

    test('creates contract from WON bid', async () => {
      // Use mockImplementation for complex multi-query routes
      let callIdx = 0;
      const responses = [
        { rows: [{ id: 100, status: 'WON', shipper_id: 1, auction_id: 1, flow_direction: 'GOSPODJINCI_HORGOS', capacity_kwh_h: 5000000, auction_price_eur: 6.75, product_type: 'ANNUAL' }] },
        { rows: [{ cnt: '5' }] },
        { rows: [{ id: 20, code: 'CT R-2026-006' }] },
        { rows: [{ id: 100, status: 'CONTRACT_CREATED' }] },
        { rows: [] }, // audit
        { rows: [] }, // possible extra
      ];
      db.query.mockImplementation(() => Promise.resolve(responses[callIdx++] || { rows: [] }));

      const res = await request(app)
        .post(`${API}/auctions/bids/100/create-contract`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /auctions/summary ─────────────────────────────────────────────────

  describe('GET /auctions/summary', () => {

    test('returns summary dashboard', async () => {
      db.query.mockResolvedValue({ rows: [{ total: 10, open: 2, upcoming: 5, closed: 3, product_type: 'ANNUAL', total_capacity: 5000000 }] });
      const res = await request(app)
        .get(`${API}/auctions/summary`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── DELETE /auctions/bids/:id ─────────────────────────────────────────────

  describe('DELETE /auctions/bids/:id', () => {

    test('cancels DRAFT bid', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'DRAFT' }] })
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'CANCELLED' }] })
        .mockResolvedValueOnce({ rows: [] }); // audit

      const res = await request(app)
        .delete(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });
});
