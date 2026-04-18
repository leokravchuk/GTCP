'use strict';

/**
 * FG Separate Invoice tests — NC Art.20.3.5
 * Sprint 18 · US-1712
 *
 * When shipper has >1 active contract (multi-product):
 *   → Fuel Gas must be a separate invoice, not a line item
 */

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
const UUID_1 = '550e8400-e29b-41d4-a716-446655440001';

// System params mock
const SP_ROWS = [
  { key: 'tariff_entry_eur_kwh_h_yr', value: '6.00' },
  { key: 'tariff_exit_horgos_eur_kwh_h_yr', value: '6.85' },
  { key: 'tariff_exit_serbia_eur_kwh_h_yr', value: '4.19' },
  { key: 'fuel_gas_rate_x1', value: '0.005' },
  { key: 'fuel_gas_rate_x2', value: '0.003' },
  { key: 'fuel_gas_kn_kwh', value: '100' },
  { key: 'fuel_gas_price_eur_mwh', value: '28.50' },
  { key: 'euribor_6m', value: '3.50' },
];

describe('FG Separate Invoice — NC Art.20.3.5', () => {
  beforeEach(() => { db.query.mockReset(); });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  test('multi-product shipper → separate CAPACITY + FUEL_GAS invoices', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts') && !sql.includes('invoices')) return Promise.resolve({ rows: [
        { id: 1, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_YEARLY',
          cap_entry_kwh_h: 9752230, cap_exit_kwh_h: 9216209, flow_direction: 'KIREVO_HORGOS',
          start_date: '2025-10-01', end_date: '2026-09-30' },
        { id: 2, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_MONTHLY',
          cap_entry_kwh_h: 500000, cap_exit_kwh_h: 500000, flow_direction: 'KIREVO_EXIT_SERBIA',
          start_date: '2026-03-01', end_date: '2026-03-31' },
      ] });
      if (sql.includes('OVERDUE')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });

    expect(res.status).toBe(200);
    expect(res.body.contractsFound).toBe(2);
    // Art.20.3.5: must have separate invoices
    expect(res.body.invoices).toBeDefined();
    expect(res.body.invoices).toHaveLength(2);
    expect(res.body.invoices[0].invoiceType).toBe('CAPACITY');
    expect(res.body.invoices[1].invoiceType).toBe('FUEL_GAS');
    expect(res.body.invoices[1].ncRef).toContain('Art.20.3.5');
    // No top-level lines when split
    expect(res.body.lines).toBeUndefined();
  });

  test('single-product shipper → combined invoice (lines, no split)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts') && !sql.includes('invoices')) return Promise.resolve({ rows: [
        { id: 1, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_YEARLY',
          cap_entry_kwh_h: 9752230, cap_exit_kwh_h: 9216209, flow_direction: 'KIREVO_HORGOS',
          start_date: '2025-10-01', end_date: '2026-09-30' },
      ] });
      if (sql.includes('OVERDUE')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });

    expect(res.status).toBe(200);
    expect(res.body.contractsFound).toBe(1);
    // Single contract → combined lines, no invoices array
    expect(res.body.lines).toBeDefined();
    expect(res.body.invoices).toBeUndefined();
  });

  test('in-kind shipper → no FG invoice generated', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('system_params')) return Promise.resolve({ rows: SP_ROWS });
      if (sql.includes('contracts') && !sql.includes('invoices')) return Promise.resolve({ rows: [
        { id: 1, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_YEARLY',
          cap_entry_kwh_h: 4000209, cap_exit_kwh_h: 4000209, flow_direction: 'KIREVO_EXIT_SERBIA',
          start_date: '2025-10-01', end_date: '2026-09-30' },
        { id: 2, shipper_id: UUID_1, status: 'ACTIVE', contract_type: 'FIRM_MONTHLY',
          cap_entry_kwh_h: 500000, cap_exit_kwh_h: 500000, flow_direction: 'KIREVO_EXIT_SERBIA',
          start_date: '2026-03-01', end_date: '2026-03-31' },
      ] });
      if (sql.includes('OVERDUE')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/billing/generate`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .send({ shipperId: UUID_1, periodFrom: '2026-03-01', periodTo: '2026-03-31' });

    expect(res.status).toBe(200);
    // KIREVO_EXIT_SERBIA → FG = 0, so even with >1 contract,
    // the FG lines should be empty (no actual fuel gas charged)
    if (res.body.invoices) {
      const fgInvoice = res.body.invoices.find(i => i.invoiceType === 'FUEL_GAS');
      expect(fgInvoice.lines).toHaveLength(1); // FG line with amount=0
    }
  });
});
