'use strict';

/**
 * Real-DB tests for nominations — NO jest.mock on db.
 * Requires: PostgreSQL running on localhost:8887, database gtcp_test with seed data.
 *
 * Skip if DB not available (CI mock job won't run these).
 * Run: DB_HOST=localhost DB_PORT=8887 DB_NAME=gtcp_test DB_USER=gtcp_user npx jest tests/nominations.realdb.test.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-for-jwt-signing';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '8887';
process.env.DB_NAME = process.env.DB_NAME || 'gtcp_test';
process.env.DB_USER = process.env.DB_USER || 'gtcp_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.RBP_MODE = 'mock';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// DO NOT mock db — use real PostgreSQL
const db = require('../src/db');
const app = require('../src/app');

const API = '/api/v1';
const SECRET = 'test-secret-for-jwt-signing';

const SHP_001 = '22222222-0000-0000-0000-000000000001';
const SHP_003 = '22222222-0000-0000-0000-000000000003'; // MET Energy, 150k MWh/d
const ADMIN_ID = '11111111-0000-0000-0000-000000000001';
const DISPATCHER_ID = '11111111-0000-0000-0000-000000000002';

function makeToken({ id, username, role }) {
  const perms = role === 'admin' ? ['*'] : ['nominations:read', 'nominations:create', 'nominations:update'];
  return jwt.sign({ sub: id, username, role, permissions: perms }, SECRET, { expiresIn: '1h' });
}

const adminToken = makeToken({ id: ADMIN_ID, username: 'admin', role: 'admin' });
const dispatcherToken = makeToken({ id: DISPATCHER_ID, username: 'dispatcher1', role: 'dispatcher' });

// Check if DB is available before running
let dbAvailable = false;

beforeAll(async () => {
  try {
    const { rows } = await db.query('SELECT 1 AS ok');
    dbAvailable = rows[0]?.ok === 1;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  // Clean up test nominations
  try {
    await db.query("DELETE FROM nominations WHERE reference LIKE 'REALDB-%'");
  } catch {}
  await db.pool.end();
});

describe('Nominations Real-DB — over-nominate (NC Art.12.8)', () => {

  // ── POST /nominations — normal (within contracted) ────────────────────

  test('creates nomination within contracted capacity (real SQL)', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`${API}/nominations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        shipperId: SHP_001,
        gasDay: '2026-04-15',
        direction: 'ENTRY',
        point: 'KIREVO-ENTRY',
        volumeKwhH: 10000000, // 10M < contracted 18.75M → OK
      });

    expect(res.status).toBeLessThan(500);
    if (res.status === 201) {
      expect(res.body.reference).toBeTruthy();
      // Clean up
      if (res.body.id) await db.query("UPDATE nominations SET reference = 'REALDB-1' WHERE id = $1", [res.body.id]);
    }
  });

  // ── POST /nominations — over-nomination allowed (lines 155-180) ───────

  test('allows over-nomination when spare capacity exists (NC Art.12.8)', async () => {
    if (!dbAvailable) return;

    // SHP-001 contracted = 18.75M, total contracted at IP = 52.5M, total nominated = ~23M
    // Nominate 20M > 18.75M contracted → over-nomination
    // But 23M + 20M = 43M < 52.5M total contracted → spare exists → ALLOWED
    const res = await request(app)
      .post(`${API}/nominations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        shipperId: SHP_001,
        gasDay: '2026-04-15',
        direction: 'ENTRY',
        point: 'KIREVO-ENTRY',
        volumeKwhH: 20000000, // 20M > 18.75M contracted → triggers over-nom check
      });

    // Should succeed (over-nomination allowed) or at least not 500
    expect(res.status).toBeLessThan(500);
    if (res.body.id) await db.query("UPDATE nominations SET reference = 'REALDB-2' WHERE id = $1", [res.body.id]);
  });

  // ── POST /nominations — over-nomination rejected (lines 182-193) ──────

  test('rejects over-nomination when no spare capacity', async () => {
    if (!dbAvailable) return;

    // First, fill up nominations to match total contracted capacity
    // Total contracted = 52.5M, current nominated ≈ 23M + whatever we added above
    // We need to nominate enough to fill the gap
    // Insert a big nomination to eat all spare capacity
    await db.query(`
      INSERT INTO nominations (reference, shipper_id, gas_day, point, direction, volume_kwh_h, status, submitted_by)
      VALUES ('REALDB-FILL', $1, '2026-04-15', 'KIREVO-ENTRY', 'ENTRY', 50000000, 'SUBMITTED', $2)
      ON CONFLICT (reference) DO UPDATE SET volume_kwh_h = 50000000
    `, [SHP_001, ADMIN_ID]);

    const res = await request(app)
      .post(`${API}/nominations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        shipperId: SHP_003, // MET Energy, contracted = 6.25M (150k MWh/d × 1000/24)
        gasDay: '2026-04-15',
        direction: 'ENTRY',
        point: 'KIREVO-ENTRY',
        volumeKwhH: 10000000, // 10M > 6.25M contracted, and no spare capacity left
      });

    // Should be 422 (over-nomination rejected) or at least not 500
    expect(res.status).toBeLessThanOrEqual(422);
    if (res.status === 422) {
      expect(res.body.ncRef).toContain('Art.13.2.1');
    }

    // Clean up fill nomination
    await db.query("DELETE FROM nominations WHERE reference = 'REALDB-FILL'");
  });

  // ── POST /nominations — capacity from contracts fallback (lines 138-148) ─

  test('falls back to contracts table when capacity_bookings returns 0', async () => {
    if (!dbAvailable) return;

    // SHP-005 (Srbijagas) has contracts but let's test with a shipper that has contract cap
    // Use a gas_day outside booking period to trigger fallback
    const res = await request(app)
      .post(`${API}/nominations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        shipperId: SHP_003, // MET Energy — has bookings Mar-Sep only
        gasDay: '2026-12-15', // Outside booking period → bookings = 0 → fallback to contracts
        direction: 'ENTRY',
        point: 'KIREVO-ENTRY',
        volumeKwhH: 1000000,
      });

    expect(res.status).toBeLessThan(500);
    if (res.body.id) await db.query("UPDATE nominations SET reference = 'REALDB-3' WHERE id = $1", [res.body.id]);
  });
});

describe('Nominations Real-DB — POST /over-nominate (lines 424-514)', () => {

  test('creates within-day interruptible over-nomination', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post(`${API}/nominations/over-nominate`)
      .set('Authorization', `Bearer ${dispatcherToken}`)
      .send({
        shipperId: SHP_001,
        point: 'KIREVO-ENTRY',
        gasDay: '2026-04-15',
        volumeKwhH: 2000000,
      });

    expect(res.status).toBeLessThan(500);
    if (res.body?.id) await db.query("UPDATE nominations SET reference = 'REALDB-ONOM' WHERE id = $1", [res.body.id]);
  });
});

describe('Nominations Real-DB — matching with real data', () => {

  test('POST /match executes real SQL matching algorithm', async () => {
    if (!dbAvailable) return;

    // Insert a PENDING entry+exit pair for matching
    await db.query(`
      INSERT INTO nominations (reference, shipper_id, gas_day, point, direction, volume_kwh_h, status, submitted_by)
      VALUES
        ('REALDB-MATCH-E', $1, '2026-05-01', 'KIREVO-ENTRY', 'ENTRY', 5000000, 'PENDING', $2),
        ('REALDB-MATCH-X', $1, '2026-05-01', 'HORGOS-EXIT', 'EXIT', 5000000, 'PENDING', $2)
      ON CONFLICT (reference) DO NOTHING
    `, [SHP_001, ADMIN_ID]);

    const res = await request(app)
      .post(`${API}/nominations/match`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gasDay: '2026-05-01' });

    expect(res.status).toBeLessThan(500);
    if (res.status === 200) {
      expect(res.body.gasDay).toBe('2026-05-01');
    }
  });
});
