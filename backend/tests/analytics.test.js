'use strict';

/**
 * Analytics API tests (US-1705).
 * Sprint 17 · 15.04.2026
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
const billing    = () => makeToken({ ...SEED.BILLING_USER });
const dispatcher = () => makeToken({ ...SEED.DISPATCHER });

describe('GET /analytics/volumes', () => {
  beforeEach(() => db.query.mockReset());

  test('requires auth', async () => {
    const res = await request(app).get(`${API}/analytics/volumes`);
    expect(res.status).toBe(401);
  });

  test('returns aggregated volumes with NC reference', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { month: '2026-04', point: 'KIREVO-ENTRY',
          nominated_kwh: '240000000', matched_kwh: '240000000',
          allocated_kwh: '240000000', nominations_count: 30 },
      ],
    });

    const res = await request(app)
      .get(`${API}/analytics/volumes`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.ncRef).toMatch(/Art\.12/);
    expect(res.body.generated_at).toBeDefined();
  });

  test('applies from/to/point filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/volumes?from=2026-01-01&to=2026-04-30&point=HORGOS-EXIT`)
      .set('Authorization', `Bearer ${billing()}`);

    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual(expect.arrayContaining([
      '2026-01-01', '2026-04-30', 'HORGOS-EXIT',
    ]));
  });

  test('groups by month + point (verified in SQL)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/volumes`)
      .set('Authorization', `Bearer ${billing()}`);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/GROUP BY\s+1,\s*2/);
    expect(sql).toMatch(/TO_CHAR.*YYYY-MM/);
  });
});

describe('GET /analytics/revenue', () => {
  beforeEach(() => db.query.mockReset());

  test('returns revenue breakdown (capacity + fuel gas + total)', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { month: '2026-04', shipper_code: 'SHP-001', shipper_name: 'Gazprom',
          entry_fee_eur: '1500000.00', exit_fee_eur: '1800000.00',
          fuel_gas_eur: '950000.00', total_eur: '4250000.00', invoices_count: 1 },
      ],
    });

    const res = await request(app)
      .get(`${API}/analytics/revenue`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].total_eur).toBe('4250000.00');
    expect(res.body.ncRef).toMatch(/Art\.20/);
  });

  test('filters by shipper_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/revenue?shipper_id=abc`)
      .set('Authorization', `Bearer ${billing()}`);
    const [, params] = db.query.mock.calls[0];
    expect(params).toContain('abc');
  });

  test('revenue SQL aggregates across capacity + fuel_gas columns', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/revenue`)
      .set('Authorization', `Bearer ${billing()}`);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/SUM\(i\.cap_entry_fee_eur\)/);
    expect(sql).toMatch(/SUM\(i\.fuel_gas_amount_eur\)/);
    expect(sql).toMatch(/SUM\(i\.total_amount_eur\)/);
  });
});

describe('GET /analytics/utilization', () => {
  beforeEach(() => db.query.mockReset());

  test('returns utilization per IP with tech vs contracted', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { point_code: 'KIREVO-ENTRY', direction: 'ENTRY',
          tech_kwh_h: '15280488.00', lt_reserved_kwh_h: '13752439.00',
          contracted_kwh_h: '13752439.00', utilization_pct: '90.00' },
      ],
    });

    const res = await request(app)
      .get(`${API}/analytics/utilization`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.gas_year).toBe('2025/2026');
    expect(res.body.data[0].utilization_pct).toBe('90.00');
    expect(res.body.ncRef).toMatch(/Art\.7/);
  });

  test('supports custom gas_year query', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/utilization?gas_year=2024/2025`)
      .set('Authorization', `Bearer ${billing()}`);
    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual(['2024/2025']);
  });

  test('SQL joins interconnection_points with capacity_technical', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/analytics/utilization`)
      .set('Authorization', `Bearer ${billing()}`);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/interconnection_points/);
    expect(sql).toMatch(/capacity_technical/);
  });
});

describe('Analytics permissions', () => {
  test('dispatcher cannot access /analytics/revenue (billing:read required)', async () => {
    const res = await request(app)
      .get(`${API}/analytics/revenue`)
      .set('Authorization', `Bearer ${dispatcher()}`);
    expect(res.status).toBe(403);
  });
});
