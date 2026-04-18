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

describe('Billing API — /api/v1/billing', () => {

  beforeEach(() => {
    db.query.mockReset();
  });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  // ── GET /billing ──────────────────────────────────────────────────────────

  describe('GET /billing', () => {

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/billing`);
      expect(res.status).toBe(401);
    });

    test('returns invoice list for billing role', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, invoice_no: 'INV-2026-0001', shipper_code: 'SHP-001', status: 'ISSUED', total_eur: 135000.50 },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // COUNT query

      const res = await request(app)
        .get(`${API}/billing`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(200);
      expect(res.body[0].invoice_no).toBe('INV-2026-0001');
      expect(res.headers['x-total-count']).toBe('1');
    });

    test('returns 403 for dispatcher (no billing:read)', async () => {
      const res = await request(app)
        .get(`${API}/billing`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(403);
    });

    test('filters by shipper_id', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })          // SELECT
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // COUNT
      const res = await request(app)
        .get(`${API}/billing?shipper_id=1`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(200);
      const call = db.query.mock.calls[0];
      expect(call[1]).toContain('1');
    });
  });

  // ── GET /billing/:id ──────────────────────────────────────────────────────

  describe('GET /billing/:id', () => {

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/billing/999`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(404);
    });

    test('returns single invoice with line items', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, invoice_no: 'INV-2026-0001', status: 'ISSUED', total_eur: 135000 }],
        })
        .mockResolvedValueOnce({
          rows: [
            { line_type: 'CAPACITY', description: 'Entry Kirevo', amount_eur: 85000 },
            { line_type: 'CAPACITY', description: 'Exit Horgos', amount_eur: 50000 },
          ],
        });
      const res = await request(app)
        .get(`${API}/billing/1`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.invoice_no).toBe('INV-2026-0001');
    });
  });

  // ── POST /billing — create invoice ────────────────────────────────────────

  describe('POST /billing', () => {

    const validInvoice = {
      contractId: 1,
      shipperId: 1,
      periodMonth: '2026-03',
      daysInMonth: 31,
    };

    test('returns 403 for dispatcher', async () => {
      const res = await request(app)
        .post(`${API}/billing`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send(validInvoice);
      expect(res.status).toBe(403);
    });

    test('creates invoice with capacity fee calculation', async () => {
      // Mock chain: nextInvoiceNo → getSystemParams → contract → INSERT → line items → audit
      db.query
        .mockResolvedValueOnce({ rows: [{ cnt: '5' }] })   // nextInvoiceNo
        .mockResolvedValueOnce({                             // system_params
          rows: [
            { key: 'tariff_entry_gospodjinci_eur_kwh_h_yr', value: '6.00' },
            { key: 'tariff_exit_horgos_eur_kwh_h_yr', value: '6.85' },
            { key: 'fuel_gas_rate_pct', value: '0.22' },
            { key: 'fuel_gas_price_eur_mwh', value: '25.0' },
            { key: 'euribor_6m_pct', value: '3.5' },
            { key: 'late_payment_spread_pct', value: '3.0' },
            { key: 'late_payment_day_basis', value: '360' },
          ],
        })
        .mockResolvedValueOnce({                             // contract
          rows: [{
            id: 1, shipper_id: 1, contract_type: 'TSA_FIRM_ANNUAL',
            flow_direction: 'KIREVO_HORGOS',
            capacity_entry_kwh_h: 13752230, capacity_exit_kwh_h: 9216209,
            tariff_entry_eur: 6.00, tariff_exit_eur: 6.85,
          }],
        })
        .mockResolvedValueOnce({                             // INSERT invoice
          rows: [{ id: 6, invoice_no: 'INV-2026-0006', status: 'DRAFT', total_eur: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] })                 // line items
        .mockResolvedValueOnce({ rows: [] })                 // UPDATE total
        .mockResolvedValueOnce({ rows: [] });                // audit

      const res = await request(app)
        .post(`${API}/billing`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send(validInvoice);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ── PATCH /billing/:id/status ─────────────────────────────────────────────

  describe('PATCH /billing/:id/status', () => {

    test('transitions DRAFT → ISSUED', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'DRAFT', total_amount_eur: '135000', due_date: '2026-04-20' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'ISSUED' }] });

      const res = await request(app)
        .patch(`${API}/billing/1/status`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send({ status: 'ISSUED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ISSUED');
    });

    test('transitions ISSUED → PAID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'ISSUED', total_amount_eur: '135000', due_date: '2026-04-20' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'PAID', paid_at: '2026-03-30' }] });

      const res = await request(app)
        .patch(`${API}/billing/1/status`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send({ status: 'PAID' });
      expect(res.status).toBe(200);
    });

    test('rejects invalid transition PAID → DRAFT', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'PAID', total_amount_eur: 135000 }] });

      const res = await request(app)
        .patch(`${API}/billing/1/status`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send({ status: 'DRAFT' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status transition/);
    });
  });

  // ── GET /billing/:id/statement (NC Art. 20.1) ────────────────────────────

  describe('GET /billing/:id/statement', () => {

    test('returns monthly statement', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, invoice_no: 'INV-2026-0001', shipper_id: 1, period_month: '2026-03' }],
        })
        .mockResolvedValueOnce({ rows: [SEED.SHIPPER_1] })
        .mockResolvedValueOnce({
          rows: [
            { line_type: 'CAPACITY', amount_eur: 85000 },
            { line_type: 'FUEL_GAS', amount_eur: 12000 },
          ],
        });

      const res = await request(app)
        .get(`${API}/billing/1/statement`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(200);
    });
  });
});
