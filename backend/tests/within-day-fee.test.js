'use strict';

/**
 * Within-Day fee calculation + auction calendar edge cases
 * Sprint 20 · US-2004 — push to 600 tests
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

const UUID_SHP = '22222222-0000-0000-0000-000000000001';

describe('Within-Day Fee Calculation — NC Art.6.3.1.4', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('fee = capacity × price_per_hour × hours (KIREVO-ENTRY, 24h)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'wd-1', capacity_kwh_h: 100000 }] });
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, hours: 24, pricePerHour: 0.0021 });
    expect(res.status).toBe(201);
    expect(res.body.fee_calculation.total_fee_eur).toBe(5040); // 100000 × 0.0021 × 24
  });

  test('fee = capacity × price_per_hour × hours (HORGOS-EXIT, 6h)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'wd-2', capacity_kwh_h: 500000 }] });
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'HORGOS-EXIT', direction: 'EXIT', volumeKwhH: 500000, hours: 6, pricePerHour: 0.0023 });
    expect(res.status).toBe(201);
    expect(res.body.fee_calculation.total_fee_eur).toBe(6900); // 500000 × 0.0023 × 6
  });

  test('fee for 1 hour minimum', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'wd-3', capacity_kwh_h: 1000000 }] });
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'EXIT-SERBIA', direction: 'EXIT', volumeKwhH: 1000000, hours: 1, pricePerHour: 0.0014 });
    expect(res.status).toBe(201);
    expect(res.body.fee_calculation.total_fee_eur).toBe(1400); // 1M × 0.0014 × 1
  });

  test('rejects hours > 24', async () => {
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, hours: 25, pricePerHour: 0.0021 });
    expect(res.status).toBe(400);
  });

  test('rejects hours = 0', async () => {
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, hours: 0, pricePerHour: 0.0021 });
    expect(res.status).toBe(400);
  });

  test('rejects negative volume', async () => {
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: -100, hours: 6, pricePerHour: 0.0021 });
    expect(res.status).toBe(400);
  });
});

describe('Auction Calendar endpoints', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('GET /auctions returns paginated list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, product_type: 'MONTHLY', status: 'UPCOMING' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app)
      .get(`${API}/auctions`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].product_type).toBe('MONTHLY');
  });

  test('GET /auctions/calendar/grid returns product×month grid', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { product_type: 'MONTHLY', delivery_month: '2026-03', status: 'CLOSED', auction_count: 3 },
    ] });
    const res = await request(app)
      .get(`${API}/auctions/calendar/grid?gas_year=2025`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
  });

  test('GET /auctions/summary returns KPI data', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ upcoming_count: '30', open_count: '0', results_published: '0', next_auction_date: null }] })
      .mockResolvedValueOnce({ rows: [{ draft_count: '0', submitted_count: '0', won_count: '0', lost_count: '0', contract_created_count: '0', won_pending_contract: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`${API}/auctions/summary`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.auction_calendar.upcoming_count).toBe('30');
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get(`${API}/auctions`);
    expect(res.status).toBe(401);
  });
});

describe('Interruption penalty calculation — AERS 05-145', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('penalty = base_fee × 3 for KIREVO-ENTRY (0.0329)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, penalty_eur: 49350 }] });
    const res = await request(app)
      .post(`${API}/capacity/interrupt`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, gasDay: '2026-04-15', point: 'KIREVO-ENTRY', hoursInterrupted: 24, interruptedKwhH: 500000, reason: 'Planned maintenance' });
    expect(res.status).toBe(201);
    // base = 500000 × 0.0329 = 16450, penalty = 16450 × 3 = 49350
    expect(res.body.penalty_calculation.base_fee_eur).toBe(16450);
    expect(res.body.penalty_calculation.penalty_eur).toBe(49350);
  });

  test('penalty uses correct tariff for HORGOS-EXIT (0.0375)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, penalty_eur: 56250 }] });
    const res = await request(app)
      .post(`${API}/capacity/interrupt`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, gasDay: '2026-04-15', point: 'HORGOS-EXIT', hoursInterrupted: 24, interruptedKwhH: 500000, reason: 'Over-pressure' });
    expect(res.status).toBe(201);
    // base = 500000 × 0.0375 = 18750, penalty = 18750 × 3 = 56250
    expect(res.body.penalty_calculation.base_fee_eur).toBe(18750);
    expect(res.body.penalty_calculation.penalty_eur).toBe(56250);
  });

  test('GET /capacity/within-day/available returns all 3 IPs', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`${API}/capacity/within-day/available`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.capacities).toHaveLength(3);
    const names = res.body.capacities.map(c => c.point);
    expect(names).toContain('KIREVO-ENTRY');
    expect(names).toContain('HORGOS-EXIT');
    expect(names).toContain('EXIT-SERBIA');
  });

  test('penalty uses correct tariff for EXIT-SERBIA (0.0230)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, penalty_eur: 34500 }] });
    const res = await request(app)
      .post(`${API}/capacity/interrupt`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, gasDay: '2026-04-15', point: 'EXIT-SERBIA', hoursInterrupted: 12, interruptedKwhH: 500000, reason: 'Emergency' });
    expect(res.status).toBe(201);
    // base = 500000 × 0.0230 = 11500, penalty = 11500 × 3 = 34500
    expect(res.body.penalty_calculation.base_fee_eur).toBe(11500);
    expect(res.body.penalty_calculation.penalty_eur).toBe(34500);
  });
});
