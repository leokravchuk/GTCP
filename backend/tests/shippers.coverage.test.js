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

describe('Shippers Coverage — NC Art.3 Lifecycle', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const creditToken = () => makeToken({ ...SEED.CREDIT_USER });

  // ── POST /shippers/apply — NC Art.3.3 ─────────────────────────────────

  describe('POST /shippers/apply', () => {

    test('creates APPLICANT shipper', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ c: '5' }] })  // COUNT for code
        .mockResolvedValueOnce({ rows: [{ id: 6, code: 'SHP-006', status: 'APPLICANT', name: 'New Co' }] })
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .post(`${API}/shippers/apply`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'New Company LLC', country_of_incorporation: 'RS', credit_limit: 1000000 });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPLICANT');
      expect(res.body.ncRef).toContain('Art.3.3');
    });

    test('returns 400 if name missing', async () => {
      const res = await request(app)
        .post(`${API}/shippers/apply`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ country_of_incorporation: 'RS' });
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /shippers/:id/status — NC Art.3 lifecycle ───────────────────

  describe('PATCH /shippers/:id/status', () => {

    test('APPLICANT → APPROVED', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'APPLICANT' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED' }] })
        .mockResolvedValueOnce({ rows: [] })  // shipper_changes
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'APPROVED' });
      expect(res.status).toBe(200);
      expect(res.body.transition).toBe('APPLICANT → APPROVED');
    });

    test('APPROVED → ACTIVE (sets gta_executed_at)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'APPROVED' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'ACTIVE', gta_executed_at: '2026-03-30' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(200);
    });

    test('ACTIVE → SUSPENDED', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'SUSPENDED' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'SUSPENDED', reason: 'Credit support issue NC Art.7.5.4' });
      expect(res.status).toBe(200);
    });

    test('SUSPENDED → ACTIVE (reinstate)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'SUSPENDED' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(200);
    });

    test('ACTIVE → REMOVED (checks capacity + debt)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ total_cap: '0' }] })   // capacity check
        .mockResolvedValueOnce({ rows: [{ total_debt: '0' }] })  // debt check
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'REMOVED', is_active: false }] })
        .mockResolvedValueOnce({ rows: [] })  // shipper_changes
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'REMOVED', reason: 'Voluntary withdrawal' });
      expect(res.status).toBe(200);
    });

    test('REMOVED rejected if active capacity (NC Art.3.7.1)', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ total_cap: '5000000' }] }); // has capacity
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'REMOVED' });
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('Art.3.7.1');
    });

    test('REMOVED rejected if outstanding debt', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'ACTIVE' }] })
        .mockResolvedValueOnce({ rows: [{ total_cap: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_debt: '50000' }] }); // has debt
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'REMOVED' });
      expect(res.status).toBe(422);
      expect(res.body.ncRef).toContain('Art.3.7.1');
    });

    test('rejects invalid transition APPLICANT → ACTIVE', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'APPLICANT' }] });
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(422);
      expect(res.body.allowed).toEqual(['APPROVED', 'REMOVED']);
    });

    test('REMOVED is terminal — cannot transition from it', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, code: 'SHP-001', status: 'REMOVED' }] });
      const res = await request(app)
        .patch(`${API}/shippers/1/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(422);
      expect(res.body.allowed).toEqual([]);
    });

    test('returns 404 if shipper not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/shippers/999/status`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'APPROVED' });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /shippers/:id/history ─────────────────────────────────────────

  describe('GET /shippers/:id/history', () => {
    test('returns change audit trail', async () => {
      db.query.mockResolvedValue({ rows: [
        { field_name: 'status', old_value: 'APPLICANT', new_value: 'APPROVED', changed_by_name: 'admin' },
      ] });
      const res = await request(app)
        .get(`${API}/shippers/1/history`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });
});
