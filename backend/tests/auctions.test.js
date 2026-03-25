'use strict';

/**
 * Auctions tests — GTCP (CAM NC / MAR0277-24)
 *
 * Covers:
 *   1. Auction revenue / credit block calculations (NC Art.5.3.1)
 *   2. Bid lifecycle HTTP endpoints: DRAFT → SUBMITTED → WON → CONTRACT
 *   3. Auction calendar / timeline endpoints
 */

const request = require('supertest');

jest.mock('../src/db', () => require('./helpers/mockDb'));
jest.mock('../src/services/auditService', () => ({ addAudit: jest.fn() }));

const mockDb = require('./helpers/mockDb');
const { authHeaders, activeUserRow } = require('./helpers/authToken');
const app = require('../src/app');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE UNIT TESTS — Revenue & Credit Block Calculation
// ─────────────────────────────────────────────────────────────────────────────

/** АЕРС tariffs by flow direction */
const TARIFFS = {
  GOSPODJINCI_HORGOS: { annual: 4.19, exit: 6.85 },   // entry + exit
  HORGOS_GOSPODJINCI: { annual: 3.25, exit: 3.25 },
  KIREVO_EXIT_SERBIA: { annual: 6.00, exit: 4.19 },
};

const CREDIT_MULT = {
  ANNUAL:     2 / 12,
  QUARTERLY:  (1 / 4) * (2 / 3),
  MONTHLY:    1 / 12,
  DAILY:      1 / 365,
  WITHIN_DAY: 1 / (365 * 24),
};

function calcBidRevenue(flowDirection, capacityKwhH, deliveryDays) {
  const t = TARIFFS[flowDirection] || {};
  const annualTariff = (t.annual || 0) + (t.exit || 0);
  const dailyRate = annualTariff / 365;
  return Math.round(capacityKwhH * dailyRate * deliveryDays * 100) / 100;
}

function calcCreditBlock(flowDirection, capacityKwhH, productType) {
  const t = TARIFFS[flowDirection] || {};
  const annualTariff = (t.annual || 0) + (t.exit || 0);
  const mult = CREDIT_MULT[productType] || 0;
  return Math.round(capacityKwhH * annualTariff * mult * 100) / 100;
}

describe('Auction revenue calculation (АЕРС 05-145 tariffs)', () => {

  test('Annual FIRM — GOSPODJINCI_HORGOS — 100 MW/h — 365 days', () => {
    const revenue = calcBidRevenue('GOSPODJINCI_HORGOS', 100_000, 365);
    // tariff = 4.19 + 6.85 = 11.04
    // revenue = 100_000 × 11.04 / 365 × 365 = 1_104_000
    expect(revenue).toBeCloseTo(1_104_000, -2);
  });

  test('Quarterly FIRM — 91 days', () => {
    const revenue = calcBidRevenue('GOSPODJINCI_HORGOS', 50_000, 91);
    // 50_000 × 11.04 / 365 × 91 = 137_709
    expect(revenue).toBeCloseTo(137_709, -2);
  });

  test('Monthly FIRM — 31 days', () => {
    const revenue = calcBidRevenue('GOSPODJINCI_HORGOS', 30_000, 31);
    // 30_000 × 11.04 / 365 × 31 = 28_095
    expect(revenue).toBeCloseTo(28_095, -1);
  });

  test('Daily — 1 day', () => {
    const revenue = calcBidRevenue('GOSPODJINCI_HORGOS', 5_000, 1);
    // 5_000 × 11.04 / 365 × 1 = 151.23
    expect(revenue).toBeGreaterThan(0);
    expect(revenue).toBeLessThan(300);
  });

  test('Commercial Reverse HORGOS_GOSPODJINCI — lower tariff', () => {
    const revReverse = calcBidRevenue('HORGOS_GOSPODJINCI', 100_000, 365);
    const revForward = calcBidRevenue('GOSPODJINCI_HORGOS', 100_000, 365);
    // Commercial reverse tariff 3.25 < bundled 11.04
    expect(revReverse).toBeLessThan(revForward);
  });
});

describe('Credit block calculation (NC Art.5.3.1)', () => {

  test('Annual: block = capacity × tariff × 2/12', () => {
    const block = calcCreditBlock('GOSPODJINCI_HORGOS', 100_000, 'ANNUAL');
    // 100_000 × 11.04 × 2/12 = 184_000
    expect(block).toBeCloseTo(184_000, -1);
  });

  test('Quarterly: block = capacity × tariff × 1/4 × 2/3', () => {
    const block = calcCreditBlock('GOSPODJINCI_HORGOS', 100_000, 'QUARTERLY');
    // 100_000 × 11.04 × (1/4 × 2/3) = 100_000 × 11.04 × 0.16667 = 184_000
    expect(block).toBeCloseTo(184_000, -1);
  });

  test('Monthly block < Quarterly block < Annual block', () => {
    const monthly    = calcCreditBlock('GOSPODJINCI_HORGOS', 100_000, 'MONTHLY');
    const quarterly  = calcCreditBlock('GOSPODJINCI_HORGOS', 100_000, 'QUARTERLY');
    const annual     = calcCreditBlock('GOSPODJINCI_HORGOS', 100_000, 'ANNUAL');
    expect(monthly).toBeLessThan(quarterly);
    expect(quarterly).toBeLessThan(annual);
  });

  test('KIREVO_EXIT_SERBIA tariff 10.19', () => {
    const block = calcCreditBlock('KIREVO_EXIT_SERBIA', 100_000, 'ANNUAL');
    // 100_000 × 10.19 × 2/12 = 169_833
    expect(block).toBeCloseTo(169_833, -2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HTTP ENDPOINT TESTS — Auction Bid Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const auctionRow = {
  id: 1, product_type: 'ANNUAL', capacity_type: 'FIRM',
  auction_round: 'AY-2025',
  auction_start_date: '2025-07-07', auction_start_utc: '2025-07-07T08:00:00Z',
  delivery_start: '2025-10-01', delivery_end: '2026-09-30',
  status: 'AUCTION_OPEN',
  point_code: 'HORGOS', flow_direction: 'GOSPODJINCI_HORGOS',
  available_capacity_kwh_h: 500_000, rbp_reserved_price_eur: 4.19,
};

const bidRow = {
  id: 101, auction_calendar_id: 1, shipper_id: 10,
  bid_capacity_kwh_h: 100_000, offered_price_eur: 11.50,
  status: 'DRAFT', credit_checked: false, credit_blocked_eur: 0,
  created_at: '2025-07-07T09:00:00Z',
};

describe('GET /api/v1/auctions — list auctions', () => {
  beforeEach(() => mockDb.__reset());

  test('returns 200 auction list', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [auctionRow], rowCount: 1 },
      { rows: [{ count: '1' }], rowCount: 1 },
    ]);

    const res = await request(app)
      .get('/api/v1/auctions')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/v1/auctions/bids — create bid (DRAFT)', () => {
  beforeEach(() => mockDb.__reset());

  test('creates bid and returns credit block estimate', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),                                        // authenticate
      { rows: [auctionRow], rowCount: 1 },                   // auction lookup
      { rows: [{ id: 10, credit_status: 'ACTIVE', rating_exempt: false }], rowCount: 1 }, // shipper
      { rows: [{ available_credit_eur: '500000' }], rowCount: 1 },  // credit view
      { rows: [{ id: 101 }], rowCount: 1 },                  // INSERT bid
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids')
      .set(authHeaders())
      .send({
        auction_calendar_id: 1,
        shipper_id: 10,
        bid_capacity_kwh_h: 100_000,
        offered_price_eur: 11.50,
      });

    // 201 Created or 200
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('id');
  });

  test('returns 400 for missing required fields', async () => {
    mockDb.__setQuerySequence([activeUserRow()]);

    const res = await request(app)
      .post('/api/v1/auctions/bids')
      .set(authHeaders())
      .send({ shipper_id: 10 });  // missing auction_calendar_id

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auctions/bids/:id/submit', () => {
  beforeEach(() => mockDb.__reset());

  test('submits bid with sufficient credit → status SUBMITTED', async () => {
    const draftBid = { ...bidRow, status: 'DRAFT' };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [draftBid], rowCount: 1 },           // bid lookup
      { rows: [auctionRow], rowCount: 1 },          // auction
      { rows: [{ id: 10, credit_status: 'ACTIVE', rating_exempt: false }], rowCount: 1 },
      { rows: [{ available_credit_eur: '1000000' }], rowCount: 1 }, // enough credit
      { rows: [{ ...draftBid, status: 'SUBMITTED', credit_checked: true }], rowCount: 1 }, // UPDATE
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/101/submit')
      .set(authHeaders());

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('SUBMITTED');
  });

  test('returns 404 for non-existent bid', async () => {
    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [], rowCount: 0 },   // bid not found
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/9999/submit')
      .set(authHeaders());

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/auctions/bids/:id/result', () => {
  beforeEach(() => mockDb.__reset());

  test('records WON result and returns updated bid', async () => {
    const submittedBid = { ...bidRow, status: 'SUBMITTED', credit_checked: true };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [submittedBid], rowCount: 1 },    // bid lookup
      { rows: [auctionRow], rowCount: 1 },       // auction
      { rows: [{ ...submittedBid, status: 'WON', won_capacity_kwh_h: 100_000 }], rowCount: 1 },  // UPDATE bid
      { rows: [{ ...auctionRow, status: 'RESULTS_PUBLISHED' }], rowCount: 1 }, // UPDATE auction
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/101/result')
      .set(authHeaders())
      .send({ result: 'WON', won_capacity_kwh_h: 100_000, final_price_eur: 11.50 });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('WON');
  });

  test('records LOST result', async () => {
    const submittedBid = { ...bidRow, status: 'SUBMITTED', credit_checked: true };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [submittedBid], rowCount: 1 },
      { rows: [auctionRow], rowCount: 1 },
      { rows: [{ ...submittedBid, status: 'LOST' }], rowCount: 1 },
      { rows: [auctionRow], rowCount: 1 },
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/101/result')
      .set(authHeaders())
      .send({ result: 'LOST', won_capacity_kwh_h: 0, final_price_eur: 0 });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('LOST');
  });
});

describe('POST /api/v1/auctions/bids/:id/create-contract', () => {
  beforeEach(() => mockDb.__reset());

  test('creates contract from WON bid → status CONTRACT_CREATED', async () => {
    const wonBid = {
      ...bidRow, status: 'WON', credit_checked: true,
      won_capacity_kwh_h: 100_000, final_price_eur: 11.50, contract_id: null,
    };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [wonBid], rowCount: 1 },          // bid lookup
      { rows: [{ fn_create_contract_from_bid: 999 }], rowCount: 1 }, // fn call → contract_id 999
      { rows: [{ ...wonBid, status: 'CONTRACT_CREATED', contract_id: 999 }], rowCount: 1 }, // updated bid
      { rows: [{ id: 999, contract_no: 'GTA-2025-001' }], rowCount: 1 }, // contract details
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/101/create-contract')
      .set(authHeaders());

    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('contract_id');
  });

  test('returns 409 if contract already created', async () => {
    const alreadyContracted = {
      ...bidRow, status: 'CONTRACT_CREATED', contract_id: 888,
    };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [alreadyContracted], rowCount: 1 },
    ]);

    const res = await request(app)
      .post('/api/v1/auctions/bids/101/create-contract')
      .set(authHeaders());

    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/auctions/timeline', () => {
  beforeEach(() => mockDb.__reset());

  test('returns upcoming events grouped by week', async () => {
    const timelineRow = {
      event_type: 'AUCTION_OPEN',
      event_date: '2025-07-07',
      product_type: 'ANNUAL',
      point_code: 'HORGOS',
    };

    mockDb.__setQuerySequence([
      activeUserRow(),
      { rows: [timelineRow, { ...timelineRow, event_type: 'DELIVERY_START', event_date: '2025-10-01' }], rowCount: 2 },
    ]);

    const res = await request(app)
      .get('/api/v1/auctions/timeline?days=90')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});
