'use strict';

/**
 * OBA Settlement (NC Art.15) integration tests.
 * Sprint 17 · US-1701 (DEBT-01) · 15.04.2026
 *
 * Covers GET /balance/oba/daily|monthly/:month|summary with:
 *  - auth guards
 *  - query filters (point_code, adjacent_tso, gas_day range)
 *  - 12-month rolling window
 *  - empty result / invalid month format
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
const billing = () => makeToken({ ...SEED.BILLING_USER });

const SAMPLE_DAILY_ROW = {
  id: 1,
  gas_day: '2026-04-10',
  point_code: 'KIREVO-ENTRY',
  adjacent_tso: 'Bulgartransgaz',
  direction: 'ENTRY',
  nominated_kwh: '8000000',
  allocated_kwh: '8000000',
  measured_kwh:  '8008000',
  metering_diff_kwh:   '5600',
  linepack_diff_kwh:   '1600',
  gcv_correction_kwh:   '800',
  total_imbalance_kwh: '8000',
  oba_status: 'RECONCILED',
  notes: null,
};

describe('OBA Settlement — /balance/oba/* (NC Art.15)', () => {

  beforeEach(() => db.query.mockReset());

  // ── Auth ──────────────────────────────────────────────────────────────

  test('GET /balance/oba/daily requires authentication', async () => {
    const res = await request(app).get(`${API}/balance/oba/daily`);
    expect(res.status).toBe(401);
  });

  test('GET /balance/oba/summary requires authentication', async () => {
    const res = await request(app).get(`${API}/balance/oba/summary`);
    expect(res.status).toBe(401);
  });

  // ── /oba/daily ────────────────────────────────────────────────────────

  test('GET /balance/oba/daily returns list with NC reference metadata', async () => {
    db.query.mockResolvedValueOnce({ rows: [SAMPLE_DAILY_ROW] });

    const res = await request(app)
      .get(`${API}/balance/oba/daily`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.ncRef).toMatch(/Art\.15/);
    expect(res.body.note).toMatch(/Art\.12\.3/);
  });

  test('GET /balance/oba/daily applies 12-month rolling window in SQL', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get(`${API}/balance/oba/daily`)
      .set('Authorization', `Bearer ${billing()}`);

    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/12 months/);
  });

  test('GET /balance/oba/daily filters by point_code (query param → SQL param)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get(`${API}/balance/oba/daily?point_code=HORGOS-EXIT`)
      .set('Authorization', `Bearer ${billing()}`);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/point_code\s*=\s*\$/);
    expect(params).toContain('HORGOS-EXIT');
  });

  test('GET /balance/oba/daily filters by adjacent_tso', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get(`${API}/balance/oba/daily?adjacent_tso=FGSZ`)
      .set('Authorization', `Bearer ${billing()}`);

    const [, params] = db.query.mock.calls[0];
    expect(params).toContain('FGSZ');
  });

  test('GET /balance/oba/daily with gas_day_from/to passes both into SQL', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get(`${API}/balance/oba/daily?gas_day_from=2026-01-01&gas_day_to=2026-03-31`)
      .set('Authorization', `Bearer ${billing()}`);

    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual(expect.arrayContaining(['2026-01-01', '2026-03-31']));
  });

  // ── /oba/monthly/:month ───────────────────────────────────────────────

  test('GET /balance/oba/monthly/:month aggregates per point/TSO', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { point_code: 'KIREVO-ENTRY', adjacent_tso: 'Bulgartransgaz', direction: 'ENTRY',
          days: 30, total_nominated: '240000000', total_measured: '240240000',
          total_imbalance: '240000', avg_imbalance_pct: '0.1000' },
      ],
    });

    const res = await request(app)
      .get(`${API}/balance/oba/monthly/2026-04`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-04');
    expect(res.body.data[0].days).toBe(30);
    expect(res.body.ncRef).toMatch(/Art\.15.*monthly/);
  });

  test('GET /balance/oba/monthly/:month with non-existent month returns empty data', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/balance/oba/monthly/2099-01`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  // ── /oba/summary ──────────────────────────────────────────────────────

  test('GET /balance/oba/summary returns 12-month KPI aggregates', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { point_code: 'KIREVO-ENTRY', adjacent_tso: 'Bulgartransgaz',
          days_count: 365, total_nominated_kwh: '2900000000',
          total_imbalance_kwh: '2900000', avg_imbalance_pct: '0.1000',
          period_from: '2025-04-15', period_to: '2026-04-10' },
      ],
    });

    const res = await request(app)
      .get(`${API}/balance/oba/summary`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.ncRef).toMatch(/12-month/);
    expect(res.body.generated_at).toBeDefined();
  });

  test('GET /balance/oba/summary SQL also enforces 12-month window', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/balance/oba/summary`)
      .set('Authorization', `Bearer ${billing()}`);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/12 months/);
  });
});
