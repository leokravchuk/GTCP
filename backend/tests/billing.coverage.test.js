'use strict';

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
  withTransaction: jest.fn(async (fn) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

// Standard system_params mock (AERS 05-145 defaults)
const SYSTEM_PARAMS_ROWS = [
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

const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';

describe('Billing Coverage — POST /billing (invoice creation)', () => {

  beforeEach(() => { db.query.mockReset(); });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  // ── Capacity-based invoice (KIREVO_HORGOS, March 31 days) ─────────────

  test('creates capacity-based invoice with separate entry/exit', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SYSTEM_PARAMS_ROWS });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '5' }] });
      if (sql.includes('INSERT INTO invoices')) return Promise.resolve({ rows: [{ id: 6, invoice_no: 'INV-2026-0006', total_amount_eur: 12500000 }] });
      return Promise.resolve({ rows: [] }); // audit
    });

    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        capEntryKwhH: 13752230,
        capExitKwhH: 9216209,
        flowDirection: 'GOSPODJINCI_HORGOS',
      });
    expect(res.status).toBe(201);
    expect(res.body._breakdown).toBeDefined();
    expect(res.body._breakdown.capacity.entryFeeEur).toBeGreaterThan(0);
    expect(res.body._breakdown.capacity.exitFeeEur).toBeGreaterThan(0);
    expect(res.body._breakdown.fuelGas.estimated).toBe(true);
    expect(res.body._breakdown.billingDays).toBe(31);
  });

  test('creates invoice with actual fuel gas flow (NC Art.18)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SYSTEM_PARAMS_ROWS });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '6' }] });
      if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 7, invoice_no: 'INV-2026-0007' }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        capEntryKwhH: 13752230,
        capExitKwhH: 9216209,
        qHorgosKwh: 10000000,
        qSerbiaKwh: 5000000,
      });
    expect(res.status).toBe(201);
    expect(res.body._breakdown.fuelGas.estimated).toBe(false);
    expect(res.body._breakdown.fuelGas.kwh).toBeGreaterThan(0);
  });

  test('creates invoice with contractId (resolves from contract)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SYSTEM_PARAMS_ROWS });
      if (sql.includes('contracts WHERE')) return Promise.resolve({ rows: [{
        id: 1, cap_entry_kwh_h: 13752230, cap_exit_kwh_h: 9216209,
        tariff_entry_eur_kwh_h: 6.00, tariff_exit_eur_kwh_h: 6.85,
        flow_direction: 'KIREVO_HORGOS', billing_model: 'CAPACITY',
      }] });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '7' }] });
      if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 8, invoice_no: 'INV-2026-0008' }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        contractId: 1,
      });
    expect(res.status).toBe(201);
    expect(res.body.billing_model).toBe('CAPACITY');
  });

  test('creates legacy volume-based invoice', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SYSTEM_PARAMS_ROWS });
      if (sql.includes('COUNT')) return Promise.resolve({ rows: [{ cnt: '8' }] });
      if (sql.includes('INSERT')) return Promise.resolve({ rows: [{ id: 9, invoice_no: 'INV-2026-0009' }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({
        shipperId: UUID_1,
        periodFrom: '2026-03-01',
        periodTo: '2026-03-31',
        volumeMwh: 500000,
        tariffEurMwh: 12.85,
        balancingGasMwh: 100,
      });
    expect(res.status).toBe(201);
  });

  test('returns 400 if shipperId is not UUID', async () => {
    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: 'not-uuid', periodFrom: '2026-03-01', periodTo: '2026-03-31' });
    expect(res.status).toBe(400);
  });

  test('returns 400 if periodFrom missing', async () => {
    const res = await request(app)
      .post(`${API}/billing`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodTo: '2026-03-31' });
    expect(res.status).toBe(400);
  });
});

describe('Billing Coverage — GET /billing/gas-quality', () => {

  beforeEach(() => { db.query.mockReset(); });

  test('returns gas quality data', async () => {
    db.query.mockResolvedValue({ rows: [
      { gas_day: '2026-03-01', point_code: 'HORGOS-EXIT', gcv_kwh_nm3: 11.52 },
    ] });
    const token = makeToken({ ...SEED.BILLING_USER });
    const res = await request(app)
      .get(`${API}/billing/gas-quality?point_code=HORGOS-EXIT&month=2026-03`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('defaults to HORGOS-EXIT without point_code', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const token = makeToken({ ...SEED.BILLING_USER });
    const res = await request(app)
      .get(`${API}/billing/gas-quality`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toContain('HORGOS-EXIT');
  });
});

describe('Billing Coverage — GET /billing/:id (with line items)', () => {

  beforeEach(() => { db.query.mockReset(); });

  test('returns invoice with line items', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, invoice_no: 'INV-2026-0001', status: 'ISSUED' }] })
      .mockResolvedValueOnce({ rows: [
        { line_type: 'CAPACITY', description: 'Entry Kirevo', amount_eur: 85000 },
        { line_type: 'FUEL_GAS', description: 'Fuel Gas NC Art.18', amount_eur: 1500 },
      ] });
    const token = makeToken({ ...SEED.BILLING_USER });
    const res = await request(app)
      .get(`${API}/billing/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Billing Coverage — GET /billing/:id/statement', () => {

  beforeEach(() => { db.query.mockReset(); });

  test('returns full monthly statement', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('invoices') && sql.includes('WHERE')) return Promise.resolve({ rows: [{ id: 1, invoice_no: 'INV-2026-0001', shipper_id: 1, period_from: '2026-03-01', period_to: '2026-03-31' }] });
      if (sql.includes('shippers')) return Promise.resolve({ rows: [SEED.SHIPPER_1] });
      if (sql.includes('invoice_line_items') || sql.includes('line_items')) return Promise.resolve({ rows: [
        { line_type: 'CAPACITY', amount_eur: 85000 },
        { line_type: 'FUEL_GAS', amount_eur: 1500 },
      ] });
      return Promise.resolve({ rows: [] });
    });
    const token = makeToken({ ...SEED.BILLING_USER });
    const res = await request(app)
      .get(`${API}/billing/1/statement`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Billing Coverage — PATCH /billing/:id/status (all transitions)', () => {

  beforeEach(() => { db.query.mockReset(); });

  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  test('DRAFT → CANCELLED', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 1, status: 'DRAFT', total_amount_eur: 100000 }] });
      return Promise.resolve({ rows: [{ id: 1, status: 'CANCELLED' }] });
    });
    const res = await request(app)
      .patch(`${API}/billing/1/status`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
  });

  test('ISSUED → OVERDUE (triggers late interest calc)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SYSTEM_PARAMS_ROWS });
      if (sql.includes('SELECT') && sql.includes('invoices')) return Promise.resolve({ rows: [{ id: 1, status: 'ISSUED', total_amount_eur: 100000, due_date: '2026-02-20' }] });
      return Promise.resolve({ rows: [{ id: 1, status: 'OVERDUE', late_payment_eur: 235 }] });
    });
    const res = await request(app)
      .patch(`${API}/billing/1/status`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ status: 'OVERDUE' });
    expect(res.status).toBe(200);
  });

  test('OVERDUE → PAID', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT')) return Promise.resolve({ rows: [{ id: 1, status: 'OVERDUE', total_amount_eur: 100000 }] });
      return Promise.resolve({ rows: [{ id: 1, status: 'PAID', paid_at: '2026-03-30' }] });
    });
    const res = await request(app)
      .patch(`${API}/billing/1/status`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ status: 'PAID' });
    expect(res.status).toBe(200);
  });

  test('returns 400 for invalid status value', async () => {
    const res = await request(app)
      .patch(`${API}/billing/1/status`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ status: 'INVALID' });
    expect(res.status).toBe(400);
  });

  test('returns 404 if invoice not found', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .patch(`${API}/billing/999/status`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ status: 'ISSUED' });
    expect(res.status).toBe(404);
  });
});

describe('Billing Coverage — POST /billing/:id/erp-sync', () => {

  beforeEach(() => { db.query.mockReset(); });

  test('returns 403 for billing role (needs billing:erp_sync)', async () => {
    const token = makeToken({ ...SEED.BILLING_USER });
    const res = await request(app)
      .post(`${API}/billing/1/erp-sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin can trigger erp-sync', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, invoice_no: 'INV-2026-0001', status: 'ISSUED' }] });
    const token = makeToken({ ...SEED.ADMIN_USER });
    const res = await request(app)
      .post(`${API}/billing/1/erp-sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBeLessThan(500);
  });
});
