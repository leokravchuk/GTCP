'use strict';

/**
 * Edge cases & defensive branch coverage:
 * - authorize.js: !req.user branch
 * - edigasService.js: unused legacy functions
 * - nominations production-only rejection
 * - auctions validate() false on bad query params
 */

require('./setup');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { makeToken, SEED, SECRET } = require('./helpers');

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

// ═════════════════════════════════════════════════════════════════════════════
// authorize.js — !req.user branch (line 13)
// ═════════════════════════════════════════════════════════════════════════════

describe('authorize.js edge cases', () => {

  test('returns 403 if role does not have permission', () => {
    // billing role does NOT have nominations:read
    const token = makeToken({ ...SEED.BILLING_USER });
    return request(app)
      .get(`${API}/nominations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  test('returns 403 with required permission in body', async () => {
    const token = makeToken({ id: 99, username: 'nobody', role: 'nobody' });
    const res = await request(app)
      .get(`${API}/shippers`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.required).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// edigasService.js — legacy functions coverage
// ═════════════════════════════════════════════════════════════════════════════

describe('edigasService — all functions', () => {
  const edigas = require('../src/services/edigasService');

  test('generateNominationXml returns XML string', async () => {
    const xml = await edigas.generateNominationXml({ reference: 'NOM-001' });
    expect(xml).toContain('<?xml');
    expect(xml).toContain('NOM-001');
  });

  test('generateConfirmationXml returns XML string', async () => {
    const xml = await edigas.generateConfirmationXml({ reference: 'NOM-001', status: 'CONFIRMED' });
    expect(xml).toContain('CONFIRMED');
  });

  test('buildNomint returns NOMINT XML', () => {
    const xml = edigas.buildNomint({ reference: 'NOM-001', volume_kwh: 5000000 }, { eic_code: '21X' });
    expect(xml).toContain('NominationDocument');
    expect(xml).toContain('21X');
  });

  test('buildRenomint returns RENOMINT XML', () => {
    const xml = edigas.buildRenomint({ reference: 'NOM-R2', volume_kwh: 5500000 }, { eic_code: '21X' });
    expect(xml).toContain('RenominationDocument');
  });

  test('submitToTso returns mock success in test env', async () => {
    const r = await edigas.submitToTso('<xml/>', 'nom-123');
    expect(r.success).toBe(true);
    expect(r.nomres.status).toBe('ACCEPTED');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auctions.js — validate() return false on bad params
// ═════════════════════════════════════════════════════════════════════════════

describe('auctions validate() branches', () => {
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('POST /bids with non-integer auction_calendar_id → 400', async () => {
    const res = await request(app)
      .post(`${API}/auctions/bids`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ auction_calendar_id: 'abc', shipper_id: 1, bid_capacity_kwh_h: 5000 });
    expect(res.status).toBe(400);
  });

  test('PATCH /bids/:id with non-integer id → 400', async () => {
    const res = await request(app)
      .patch(`${API}/auctions/bids/abc`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ bid_capacity_kwh_h: 5000 });
    expect(res.status).toBe(400);
  });

  test('POST /bids/:id/submit with non-integer id → 400', async () => {
    const res = await request(app)
      .post(`${API}/auctions/bids/abc/submit`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  test('POST /bids/:id/result with invalid result → 400', async () => {
    const res = await request(app)
      .post(`${API}/auctions/bids/100/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'MAYBE' });
    expect(res.status).toBe(400);
  });

  test('DELETE /bids/:id with non-integer id → 400', async () => {
    const res = await request(app)
      .delete(`${API}/auctions/bids/abc`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  test('GET /calendar with invalid product_type → 400', async () => {
    const res = await request(app)
      .get(`${API}/auctions/calendar?product_type=INVALID`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });

  test('GET /bids/:id with non-integer → 400', async () => {
    const res = await request(app)
      .get(`${API}/auctions/bids/abc`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// authenticate.js — all token error types
// ═════════════════════════════════════════════════════════════════════════════

describe('authenticate edge cases', () => {

  test('malformed Authorization header (no Bearer prefix)', async () => {
    const res = await request(app)
      .get(`${API}/shippers`)
      .set('Authorization', 'Token abc123');
    expect(res.status).toBe(401);
  });

  test('empty Authorization header', async () => {
    const res = await request(app)
      .get(`${API}/shippers`)
      .set('Authorization', '');
    expect(res.status).toBe(401);
  });

  test('token signed with wrong secret', async () => {
    const badToken = jwt.sign({ sub: 1, username: 'admin', role: 'admin' }, 'wrong-secret');
    const res = await request(app)
      .get(`${API}/shippers`)
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid token');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditService — error handling branch
// ═════════════════════════════════════════════════════════════════════════════

describe('auditService error handling', () => {
  const { addAudit } = require('../src/services/auditService');

  test('audit failure does not throw', async () => {
    db.query.mockRejectedValueOnce(new Error('audit_log table not found'));
    // Should not throw — audit failures are swallowed
    await expect(addAudit({
      actionType: 'TEST', entityType: 'test', entityId: 1,
      userId: 1, username: 'test',
    })).resolves.toBeUndefined();
  });
});
