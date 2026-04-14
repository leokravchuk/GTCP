'use strict';

/**
 * CSV export endpoints (US-1706) + csvExport utility.
 * Sprint 17 · 15.04.2026
 */

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');
const { rowsToCsv, escapeCell } = require('../src/utils/csvExport');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/db');
const app = require('../src/app');

const API = '/api/v1';
const admin      = () => makeToken({ ...SEED.ADMIN_USER });
const billing    = () => makeToken({ ...SEED.BILLING_USER });
const contracts  = () => makeToken({ ...SEED.CONTRACTS_USER });
const dispatcher = () => makeToken({ ...SEED.DISPATCHER });

// ── rowsToCsv / escapeCell ─────────────────────────────────────────────────

describe('csvExport utility', () => {
  test('escapeCell wraps comma / quote / newline values in quotes', () => {
    expect(escapeCell('simple')).toBe('simple');
    expect(escapeCell('has,comma')).toBe('"has,comma"');
    expect(escapeCell('has "quote"')).toBe('"has ""quote"""');
    expect(escapeCell('line\nbreak')).toBe('"line\nbreak"');
  });

  test('escapeCell handles null / undefined / Date', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell(new Date('2026-04-15T12:00:00Z'))).toBe('2026-04-15T12:00:00.000Z');
  });

  test('rowsToCsv prepends BOM for Excel compatibility', () => {
    const csv = rowsToCsv([{ a: 1 }], [{ key: 'a', header: 'A' }]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
  });

  test('rowsToCsv with empty rows emits only header row when columns provided', () => {
    const csv = rowsToCsv([], [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]);
    expect(csv.replace('\ufeff', '')).toBe('A,B\n');
  });

  test('rowsToCsv serializes multiple rows with header', () => {
    const csv = rowsToCsv(
      [{ a: 1, b: 'x' }, { a: 2, b: 'y,z' }],
      [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]
    );
    const body = csv.replace('\ufeff', '');
    expect(body).toContain('A,B\n');
    expect(body).toContain('1,x\n');
    expect(body).toContain('2,"y,z"\n');
  });
});

// ── /billing/export ─────────────────────────────────────────────────────────

describe('GET /billing/export', () => {
  beforeEach(() => db.query.mockReset());

  test('requires auth', async () => {
    const res = await request(app).get(`${API}/billing/export`);
    expect(res.status).toBe(401);
  });

  test('returns CSV with correct headers', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        invoice_no: 'INV-2026-0008', shipper_code: 'SHP-002', shipper_name: 'NIS',
        period_from: '2026-03-31', period_to: '2026-04-29', billing_days: 30,
        flow_direction: 'KIREVO_EXIT_SERBIA',
        cap_entry_kwh_h: '4000209', cap_exit_kwh_h: '4000209',
        cap_entry_fee_eur: '1972705.81', cap_exit_fee_eur: '1377606.22',
        fuel_gas_kwh: '0', fuel_gas_amount_eur: '0.00',
        total_amount_eur: '3350312.03', status: 'DRAFT',
        due_date: '2026-05-18', created_at: '2026-04-09T08:00:00Z',
      }],
    });

    const res = await request(app)
      .get(`${API}/billing/export`)
      .set('Authorization', `Bearer ${billing()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/billing-invoices-\d{4}-\d{2}-\d{2}\.csv/);
    expect(res.text).toContain('Invoice No,Shipper');
    expect(res.text).toContain('INV-2026-0008');
    expect(res.text).toContain('3350312.03');
  });

  test('applies status + shipper_id filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/billing/export?status=ISSUED&shipper_id=abc`)
      .set('Authorization', `Bearer ${billing()}`);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/i\.status/);
    expect(params).toEqual(expect.arrayContaining(['ISSUED', 'abc']));
  });

  test('empty result emits header-only CSV', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`${API}/billing/export`)
      .set('Authorization', `Bearer ${billing()}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Invoice No,Shipper');
    expect(res.text.split('\n').length).toBe(2); // header + empty line
  });
});

// ── /contracts/export ───────────────────────────────────────────────────────

describe('GET /contracts/export', () => {
  beforeEach(() => db.query.mockReset());

  test('returns CSV with contract fields', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        contract_no: 'CTR-2026-001', shipper_code: 'SHP-001', shipper_name: 'Gazprom',
        contract_type: 'FIRM_YEARLY', flow_direction: 'KIREVO_HORGOS', status: 'ACTIVE',
        cap_entry_kwh_h: '9216209', cap_exit_kwh_h: '9216209',
        tariff_entry_eur_kwh_h: '6.00', tariff_exit_eur_kwh_h: '6.85',
        period_from: '2025-10-01', period_to: '2026-09-30',
        created_at: '2025-07-01T08:00:00Z',
      }],
    });

    const res = await request(app)
      .get(`${API}/contracts/export`)
      .set('Authorization', `Bearer ${contracts()}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Contract No');
    expect(res.text).toContain('CTR-2026-001');
    expect(res.text).toContain('KIREVO_HORGOS');
  });

  test('filters by flow_direction', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/contracts/export?flow_direction=KIREVO_HORGOS&status=ACTIVE`)
      .set('Authorization', `Bearer ${contracts()}`);
    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual(expect.arrayContaining(['ACTIVE', 'KIREVO_HORGOS']));
  });
});

// ── /nominations/export ─────────────────────────────────────────────────────

describe('GET /nominations/export', () => {
  beforeEach(() => db.query.mockReset());

  test('returns CSV with nomination fields', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        reference: 'NOM-2026-00001', shipper_code: 'SHP-001', shipper_name: 'Gazprom',
        gas_day: '2026-05-01', direction: 'ENTRY', point: 'KIREVO-ENTRY',
        volume_kwh_h: '9000000', contracted_kwh_h: '9216209',
        matched_kwh_h: '8000000', allocated_kwh_h: '8000000',
        is_over_nomination: false, status: 'MATCHED', gas_day_cycle: 0,
        submitted_at: '2026-04-30T13:50:00Z',
      }],
    });

    const res = await request(app)
      .get(`${API}/nominations/export`)
      .set('Authorization', `Bearer ${dispatcher()}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Reference,Shipper');
    expect(res.text).toContain('NOM-2026-00001');
    expect(res.text).toContain('KIREVO-ENTRY');
  });

  test('filters by gas_day range (from/to)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/nominations/export?from=2026-04-01&to=2026-04-30`)
      .set('Authorization', `Bearer ${dispatcher()}`);
    const [, params] = db.query.mock.calls[0];
    expect(params).toEqual(expect.arrayContaining(['2026-04-01', '2026-04-30']));
  });

  test('filters by status', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/nominations/export?status=MATCHED_ADJACENT`)
      .set('Authorization', `Bearer ${dispatcher()}`);
    const [, params] = db.query.mock.calls[0];
    expect(params).toContain('MATCHED_ADJACENT');
  });

  test('dispatcher cannot access billing export (different permission)', async () => {
    const res = await request(app)
      .get(`${API}/billing/export`)
      .set('Authorization', `Bearer ${dispatcher()}`);
    expect(res.status).toBe(403);
  });
});
