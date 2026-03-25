'use strict';

/**
 * Credits tests — GTCP (NC Art.5)
 *
 * Covers:
 *   1. Rating exemption logic NC Art.5.4 (S&P, Moody's, Creditreform)
 *   2. Minimum credit size calculation NC Art.5.3.1
 *   3. HTTP endpoints (eligibility, margin call, coverage)
 */

const request = require('supertest');

jest.mock('../src/db', () => require('./helpers/mockDb'));
jest.mock('../src/services/auditService', () => ({ addAudit: jest.fn() }));

const mockDb = require('./helpers/mockDb');
const { authHeaders, activeUserRow } = require('./helpers/authToken');
const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE UNIT TESTS — Rating Exemption (NC Art.5.4)
// ─────────────────────────────────────────────────────────────────────────────

/** Mirror of credits.js isRatingExempt() for pure unit tests */
const SP_INVEST    = ['AAA','AA+','AA','AA-','A+','A','A-','BBB+','BBB','BBB-'];
const MOODYS_INVEST = ['Aaa','Aa1','Aa2','Aa3','A1','A2','A3','Baa1','Baa2','Baa3'];
const CREDITREFORM_THRESHOLD = 235;

function isRatingExempt({ spRating, moodysRating, creditreformScore } = {}) {
  if (spRating         && SP_INVEST.includes(spRating))             return true;
  if (moodysRating     && MOODYS_INVEST.includes(moodysRating))     return true;
  if (creditreformScore != null && creditreformScore <= CREDITREFORM_THRESHOLD) return true;
  return false;
}

describe('NC Art.5.4 — Rating Exemption', () => {

  test('S&P BBB- qualifies for exemption', () => {
    expect(isRatingExempt({ spRating: 'BBB-' })).toBe(true);
  });

  test('S&P BBB qualifies for exemption', () => {
    expect(isRatingExempt({ spRating: 'BBB' })).toBe(true);
  });

  test('S&P AAA qualifies for exemption', () => {
    expect(isRatingExempt({ spRating: 'AAA' })).toBe(true);
  });

  test("S&P BB+ does NOT qualify (sub-investment grade)", () => {
    expect(isRatingExempt({ spRating: 'BB+' })).toBe(false);
  });

  test("S&P BB does NOT qualify", () => {
    expect(isRatingExempt({ spRating: 'BB' })).toBe(false);
  });

  test("Moody's Baa3 qualifies for exemption", () => {
    expect(isRatingExempt({ moodysRating: 'Baa3' })).toBe(true);
  });

  test("Moody's Aaa qualifies for exemption", () => {
    expect(isRatingExempt({ moodysRating: 'Aaa' })).toBe(true);
  });

  test("Moody's Ba1 does NOT qualify", () => {
    expect(isRatingExempt({ moodysRating: 'Ba1' })).toBe(false);
  });

  test('Creditreform score 235 qualifies (≤ 235 threshold)', () => {
    expect(isRatingExempt({ creditreformScore: 235 })).toBe(true);
  });

  test('Creditreform score 200 qualifies', () => {
    expect(isRatingExempt({ creditreformScore: 200 })).toBe(true);
  });

  test('Creditreform score 236 does NOT qualify (> 235)', () => {
    expect(isRatingExempt({ creditreformScore: 236 })).toBe(false);
  });

  test('no ratings provided → NOT exempt', () => {
    expect(isRatingExempt({})).toBe(false);
    expect(isRatingExempt({ spRating: null, moodysRating: null })).toBe(false);
  });

  test('multiple ratings: one qualifies → exempt', () => {
    // BB (not invest) but Creditreform 100 (qualifies) → exempt
    expect(isRatingExempt({ spRating: 'BB', creditreformScore: 100 })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PURE UNIT TESTS — Minimum Credit Size (NC Art.5.3.1)
// ─────────────────────────────────────────────────────────────────────────────

/** NC Art.5.3.1 multipliers: Annual=2/12, Quarterly=2/3×1/4, Monthly=1/12, Daily=1/365 */
const CREDIT_MULT = {
  ANNUAL:      2 / 12,
  QUARTERLY:   (1 / 4) * (2 / 3),
  MONTHLY:     1 / 12,
  DAILY:       1 / 365,
  WITHIN_DAY:  1 / (365 * 24),
};

// АЕРС tariffs
const TARIFFS = {
  GOSPODJINCI_HORGOS: { annual: 4.19 + 6.85 }, // 11.04
  HORGOS_GOSPODJINCI: { annual: 3.25 },
  KIREVO_EXIT_SERBIA: { annual: 6.00 + 4.19 }, // 10.19
};

function calcMinCredit(contracts) {
  let total = 0;
  const byProduct = {};
  for (const c of contracts) {
    const mult    = CREDIT_MULT[c.product_type] || 0;
    const tariff  = (TARIFFS[c.flow_direction] || {}).annual || 0;
    const amount  = c.capacity_kwh_h * tariff * mult;
    total += amount;
    byProduct[c.product_type] = (byProduct[c.product_type] || 0) + amount;
  }
  return { total: Math.round(total * 100) / 100, byProduct };
}

describe('NC Art.5.3.1 — Minimum Credit Size', () => {

  test('Annual contract 100 MW/h GOSPODJINCI_HORGOS', () => {
    const { total } = calcMinCredit([{
      product_type: 'ANNUAL',
      flow_direction: 'GOSPODJINCI_HORGOS',
      capacity_kwh_h: 100_000,
    }]);
    // 100_000 × 11.04 × 2/12 = 184_000
    expect(total).toBeCloseTo(184_000, -1);
  });

  test('Quarterly contract 50 MW/h', () => {
    const { total } = calcMinCredit([{
      product_type: 'QUARTERLY',
      flow_direction: 'GOSPODJINCI_HORGOS',
      capacity_kwh_h: 50_000,
    }]);
    // 50_000 × 11.04 × (1/4 × 2/3) = 50_000 × 11.04 × 0.16667 = 92_000
    expect(total).toBeCloseTo(92_000, -2);
  });

  test('Monthly contract 30 MW/h', () => {
    const { total } = calcMinCredit([{
      product_type: 'MONTHLY',
      flow_direction: 'GOSPODJINCI_HORGOS',
      capacity_kwh_h: 30_000,
    }]);
    // 30_000 × 11.04 × 1/12 = 27_600
    expect(total).toBeCloseTo(27_600, -1);
  });

  test('Multiple contracts — correct aggregation', () => {
    const contracts = [
      { product_type: 'ANNUAL',   flow_direction: 'GOSPODJINCI_HORGOS', capacity_kwh_h: 100_000 },
      { product_type: 'MONTHLY',  flow_direction: 'HORGOS_GOSPODJINCI',  capacity_kwh_h: 20_000  },
    ];
    const { total, byProduct } = calcMinCredit(contracts);
    expect(total).toBeGreaterThan(0);
    expect(byProduct.ANNUAL).toBeGreaterThan(0);
    expect(byProduct.MONTHLY).toBeGreaterThan(0);
  });

  test('empty contracts → zero credit required', () => {
    const { total } = calcMinCredit([]);
    expect(total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. HTTP ENDPOINT TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/credits/:shipperId/eligibility', () => {
  beforeEach(() => mockDb.__reset());

  const shipperRow = {
    id: 10, company_name: 'Gazprom Export', credit_status: 'ACTIVE',
    credit_form: 'BANK_GUARANTEE', rating_exempt: false,
    sp_rating: 'BBB', moodys_rating: null, creditreform_score: null,
  };

  test('returns 200 with eligibility for rated shipper', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),                              // authenticate
      { rows: [shipperRow], rowCount: 1 },          // shipper lookup
      { rows: [], rowCount: 0 },                    // active contracts
      { rows: [{ total_credit_eur: '500000', available_credit_eur: '300000' }], rowCount: 1 }, // credit view
    ]);

    const res = await request(app)
      .get('/api/v1/credits/10/eligibility')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('eligible');
  });

  test('returns 404 for unknown shipper', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [], rowCount: 0 },   // shipper not found
    ]);

    const res = await request(app)
      .get('/api/v1/credits/9999/eligibility')
      .set(authHeaders());

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/credits/:shipperId/margin-call', () => {
  beforeEach(() => mockDb.__reset());

  test('creates margin call and returns 2-business-day deadline (NC Art.5.5)', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [{ id: 10, company_name: 'Test Shipper', credit_status: 'ACTIVE' }], rowCount: 1 },
      { rows: [{ id: 42 }], rowCount: 1 },   // margin call event inserted
      { rows: [], rowCount: 0 },             // audit
    ]);

    const res = await request(app)
      .post('/api/v1/credits/10/margin-call')
      .set(authHeaders())
      .send({ shortfall_eur: 50000, reason: 'Insufficient credit coverage' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('deadline_date');
  });

  test('returns 400 if shortfall_eur missing', async () => {
    mockDb.__setQuerySequence([activeUserRow()]);

    const res = await request(app)
      .post('/api/v1/credits/10/margin-call')
      .set(authHeaders())
      .send({});   // no shortfall_eur

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/credits — list credit supports', () => {
  beforeEach(() => mockDb.__reset());

  test('returns paginated credit support list', async () => {
    const creditRow = {
      id: 1, shipper_id: 10, company_name: 'Gazprom Export',
      support_type: 'BANK_GUARANTEE', amount_eur: 2000000,
      valid_from: '2025-01-01', valid_to: '2025-12-31', status: 'ACTIVE',
    };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [creditRow], rowCount: 1 },
      { rows: [{ count: '1' }], rowCount: 1 },
    ]);

    const res = await request(app)
      .get('/api/v1/credits')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
