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
const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';

const SP_ROWS = [
  { key: 'tariff_entry_gospodjinci_eur_kwh_h_yr', value: '6.00' },
  { key: 'tariff_exit_horgos_eur_kwh_h_yr', value: '6.85' },
  { key: 'tariff_commercial_reverse_eur_kwh_h_yr', value: '3.25' },
  { key: 'tariff_bundled_annual_eur_kwh_h_yr', value: '12.85' },
  { key: 'tariff_daily_entry_eur_kwh_h', value: '0.0329' },
  { key: 'tariff_daily_exit_horgos_eur_kwh_h', value: '0.0375' },
  { key: 'fuel_gas_x1_compressor_pct', value: '0.42' },
  { key: 'fuel_gas_x2_preheating_pct', value: '0.08' },
  { key: 'fuel_gas_kn_quality_kwh', value: '0' },
  { key: 'fuel_gas_rate_pct', value: '0.50' },
  { key: 'fuel_gas_price_eur_mwh', value: '32.50' },
  { key: 'gcv_horgos_kwh_nm3', value: '11.523' },
  { key: 'balancing_gas_rate_eur_mwh', value: '5.00' },
  { key: 'euribor_6m_pct', value: '2.64' },
  { key: 'late_payment_spread_pct', value: '3.0' },
  { key: 'late_payment_day_basis', value: '360' },
];

function mockStdFlow() {
  db.query.mockImplementation((sql) => {
    if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
    if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '0' }] });
    if (sql.includes('INSERT INTO invoices')) return Promise.resolve({ rows: [{ id: 99, invoice_no: 'INV-2026-0099' }] });
    if (sql.includes('INSERT INTO invoice_line_items')) return Promise.resolve({ rows: [] });
    if (sql.includes('reserve_prices')) return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
}

describe('POST /billing/with-lines — all line types', () => {

  beforeEach(() => { db.query.mockReset(); });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  test('CAPACITY — FIRM_YEARLY (annual /365)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'KIREVO-ENTRY', direction: 'ENTRY', capacityKwhH: 13752230, tariffEur: 6.00 },
          { lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'HORGOS-EXIT', direction: 'EXIT', capacityKwhH: 9216209, tariffEur: 6.85 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].amount_eur).toBeGreaterThan(0);
    expect(res.body.lines[0].formula).toContain('/365');
  });

  test('CAPACITY — FIRM_QUARTERLY (quarterly /qdays)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-04-01', periodTo: '2026-04-30',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_QUARTERLY_Q3', pointCode: 'KIREVO-ENTRY', direction: 'ENTRY', capacityKwhH: 13752230, tariffEur: 1.80, periodDays: 30 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].formula).toContain('qd');
  });

  test('CAPACITY — FIRM_MONTHLY (no division)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_MONTHLY', pointCode: 'KIREVO-ENTRY', capacityKwhH: 10000, tariffEur: 0.66 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].formula).toContain('/month');
    expect(res.body.lines[0].amount_eur).toBe(6600);
  });

  test('CAPACITY — FIRM_DAILY (daily × days)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_DAILY', pointCode: 'KIREVO-ENTRY', capacityKwhH: 10000, tariffEur: 0.0329, periodDays: 31 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].formula).toContain('/d');
  });

  test('CAPACITY_WITHIN_DAY (hourly × hours)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-30', periodTo: '2026-03-30',
        lines: [
          { lineType: 'CAPACITY_WITHIN_DAY', productType: 'WITHIN_DAY', pointCode: 'KIREVO-ENTRY', capacityKwhH: 5000, tariffEur: 0.0021, hours: 8 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].amount_eur).toBe(84);
    expect(res.body.lines[0].nc_ref).toBe('Art.6.3.1.4');
  });

  test('FUEL_GAS — auto-calc from capacity lines', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'HORGOS-EXIT', direction: 'EXIT', capacityKwhH: 9216209, tariffEur: 6.85, periodDays: 31 },
          { lineType: 'FUEL_GAS' },
        ],
      });
    expect(res.status).toBe(201);
    const fgLine = res.body.lines.find(l => l.lineType === 'FUEL_GAS');
    expect(fgLine.amount_eur).toBeGreaterThan(0);
    expect(fgLine.nc_ref).toBe('Art.18');
  });

  test('FUEL_GAS — explicit quantity', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'FUEL_GAS', quantityKwh: 45000, unitPriceEur: 0.0325 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].amount_eur).toBe(1462.50);
  });

  test('TRANSFER line', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'TRANSFER', capacityKwhH: 5000, tariffEur: 6.00, transferRef: 'TRF-001' }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].nc_ref).toBe('Art.10.3');
  });

  test('AUCTION_PREMIUM line', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'AUCTION_PREMIUM', capacityKwhH: 1000000, auctionPriceEur: 7.50, reservePriceEur: 6.00, hours: 744 }],
      });
    expect(res.status).toBe(201);
    // premium = (7.50 - 6.00) × 1M × 744h = 1.5 × 1M × 744 = 1,116,000,000
    expect(res.body.lines[0].amount_eur).toBeGreaterThan(0);
    expect(res.body.lines[0].nc_ref).toBe('Art.7.6.11');
  });

  test('SURRENDER_PREMIUM line', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'SURRENDER_PREMIUM', capacityKwhH: 500000, auctionPriceEur: 7.00, reservePriceEur: 6.00, hours: 744 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].nc_ref).toBe('Art.8.3');
  });

  test('LATE_PAYMENT line', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'LATE_PAYMENT', overdueAmountEur: 100000, overdueDays: 15 }],
      });
    expect(res.status).toBe(201);
    // rate = (2.64 + 3.0)/100 = 0.0564 → 100000 × 0.0564 / 360 × 15 = 235.00
    expect(res.body.lines[0].amount_eur).toBe(235);
    expect(res.body.lines[0].nc_ref).toBe('Art.20.4.2');
  });

  test('IMBALANCE line', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'IMBALANCE', quantityKwh: 1000, unitPriceEur: 0.032 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].amount_eur).toBe(32);
    expect(res.body.lines[0].nc_ref).toBe('Art.15.4');
  });

  test('INTERRUPTION_PENALTY line (×3)', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-30', periodTo: '2026-03-30',
        lines: [{ lineType: 'INTERRUPTION_PENALTY', capacityKwhH: 10000, tariffEur: 0.0329, periodDays: 1 }],
      });
    expect(res.status).toBe(201);
    // baseFee = 10000 × 0.0329 × 1 = 329, penalty = 329 × 3 = 987
    expect(res.body.lines[0].amount_eur).toBe(987);
    expect(res.body.lines[0].nc_ref).toBe('AERS 05-145 item 3');
  });

  test('mixed lines — all subtotals computed', async () => {
    mockStdFlow();
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [
          { lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'KIREVO-ENTRY', direction: 'ENTRY', capacityKwhH: 13752230, tariffEur: 6.00 },
          { lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'HORGOS-EXIT', direction: 'EXIT', capacityKwhH: 9216209, tariffEur: 6.85 },
          { lineType: 'FUEL_GAS' },
          { lineType: 'LATE_PAYMENT', overdueAmountEur: 50000, overdueDays: 10 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.subtotals).toBeDefined();
    expect(res.body.subtotals.capacity).toBeGreaterThan(0);
    expect(res.body.subtotals.fuelGas).toBeGreaterThan(0);
    expect(res.body.subtotals.penalties).toBeGreaterThan(0);
  });

  test('returns 400 if lines empty', async () => {
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31', lines: [] });
    expect(res.status).toBe(400);
  });

  test('returns 400 if invalid lineType', async () => {
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'INVALID_TYPE' }],
      });
    expect(res.status).toBe(400);
  });

  test('auto-lookup tariff from reserve_prices', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '0' }] });
      if (sql.includes('reserve_prices')) return Promise.resolve({ rows: [{ tariff_eur: '6.00' }] });
      if (sql.includes('INSERT INTO invoices')) return Promise.resolve({ rows: [{ id: 99, invoice_no: 'INV-2026-0099' }] });
      if (sql.includes('INSERT INTO invoice_line_items')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    const res = await request(app)
      .post(`${API}/billing/with-lines`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        lines: [{ lineType: 'CAPACITY', productType: 'FIRM_YEARLY', pointCode: 'KIREVO-ENTRY', capacityKwhH: 10000 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.lines[0].tariffSource).toBe('AERS_05_145');
  });
});

describe('POST /billing/generate — auto-generate from contracts', () => {

  beforeEach(() => { db.query.mockReset(); });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  test('generates preview from active contracts', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts')) return Promise.resolve({ rows: [{
        id: 1, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_YEARLY',
        cap_entry_kwh_h: 13752230, cap_exit_kwh_h: 9216209,
        tariff_entry_eur_kwh_h: 6.00, tariff_exit_eur_kwh_h: 6.85,
        flow_direction: 'KIREVO_HORGOS', start_date: '2025-10-01', end_date: '2026-09-30',
      }] });
      if (sql.includes('invoices') && sql.includes('OVERDUE')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.lines.length).toBeGreaterThanOrEqual(3); // entry + exit + fuel_gas
  });

  test('returns 404 if no contracts found', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });
    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(res.status).toBe(404);
  });

  test('includes LATE_PAYMENT lines for overdue invoices', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts') && !sql.includes('invoices')) return Promise.resolve({ rows: [{
        id: 1, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_YEARLY',
        cap_entry_kwh_h: 10000, cap_exit_kwh_h: 10000,
        tariff_entry_eur_kwh_h: 6.00, tariff_exit_eur_kwh_h: 6.85,
        flow_direction: 'KIREVO_HORGOS', start_date: '2025-10-01', end_date: '2026-09-30',
      }] });
      if (sql.includes('OVERDUE')) return Promise.resolve({ rows: [
        { id: 5, invoice_no: 'INV-2026-0005', total_amount_eur: 100000, due_date: '2026-02-20' },
      ] });
      return Promise.resolve({ rows: [] });
    });
    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(res.status).toBe(200);
    const lateLines = res.body.lines.filter(l => l.lineType === 'LATE_PAYMENT');
    expect(lateLines.length).toBe(1);
  });

  test('returns 400 if shipperId missing', async () => {
    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(res.status).toBe(400);
  });
});

describe('POST /billing/:id/erp-sync — full coverage', () => {

  beforeEach(() => { db.query.mockReset(); });

  test('syncs invoice to ERP', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, invoice_no: 'INV-2026-0001', status: 'ISSUED' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, erp_ref: '1C-INV-2026-0001-123', erp_synced_at: '2026-03-30' }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const token = makeToken({ ...SEED.ADMIN_USER });
    const res = await request(app)
      .post(`${API}/billing/1/erp-sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.erpRef).toContain('1C-');
  });

  test('returns 404 if invoice not found', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const token = makeToken({ ...SEED.ADMIN_USER });
    const res = await request(app)
      .post(`${API}/billing/999/erp-sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('calcCapacityFee branches via POST /billing', () => {

  beforeEach(() => { db.query.mockReset(); });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  function mockForInvoice() {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '0' }] });
      if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 99, invoice_no: 'INV-2026-0099' }] });
      return Promise.resolve({ rows: [] });
    });
  }

  test('Commercial Reverse route uses CR tariffs', async () => {
    mockForInvoice();
    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        capEntryKwhH: 5000000, capExitKwhH: 5000000,
        flowDirection: 'HORGOS_GOSPODJINCI',
      });
    expect(res.status).toBe(201);
    expect(res.body._breakdown.capacity.totalFeeEur).toBeGreaterThan(0);
  });

  test('Legacy bundled capacity (single capKwhH)', async () => {
    mockForInvoice();
    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31',
        capacityKwhH: 50000,
      });
    expect(res.status).toBe(201);
  });
});
