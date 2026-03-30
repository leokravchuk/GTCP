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

describe('Contracts API — /api/v1/contracts', () => {

  beforeEach(() => { db.query.mockReset(); });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const contractsToken = () => makeToken({ ...SEED.CONTRACTS_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  // ── GET /contracts ────────────────────────────────────────────────────────

  describe('GET /contracts', () => {

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/contracts`);
      expect(res.status).toBe(401);
    });

    test('returns contract list for admin', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, code: 'CT R-2026-001', contract_type: 'TSA_FIRM_ANNUAL', status: 'ACTIVE' },
          { id: 2, code: 'CT R-2026-002', contract_type: 'TSA_FIRM_MONTHLY', status: 'ACTIVE' },
        ],
      });
      const res = await request(app)
        .get(`${API}/contracts`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    test('contracts role can read', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/contracts`)
        .set('Authorization', `Bearer ${contractsToken()}`);
      expect(res.status).toBe(200);
    });

    test('dispatcher can read contracts', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/contracts`)
        .set('Authorization', `Bearer ${dispatcherToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GET /contracts/:id ────────────────────────────────────────────────────

  describe('GET /contracts/:id', () => {

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get(`${API}/contracts/999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });

    test('returns single contract with shipper info', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1, code: 'CT R-2026-001', contract_type: 'TSA_FIRM_ANNUAL',
          status: 'ACTIVE', shipper_code: 'SHP-001', shipper_name: 'Газпром Экспорт',
        }],
      });
      const res = await request(app)
        .get(`${API}/contracts/1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('CT R-2026-001');
      expect(res.body.shipper_code).toBe('SHP-001');
    });
  });

  // ── POST /contracts ───────────────────────────────────────────────────────

  describe('POST /contracts', () => {

    const validContract = {
      shipperId: '550e8400-e29b-41d4-a716-446655440001',
      contractType: 'TSA_FIRM_ANNUAL',
      flowDirection: 'KIREVO_HORGOS',
      capEntryKwhH: 13752230,
      capExitKwhH: 9216209,
      startDate: '2026-10-01',
      endDate: '2027-09-30',
    };

    test('returns 403 for dispatcher (no contracts:create)', async () => {
      const res = await request(app)
        .post(`${API}/contracts`)
        .set('Authorization', `Bearer ${dispatcherToken()}`)
        .send(validContract);
      expect(res.status).toBe(403);
    });

    test('returns 400 if shipperId not UUID', async () => {
      const res = await request(app)
        .post(`${API}/contracts`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...validContract, shipperId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    test('creates contract with valid data', async () => {
      const created = { id: 10, code: 'CT R-2026-010', status: 'DRAFT' };
      db.query
        .mockResolvedValueOnce({ rows: [{ cnt: '9' }] })     // nextContractNo
        .mockResolvedValueOnce({ rows: [created] })           // INSERT
        .mockResolvedValueOnce({ rows: [] });                 // audit

      const res = await request(app)
        .post(`${API}/contracts`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(validContract);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
    });

    test('contracts role can create', async () => {
      const created = { id: 11, code: 'CT R-2026-011', status: 'DRAFT' };
      db.query
        .mockResolvedValueOnce({ rows: [{ cnt: '10' }] })
        .mockResolvedValueOnce({ rows: [created] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`${API}/contracts`)
        .set('Authorization', `Bearer ${contractsToken()}`)
        .send(validContract);
      expect(res.status).toBe(201);
    });
  });

  // ── PATCH /contracts/:id/status ───────────────────────────────────────────

  describe('PATCH /contracts/:id', () => {

    test('returns 400 if no valid fields', async () => {
      const res = await request(app)
        .patch(`${API}/contracts/1`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ invalidField: 'test' });
      expect(res.status).toBe(400);
    });

    test('returns 404 if contract not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch(`${API}/contracts/999`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(404);
    });

    test('updates status DRAFT → ACTIVE', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'ACTIVE', code: 'CT R-2026-001' }] });

      const res = await request(app)
        .patch(`${API}/contracts/1`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'ACTIVE' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });
  });
});
