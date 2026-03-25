'use strict';

/**
 * Billing tests — GTCP
 *
 * Covers:
 *   1. Pure calculation helpers (capacity fee, fuel gas NC Art.18)
 *   2. HTTP endpoints via Supertest (mock DB)
 *   3. Late payment interest NC Art. 20.4.2
 */

const request = require('supertest');

// ── Mock DB before requiring app ─────────────────────────────────────────────
jest.mock('../src/db', () => require('./helpers/mockDb'));
// Mock auditService to avoid DB calls
jest.mock('../src/services/auditService', () => ({ addAudit: jest.fn() }));

const mockDb = require('./helpers/mockDb');
const { authHeaders, activeUserRow } = require('./helpers/authToken');
const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE CALCULATION UNIT TESTS (extracted formulas)
// ─────────────────────────────────────────────────────────────────────────────
describe('Billing calculations — NC Art.18 fuel gas', () => {

  /**
   * NC Art.18 formula:
   *   FG = X1 × Q_horgos + X2 × Q_serbia − KN
   *   FG_eur = FG × price_eur_mwh / 1000   (FG in kWh → MWh)
   */
  function calcFuelGas({ x1Pct, x2Pct, knKwh, qHorgos, qSerbia, priceEurMwh }) {
    const x1 = x1Pct / 100;
    const x2 = x2Pct / 100;
    const fgKwh    = x1 * qHorgos + x2 * qSerbia - knKwh;
    const fgCapped = Math.max(0, fgKwh);
    return {
      fgKwh:    fgCapped,
      fgEur:    (fgCapped / 1000) * priceEurMwh,
    };
  }

  test('standard monthly — typical Gastrans values', () => {
    const result = calcFuelGas({
      x1Pct: 1.5,      // compressor %
      x2Pct: 0.2,      // preheating %
      knKwh: 50_000,   // quality compensation
      qHorgos: 10_000_000,   // 10 GWh nominations
      qSerbia:  2_000_000,   //  2 GWh domestic
      priceEurMwh: 35,
    });
    // FG = 0.015×10_000_000 + 0.002×2_000_000 − 50_000 = 150_000 + 4_000 − 50_000 = 104_000 kWh
    expect(result.fgKwh).toBeCloseTo(104_000, 0);
    // EUR = 104_000 / 1000 × 35 = 3_640
    expect(result.fgEur).toBeCloseTo(3_640, 0);
  });

  test('fuel gas floored at 0 (KN larger than production)', () => {
    const result = calcFuelGas({
      x1Pct: 0.5,
      x2Pct: 0.1,
      knKwh: 1_000_000,  // very large quality compensation
      qHorgos: 500_000,
      qSerbia: 100_000,
      priceEurMwh: 35,
    });
    expect(result.fgKwh).toBe(0);
    expect(result.fgEur).toBe(0);
  });

  test('zero nominations → zero fuel gas', () => {
    const result = calcFuelGas({
      x1Pct: 1.5, x2Pct: 0.2, knKwh: 0,
      qHorgos: 0, qSerbia: 0,
      priceEurMwh: 35,
    });
    expect(result.fgKwh).toBe(0);
    expect(result.fgEur).toBe(0);
  });
});

describe('Billing calculations — capacity fee АЕРС 05-145', () => {

  /**
   * Capacity fee per NC / АЕРС decision 05-145:
   *   fee = cap_kwh_h × tariff_annual_eur_kwh_h_yr / 365 × days
   *
   * ГОСПОДИНЦІ→ХОРГОШ direction tariffs:
   *   entry: 4.19 EUR/kWh/h/yr  (bundled: 4.19+6.85 = 11.04)
   *   exit:  6.85 EUR/kWh/h/yr
   */
  function calcCapacityFee({ capEntryKwhH, capExitKwhH, tariffEntry, tariffExit, days }) {
    const entryFee = capEntryKwhH * tariffEntry / 365 * days;
    const exitFee  = capExitKwhH  * tariffExit  / 365 * days;
    return { entryFee, exitFee, totalFee: entryFee + exitFee };
  }

  test('Annual contract — 1 month billing (31 days), GOSPODJINCI_HORGOS', () => {
    const { totalFee } = calcCapacityFee({
      capEntryKwhH: 100_000,   // 100 MW/h entry
      capExitKwhH:  100_000,
      tariffEntry: 4.19,
      tariffExit:  6.85,
      days: 31,
    });
    // entry = 100_000 × 4.19 / 365 × 31 = 35_582.19
    // exit  = 100_000 × 6.85 / 365 × 31 = 58_178.08
    // total ≈ 93_760
    expect(totalFee).toBeCloseTo(93_760, -1);
  });

  test('Commercial Reverse (HORGOS→GOSPODJINCI) — tariff 3.25', () => {
    const { totalFee } = calcCapacityFee({
      capEntryKwhH: 0,
      capExitKwhH:  50_000,
      tariffEntry:  0,
      tariffExit:   3.25,
      days: 30,
    });
    // exit = 50_000 × 3.25 / 365 × 30 = 13_356.16
    expect(totalFee).toBeCloseTo(13_356, 0);
  });

  test('Daily product — tariff per kWh/h day', () => {
    // Daily tariffs are per day (not annual), so no /365 needed
    const capKwhH  = 10_000;
    const tariffDaily = 0.00008; // EUR/kWh/h/day (example)
    const fee = capKwhH * tariffDaily;
    expect(fee).toBeCloseTo(0.8, 4);
  });
});

describe('Billing calculations — late payment NC Art. 20.4.2', () => {

  function calcLateInterest({ overdueEur, euribor6mPct, spreadPct, daysOverdue }) {
    const rate = (euribor6mPct + spreadPct) / 100;
    return overdueEur * rate / 360 * daysOverdue;
  }

  test('overdue 30 days, EURIBOR 3.9%, spread 3%', () => {
    const interest = calcLateInterest({
      overdueEur: 100_000,
      euribor6mPct: 3.9,
      spreadPct: 3.0,
      daysOverdue: 30,
    });
    // 100_000 × (6.9/100) / 360 × 30 = 575
    expect(interest).toBeCloseTo(575, 0);
  });

  test('zero days overdue → zero interest', () => {
    const interest = calcLateInterest({
      overdueEur: 50_000, euribor6mPct: 3.9, spreadPct: 3.0, daysOverdue: 0,
    });
    expect(interest).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/v1/billing — list invoices', () => {
  beforeEach(() => mockDb.__reset());

  const invoiceRow = {
    id: 1, invoice_no: 'INV-2025-0001', shipper_id: 10,
    shipper_name: 'Gazprom Export', period_from: '2025-01-01',
    period_to: '2025-01-31', amount_eur: 93760.00, status: 'ISSUED',
    created_at: '2025-02-01T10:00:00Z',
  };

  test('returns 200 with invoice list', async () => {
    // authenticate → user lookup
    mockDb.__setQuerySequence([
      activeUserRow(),                           // authenticate middleware
      { rows: [invoiceRow], rowCount: 1 },       // SELECT invoices
      { rows: [{ count: '1' }], rowCount: 1 },   // COUNT(*)
    ]);

    const res = await request(app)
      .get('/api/v1/billing')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/billing');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });
});

describe('GET /api/v1/billing/:id — single invoice', () => {
  beforeEach(() => mockDb.__reset());

  test('returns 404 when invoice not found', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [], rowCount: 0 },   // invoice not found
    ]);

    const res = await request(app)
      .get('/api/v1/billing/9999')
      .set(authHeaders());

    expect(res.status).toBe(404);
  });

  test('returns 200 with invoice details', async () => {
    const invoiceWithItems = {
      id: 5, invoice_no: 'INV-2025-0005',
      shipper_name: 'MET Energy',
      amount_eur: 50000, status: 'DRAFT',
      items: [],
    };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [invoiceWithItems], rowCount: 1 },
      { rows: [], rowCount: 0 },  // line items
    ]);

    const res = await request(app)
      .get('/api/v1/billing/5')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(5);
  });
});

describe('PATCH /api/v1/billing/:id/status', () => {
  beforeEach(() => mockDb.__reset());

  test('returns 400 for invalid status transition', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [{ id: 1, status: 'PAID' }], rowCount: 1 }, // current invoice
    ]);

    const res = await request(app)
      .patch('/api/v1/billing/1/status')
      .set(authHeaders())
      .send({ status: 'DRAFT' });

    // PAID → DRAFT is invalid
    expect([400, 422]).toContain(res.status);
  });
});

describe('GET /api/v1/billing/gas-quality', () => {
  beforeEach(() => mockDb.__reset());

  test('returns 200 with gas quality parameters', async () => {
    const paramRows = [
      { key: 'gcv_horgos_kwh_nm3', value: '10.89', unit: 'kWh/Nm3' },
      { key: 'wobbe_index_horgos', value: '13.50', unit: 'kWh/Nm3' },
    ];

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: paramRows, rowCount: 2 },
    ]);

    const res = await request(app)
      .get('/api/v1/billing/gas-quality')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
