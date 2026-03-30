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

describe('Shippers API — /api/v1/shippers', () => {

  beforeEach(() => { db.query.mockReset(); });

  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const billingToken = () => makeToken({ ...SEED.BILLING_USER });

  // ── GET /shippers ─────────────────────────────────────────────────────────

  describe('GET /shippers', () => {

    test('returns 401 without auth', async () => {
      const res = await request(app).get(`${API}/shippers`);
      expect(res.status).toBe(401);
    });

    test('returns shipper list for admin', async () => {
      db.query.mockResolvedValueOnce({
        rows: [SEED.SHIPPER_1, SEED.SHIPPER_2],
      });

      const res = await request(app)
        .get(`${API}/shippers`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].code).toBe('SHP-001');
    });

    test('billing role can read shippers (has shippers:read)', async () => {
      db.query.mockResolvedValueOnce({ rows: [SEED.SHIPPER_1] });

      const res = await request(app)
        .get(`${API}/shippers`)
        .set('Authorization', `Bearer ${billingToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ── GET /shippers/:id ─────────────────────────────────────────────────────

  describe('GET /shippers/:id', () => {

    test('returns 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`${API}/shippers/999`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(404);
    });

    test('returns single shipper', async () => {
      db.query.mockResolvedValueOnce({ rows: [SEED.SHIPPER_1] });

      const res = await request(app)
        .get(`${API}/shippers/1`)
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe('SHP-001');
    });
  });

  // ── POST /shippers ────────────────────────────────────────────────────────

  describe('POST /shippers', () => {

    test('returns 400 if code is missing', async () => {
      const res = await request(app)
        .post(`${API}/shippers`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Test', creditLimit: 1000 });
      expect(res.status).toBe(400);
    });

    test('returns 400 if creditLimit is not numeric', async () => {
      const res = await request(app)
        .post(`${API}/shippers`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ code: 'SHP-099', name: 'Test', creditLimit: 'not-a-number' });
      expect(res.status).toBe(400);
    });

    test('creates shipper with valid data', async () => {
      const newShipper = { id: 10, code: 'SHP-099', name: 'New Shipper', credit_limit: 1000000 };
      db.query
        .mockResolvedValueOnce({ rows: [newShipper] })  // INSERT
        .mockResolvedValueOnce({ rows: [] });            // audit
      const res = await request(app)
        .post(`${API}/shippers`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ code: 'SHP-099', name: 'New Shipper', creditLimit: 1000000 });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe('SHP-099');
    });

    test('returns 403 for billing role (no shippers:create)', async () => {
      const res = await request(app)
        .post(`${API}/shippers`)
        .set('Authorization', `Bearer ${billingToken()}`)
        .send({ code: 'SHP-099', name: 'Test', creditLimit: 1000 });
      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /shippers/:id ───────────────────────────────────────────────────

  describe('PATCH /shippers/:id', () => {

    test('returns 400 if no valid fields', async () => {
      const res = await request(app)
        .patch(`${API}/shippers/999`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ invalidField: 'test' });
      expect(res.status).toBe(400);
    });

    test('returns 404 if shipper not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

      const res = await request(app)
        .patch(`${API}/shippers/999`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    test('updates shipper name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ ...SEED.SHIPPER_1, name: 'Updated' }] }) // UPDATE RETURNING
        .mockResolvedValueOnce({ rows: [] }); // audit

      const res = await request(app)
        .patch(`${API}/shippers/1`)
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });
  });
});
