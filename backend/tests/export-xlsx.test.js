'use strict';

/**
 * Excel (xlsx) export tests — Sprint 18 · US-1804
 */

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');
const ExcelJS = require('exceljs');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

describe('Excel (xlsx) Export — US-1804', () => {
  beforeEach(() => { db.query.mockReset(); });
  const billingToken  = () => makeToken({ ...SEED.BILLING_USER });
  const adminToken    = () => makeToken({ ...SEED.ADMIN_USER });
  const contractToken = () => makeToken({ ...SEED.CONTRACTS_USER });

  // ── Billing xlsx ────────────────────────────────────────────────────────

  test('GET /billing/export?format=xlsx returns valid xlsx with headers', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { invoice_no: 'INV-2026-0001', shipper_code: 'SHP-001', shipper_name: 'Газпром',
        period_from: '2026-01-01', period_to: '2026-01-31', billing_days: 31,
        flow_direction: 'KIREVO_HORGOS', cap_entry_kwh_h: 13752230, cap_exit_kwh_h: 9216209,
        cap_entry_fee_eur: 2264.17, cap_exit_fee_eur: 1704.12,
        fuel_gas_kwh: 0, fuel_gas_amount_eur: 0,
        total_amount_eur: 3968.29, status: 'ISSUED', due_date: '2026-02-20', created_at: '2026-01-05' },
    ] });

    const res = await request(app)
      .get(`${API}/billing/export?format=xlsx`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('.xlsx');

    // Parse the xlsx buffer
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Billing Invoices');
    expect(ws.getRow(1).getCell(1).value).toBe('Invoice No');
    expect(ws.getRow(2).getCell(1).value).toBe('INV-2026-0001');
    // Numeric fields should be numbers
    expect(typeof ws.getRow(2).getCell(8).value).toBe('number'); // cap_entry_kwh_h
  });

  // ── Contracts xlsx ──────────────────────────────────────────────────────

  test('GET /contracts/export?format=xlsx returns valid xlsx', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { contract_no: 'GTA-2025-001', shipper_code: 'SHP-001', shipper_name: 'Газпром',
        contract_type: 'FIRM_YEARLY', flow_direction: 'KIREVO_HORGOS', status: 'ACTIVE',
        cap_entry_kwh_h: 13752230, cap_exit_kwh_h: 9216209, capacity_kwh_h: null,
        tariff_entry_eur_kwh_h: 6.00, tariff_exit_eur_kwh_h: 6.85,
        period_from: '2025-10-01', period_to: '2026-09-30', created_at: '2025-09-15' },
    ] });

    const res = await request(app)
      .get(`${API}/contracts/export?format=xlsx`)
      .set('Authorization', `Bearer ${contractToken()}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Contracts');
    expect(ws.getRow(1).getCell(1).value).toBe('Contract No');
  });

  // ── Nominations xlsx ────────────────────────────────────────────────────

  test('GET /nominations/export?format=xlsx returns valid xlsx', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { reference: 'NOM-2026-00001', shipper_code: 'SHP-001', shipper_name: 'Газпром',
        gas_day: '2026-04-15', direction: 'ENTRY', point: 'KIREVO-ENTRY',
        volume_kwh_h: 10000000, contracted_kwh_h: 13752230, matched_kwh_h: 10000000,
        allocated_kwh_h: 10000000, is_over_nomination: false, status: 'MATCHED',
        gas_day_cycle: 'D-1', submitted_at: '2026-04-14T12:00:00Z' },
    ] });

    const res = await request(app)
      .get(`${API}/nominations/export?format=xlsx`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Nominations');
    expect(ws.getRow(2).getCell(1).value).toBe('NOM-2026-00001');
  });

  // ── Empty result xlsx ───────────────────────────────────────────────────

  test('xlsx export with empty result returns headers-only file', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/billing/export?format=xlsx`)
      .set('Authorization', `Bearer ${billingToken()}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe('Invoice No');
    expect(ws.rowCount).toBe(1); // header only
  });

  // ── CSV still works (regression) ────────────────────────────────────────

  test('GET /billing/export without format still returns CSV', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/billing/export`)
      .set('Authorization', `Bearer ${billingToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });
});
