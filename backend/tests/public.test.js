'use strict';

/**
 * Transparency Portal tests — NC Art.24
 * Sprint 19 · US-1902
 */

require('./setup');

const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

describe('Transparency Portal — NC Art.24 (public, no JWT)', () => {
  beforeEach(() => { db.query.mockReset(); });

  // ── GET /public/capacity ─────────────────────────────────────────────

  test('returns capacity data without JWT', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { point: 'KIREVO-ENTRY', direction: 'ENTRY', total_contracted_kwh_h: '13752439', bookings_count: 2 },
      { point: 'HORGOS-EXIT',  direction: 'EXIT',  total_contracted_kwh_h: '9216209',  bookings_count: 1 },
    ] });

    const res = await request(app).get(`${API}/public/capacity`);
    expect(res.status).toBe(200);
    expect(res.body.ncRef).toContain('Art.24');
    expect(res.body.capacities).toHaveLength(3); // 3 IPs
    expect(res.body.capacities[0].technical_kwh_h).toBe(15280488);
    expect(res.body.capacities[0].utilization_pct).toBeGreaterThan(0);
  });

  // ── GET /public/auctions ─────────────────────────────────────────────

  test('returns auction calendar without JWT', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { id: 1, product_type: 'ANNUAL', status: 'OPEN', auction_start_date: '2026-07-07' },
      ] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(`${API}/public/auctions`);
    expect(res.status).toBe(200);
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.recent).toHaveLength(0);
    // No shipper info in response (anonymized)
    expect(JSON.stringify(res.body)).not.toContain('shipper_id');
  });

  // ── GET /public/gas-quality ──────────────────────────────────────────

  test('returns gas quality without JWT', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { point_code: 'KIREVO-ENTRY', gas_day: '2026-04-17', gcv_kwh_nm3: 11.52, wobbe_kwh_nm3: 14.08 },
      { point_code: 'HORGOS-EXIT',  gas_day: '2026-04-17', gcv_kwh_nm3: 11.50, wobbe_kwh_nm3: 14.05 },
    ] });

    const res = await request(app).get(`${API}/public/gas-quality`);
    expect(res.status).toBe(200);
    expect(res.body.ncRef).toContain('Art.17');
    expect(res.body.measurements).toHaveLength(2);
  });

  // ── GET /public/fuel-gas-price ───────────────────────────────────────

  test('returns fuel gas price without JWT', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ value: '28.50' }] });

    const res = await request(app).get(`${API}/public/fuel-gas-price`);
    expect(res.status).toBe(200);
    expect(res.body.fuel_gas_price_eur_mwh).toBe(28.5);
    expect(res.body.ncRef).toContain('Art.18.5.1.4');
  });

  test('returns null price when not configured', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(`${API}/public/fuel-gas-price`);
    expect(res.status).toBe(200);
    expect(res.body.fuel_gas_price_eur_mwh).toBeNull();
  });

  // ── No shipper data leaked ───────────────────────────────────────────

  test('capacity endpoint does not leak shipper data', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(`${API}/public/capacity`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('shipper_id');
    expect(body).not.toContain('shipper_name');
    expect(body).not.toContain('Газпром');
  });
});
