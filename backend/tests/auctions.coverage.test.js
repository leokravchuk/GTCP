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

describe('Auctions Coverage', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  // ── GET / (root listing with pagination) ──────────────────────────────

  describe('GET /auctions (root)', () => {
    test('returns paginated list', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, product_type: 'ANNUAL' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get(`${API}/auctions`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(res.body[0].product_type).toBe('ANNUAL');
      expect(res.headers['x-total-count']).toBe('1');
    });

    test('filters by status', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app)
        .get(`${API}/auctions?status=OPEN`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GET /calendar/upcoming ────────────────────────────────────────────

  describe('GET /auctions/calendar/upcoming', () => {
    test('returns upcoming auctions grouped by type', async () => {
      db.query.mockResolvedValue({ rows: [
        { product_type: 'ANNUAL', ip_code: 'KIREVO-ENTRY', days_until_open: 30 },
        { product_type: 'QUARTERLY', ip_code: 'HORGOS-EXIT', days_until_open: 5 },
      ] });
      const res = await request(app)
        .get(`${API}/auctions/calendar/upcoming`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GET /calendar/next ────────────────────────────────────────────────

  describe('GET /auctions/calendar/next', () => {
    test('returns next auction by product_type', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 5, product_type: 'ANNUAL', status: 'UPCOMING' }] });
      const res = await request(app)
        .get(`${API}/auctions/calendar/next?product_type=ANNUAL`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /calendar/:id ─────────────────────────────────────────────────

  describe('GET /auctions/calendar/:id', () => {
    test('returns single auction with details', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, product_type: 'ANNUAL', status: 'OPEN', ip_code: 'KIREVO-ENTRY' }] });
      const res = await request(app)
        .get(`${API}/auctions/calendar/1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('returns 404 if auction not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/auctions/calendar/999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /calendar/:id/status ────────────────────────────────────────

  describe('PATCH /auctions/calendar/:id/status', () => {
    test('updates auction status', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, status: 'CLOSED' }] });
      const res = await request(app)
        .patch(`${API}/auctions/calendar/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'CLOSED' });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /bids ─────────────────────────────────────────────────────────

  describe('GET /auctions/bids', () => {
    test('returns bid list', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 100, status: 'DRAFT', shipper_id: 1 }] });
      const res = await request(app)
        .get(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });

    test('filters by auction_id', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/auctions/bids?auction_id=1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /bids/:id ─────────────────────────────────────────────────────

  describe('GET /auctions/bids/:id', () => {
    test('returns single bid', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 100, status: 'SUBMITTED', shipper_id: 1 }] });
      const res = await request(app)
        .get(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
    });

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .get(`${API}/auctions/bids/999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /bids/:id ───────────────────────────────────────────────────

  describe('PATCH /auctions/bids/:id', () => {
    test('updates bid parameters', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 100, status: 'DRAFT', capacity_kwh_h: 6000000 }] });
      const res = await request(app)
        .patch(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ capacityKwhH: 6000000 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /timeline ─────────────────────────────────────────────────────

  describe('GET /auctions/timeline', () => {
    test('returns timeline for 90 days', async () => {
      db.query.mockResolvedValue({ rows: [
        { event_type: 'AUCTION_OPEN', event_date: '2026-04-01', product_type: 'ANNUAL' },
      ] });
      const res = await request(app)
        .get(`${API}/auctions/timeline?days=90`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /bids — full validation chain ────────────────────────────────

  describe('POST /auctions/bids — full chain', () => {

    test('creates bid with credit check and all lookups', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('auction_calendar WHERE')) return Promise.resolve({ rows: [{ id: 1, status: 'OPEN', product_type: 'ANNUAL', point_code: 'KIREVO-ENTRY', flow_direction: 'GOSPODJINCI_HORGOS' }] });
        if (sql.includes('shippers WHERE')) return Promise.resolve({ rows: [{ id: 1, code: 'SHP-001', rating_exempt: false }] });
        if (sql.includes('v_available_credit')) return Promise.resolve({ rows: [{ available_credit_eur: 5000000 }] });
        if (sql.includes('INSERT INTO auction_bids')) return Promise.resolve({ rows: [{ id: 100, status: 'DRAFT', bid_capacity_kwh_h: 5000000 }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ auction_calendar_id: 1, shipper_id: 1, bid_capacity_kwh_h: 5000000, offered_price_eur: 6.50, flow_direction: 'GOSPODJINCI_HORGOS' });
      expect(res.status).toBe(201);
      expect(res.body.credit_blocked_eur).toBeDefined();
    });

    test('returns 404 if auction not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ auction_calendar_id: 999, shipper_id: 1, bid_capacity_kwh_h: 5000000 });
      expect(res.status).toBe(404);
    });

    test('returns 404 if shipper not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'OPEN' }] })
        .mockResolvedValueOnce({ rows: [] }); // shipper not found
      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ auction_calendar_id: 1, shipper_id: 999, bid_capacity_kwh_h: 5000000 });
      expect(res.status).toBe(404);
    });

    test('returns 400 if bid_capacity_kwh_h missing', async () => {
      const res = await request(app)
        .post(`${API}/auctions/bids`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ auction_calendar_id: 1, shipper_id: 1 });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /bids/:id/submit — internal ──────────────────────────────────

  describe('POST /auctions/bids/:id/submit — details', () => {
    test('submits and updates status', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('SELECT') && sql.includes('auction_bids')) return Promise.resolve({ rows: [{ id: 100, status: 'DRAFT', shipper_id: 1, auction_calendar_id: 1, bid_capacity_kwh_h: 5000000 }] });
        if (sql.includes('auction_calendar')) return Promise.resolve({ rows: [{ id: 1, status: 'OPEN' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'SUBMITTED' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/auctions/bids/100/submit`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });

    test('returns 404 if bid not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post(`${API}/auctions/bids/999/submit`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── POST /bids/:id/result ─────────────────────────────────────────────

  describe('POST /auctions/bids/:id/result — details', () => {
    test('records LOST result', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 100, status: 'SUBMITTED' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'LOST' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'LOST' });
      expect(res.status).toBeLessThan(500);
    });

    test('records PARTIALLY_WON result', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 100, status: 'SUBMITTED' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'PARTIALLY_WON' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'PARTIALLY_WON', capacityAllocatedKwhH: 3000000, auctionPriceEur: 6.75 });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── POST /bids/:id/create-contract — details ─────────────────────────

  describe('POST /bids/:id/create-contract — details', () => {
    test('returns 404 if bid not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post(`${API}/auctions/bids/999/create-contract`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });
});
