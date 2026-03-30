'use strict';

require('./setup');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { makeToken, SECRET } = require('./helpers');

// Mock DB before requiring app
jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

// Mock argon2
jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
}));

const db = require('../src/db');
const argon2 = require('argon2');
const app = require('../src/app');

const API = '/api/v1';

describe('Auth API — /api/v1/auth', () => {

  beforeEach(() => { db.query.mockReset(); argon2.verify.mockReset(); argon2.hash.mockReset(); argon2.hash.mockResolvedValue('$argon2id$hashed'); });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /auth/login', () => {

    test('returns 400 if username is missing', async () => {
      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ password: 'test123' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Validation/i);
    });

    test('returns 400 if password is missing', async () => {
      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ username: 'admin' });
      expect(res.status).toBe(400);
    });

    test('returns 401 if user not found in DB', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ username: 'unknown', password: 'test123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid credentials/i);
    });

    test('returns 401 if password is wrong', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'admin', role: 'admin', password_hash: '$hash' }],
      });
      argon2.verify.mockResolvedValueOnce(false);

      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    test('returns 200 + JWT on valid credentials', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, username: 'admin', role: 'admin', password_hash: '$hash' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // audit insert
      argon2.verify.mockResolvedValueOnce(true);

      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ username: 'admin', password: 'admin123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.username).toBe('admin');

      // Verify token is valid
      const decoded = jwt.verify(res.body.token, SECRET);
      expect(decoded.sub).toBe(1);
      expect(decoded.role).toBe('admin');
    });

    test('token contains correct permissions for dispatcher role', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 2, username: 'dispatcher1', role: 'dispatcher', password_hash: '$hash' }],
        })
        .mockResolvedValueOnce({ rows: [] }); // audit
      argon2.verify.mockResolvedValueOnce(true);

      const res = await request(app)
        .post(`${API}/auth/login`)
        .send({ username: 'dispatcher1', password: 'disp123' });
      expect(res.status).toBe(200);

      const decoded = jwt.verify(res.body.token, SECRET);
      expect(decoded.permissions).toContain('nominations:read');
      expect(decoded.permissions).toContain('nominations:create');
      expect(decoded.permissions).not.toContain('billing:create');
    });
  });

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {

    test('returns 401 without token', async () => {
      const res = await request(app).get(`${API}/auth/me`);
      expect(res.status).toBe(401);
    });

    test('returns 401 with expired token', async () => {
      const expired = jwt.sign({ sub: 1, username: 'admin', role: 'admin', permissions: [] }, SECRET, { expiresIn: '-1s' });
      const res = await request(app)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/expired/i);
    });

    test('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get(`${API}/auth/me`)
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    test('returns user info with valid token', async () => {
      const token = makeToken({ id: 1, username: 'admin', role: 'admin' });
      const res = await request(app)
        .get(`${API}/auth/me`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('admin');
      expect(res.body.role).toBe('admin');
    });
  });

  // ── POST /auth/change-password ────────────────────────────────────────────

  describe('POST /auth/change-password', () => {

    test('returns 401 without token', async () => {
      const res = await request(app)
        .post(`${API}/auth/change-password`)
        .send({ currentPassword: 'old', newPassword: 'newpass' });
      expect(res.status).toBe(401);
    });

    test('returns 400 if newPassword too short', async () => {
      const token = makeToken();
      const res = await request(app)
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'old', newPassword: '12' });
      expect(res.status).toBe(400);
    });

    test('returns 401 if current password wrong', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: '$hash' }] });
      argon2.verify.mockResolvedValueOnce(false);

      const token = makeToken();
      const res = await request(app)
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });
      expect(res.status).toBe(401);
    });

    test('changes password successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ password_hash: '$hash' }] }) // SELECT
        .mockResolvedValueOnce({ rows: [] })  // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // audit
      argon2.verify.mockResolvedValueOnce(true);

      const token = makeToken();
      const res = await request(app)
        .post(`${API}/auth/change-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'admin123', newPassword: 'newpass123' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/changed/i);
    });
  });
});
