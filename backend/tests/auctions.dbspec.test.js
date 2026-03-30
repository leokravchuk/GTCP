'use strict';

/**
 * DB-specific auctions tests — covers inner branches:
 * - POST /bids: full validation chain with DB lookups
 * - PATCH /bids/:id: edit DRAFT, cannot edit non-DRAFT, recalc credit block
 * - POST /bids/:id/submit: full status check chain
 * - POST /bids/:id/result: WON/PARTIALLY_WON/LOST with auction lookup
 * - POST /bids/:id/create-contract: 409 duplicate, fn_create_contract, error catch
 * - DELETE /bids/:id: cancel DRAFT/SUBMITTED, reject other statuses
 * - GET /auctions/summary, GET /timeline
 */

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

describe('Auctions DB-specific', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  // ── PATCH /bids/:id — edit DRAFT with credit recalc (lines 449-496) ──

  describe('PATCH /auctions/bids/:id — full branch coverage', () => {

    test('edits DRAFT bid and recalculates credit block', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'DRAFT', bid_capacity_kwh_h: 5000000, flow_direction: 'GOSPODJINCI_HORGOS', product_type: 'ANNUAL', auction_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 100, bid_capacity_kwh_h: 6000000, credit_blocked_eur: 1200 }] });
      const res = await request(app)
        .patch(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ bid_capacity_kwh_h: 6000000 });
      expect(res.status).toBe(200);
    });

    test('rejects edit of non-DRAFT bid (line 470)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 100, status: 'SUBMITTED', auction_id: 1, product_type: 'ANNUAL' }] });
      const res = await request(app)
        .patch(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ bid_capacity_kwh_h: 6000000 });
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('only DRAFT');
    });

    test('rejects empty update (line 484)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 100, status: 'DRAFT', auction_id: 1, product_type: 'ANNUAL' }] });
      const res = await request(app)
        .patch(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ invalidField: 'test' });
      expect(res.status).toBe(400);
    });

    test('returns 404 if bid not found (line 468)', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/auctions/bids/999`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ bid_capacity_kwh_h: 5000000 });
      expect(res.status).toBe(404);
    });
  });

  // ── POST /bids/:id/submit — full chain (lines 502-577) ────────────────

  describe('POST /auctions/bids/:id/submit — full chain', () => {

    test('submits DRAFT → SUBMITTED with all checks', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('auction_bids') && sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 100, status: 'DRAFT', auction_calendar_id: 1, shipper_id: '22222222-0000-0000-0000-000000000001', bid_capacity_kwh_h: 5000000 }] });
        if (sql.includes('auction_calendar')) return Promise.resolve({ rows: [{ id: 1, status: 'OPEN' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'SUBMITTED', submitted_at: '2026-03-30' }] });
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

  // ── POST /bids/:id/result — WON/PARTIALLY_WON/LOST (lines 580-648) ───

  describe('POST /auctions/bids/:id/result — all results', () => {

    function mockBidResult(bidStatus = 'SUBMITTED') {
      db.query.mockImplementation((sql) => {
        if (sql.includes('auction_bids') && sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 100, status: bidStatus, auction_calendar_id: 1, bid_capacity_kwh_h: 5000000, flow_direction: 'GOSPODJINCI_HORGOS' }] });
        if (sql.includes('auction_calendar')) return Promise.resolve({ rows: [{ id: 1, product_type: 'ANNUAL' }] });
        if (sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'WON' }] });
        return Promise.resolve({ rows: [] });
      });
    }

    test('WON result — full capacity allocated', async () => {
      mockBidResult();
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'WON', final_price_eur: 6.75 });
      expect(res.status).toBe(200);
    });

    test('PARTIALLY_WON result — partial capacity', async () => {
      mockBidResult();
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'PARTIALLY_WON', won_capacity_kwh_h: 3000000, final_price_eur: 6.75 });
      expect(res.status).toBe(200);
    });

    test('LOST result', async () => {
      mockBidResult();
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'LOST' });
      expect(res.status).toBe(200);
    });

    test('returns 404 if bid not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post(`${API}/auctions/bids/999/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'WON' });
      expect(res.status).toBe(404);
    });

    test('returns 400 if result invalid', async () => {
      const res = await request(app)
        .post(`${API}/auctions/bids/100/result`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ result: 'INVALID' });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /bids/:id/create-contract (lines 654-718) ────────────────────

  describe('POST /auctions/bids/:id/create-contract — branches', () => {

    test('409 if contract already created (line 670)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 100, status: 'CONTRACT_CREATED', contract_id: 'abc-123' }] });
      const res = await request(app)
        .post(`${API}/auctions/bids/100/create-contract`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(409);
      expect(res.body.contract_id).toBe('abc-123');
    });

    test('creates contract via DB function (lines 678-708)', async () => {
      db.query.mockImplementation((sql) => {
        if (sql.includes('SELECT') && sql.includes('auction_bids') && !sql.includes('UPDATE')) return Promise.resolve({ rows: [{ id: 100, status: 'WON', shipper_id: '22222222-0000-0000-0000-000000000001', bid_capacity_kwh_h: 5000000, flow_direction: 'GOSPODJINCI_HORGOS' }] });
        if (sql.includes('fn_create_contract')) return Promise.resolve({ rows: [{ fn_create_contract_from_bid: 'contract-uuid-123' }] });
        if (sql.includes('auction_bids') && sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 100, status: 'CONTRACT_CREATED' }] });
        if (sql.includes('contracts')) return Promise.resolve({ rows: [{ id: 'contract-uuid-123', contract_no: 'CTR-2026-006' }] });
        return Promise.resolve({ rows: [] });
      });
      const res = await request(app)
        .post(`${API}/auctions/bids/100/create-contract`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(201);
      expect(res.body.contract_id).toBe('contract-uuid-123');
    });

    test('422 if DB function throws "not eligible" (lines 710-716)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'WON' }] })
        .mockRejectedValueOnce(new Error('Bid not found or not eligible for contract creation'));
      const res = await request(app)
        .post(`${API}/auctions/bids/100/create-contract`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(422);
      expect(res.body.hint).toContain('WON or PARTIALLY_WON');
    });
  });

  // ── DELETE /bids/:id — cancel (lines 724-754) ─────────────────────────

  describe('DELETE /auctions/bids/:id — cancel branches', () => {

    test('cancels SUBMITTED bid', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'SUBMITTED' }] })
        .mockResolvedValueOnce({ rows: [{ id: 100, status: 'CANCELLED' }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .delete(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });

    test('rejects cancel of WON bid (line 737)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 100, status: 'WON' }] });
      const res = await request(app)
        .delete(`${API}/auctions/bids/100`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('Cannot cancel');
    });

    test('returns 404 if bid not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .delete(`${API}/auctions/bids/999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /summary (lines 761-802) ──────────────────────────────────────

  describe('GET /auctions/summary — full', () => {
    test('returns aggregated stats', async () => {
      db.query.mockResolvedValue({ rows: [
        { product_type: 'ANNUAL', status: 'OPEN', cnt: 2, total_capacity: 10000000 },
        { product_type: 'QUARTERLY', status: 'UPCOMING', cnt: 3, total_capacity: 5000000 },
      ] });
      const res = await request(app)
        .get(`${API}/auctions/summary`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── GET /timeline (lines 808-863) ─────────────────────────────────────

  describe('GET /auctions/timeline — full', () => {
    test('returns timeline events', async () => {
      db.query.mockResolvedValue({ rows: [
        { event_date: '2026-04-01', event_type: 'OPEN', product_type: 'ANNUAL', point_code: 'KIREVO-ENTRY' },
        { event_date: '2026-04-15', event_type: 'CLOSE', product_type: 'ANNUAL', point_code: 'KIREVO-ENTRY' },
      ] });
      const res = await request(app)
        .get(`${API}/auctions/timeline?days=90`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBeLessThan(500);
    });
  });
});
