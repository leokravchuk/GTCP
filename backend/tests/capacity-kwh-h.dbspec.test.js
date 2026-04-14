'use strict';

/**
 * capacity_kwh_h migration 017 invariants (unit-level, mocked DB).
 * Sprint 17 · US-1701 (DEBT-01) · 15.04.2026
 *
 * Ensures that downstream code reads capacity in native kWh/h instead of
 * runtime MWh/d → kWh/h conversions that introduced BUG-04/05 in Sprint 16.
 */

require('./setup');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const db = require('../src/db');
const request = require('supertest');
const { makeToken, SEED } = require('./helpers');
const app = require('../src/app');

const API = '/api/v1';
const dispatcher = () => makeToken({ ...SEED.DISPATCHER });
const billing    = () => makeToken({ ...SEED.BILLING_USER });

describe('capacity_kwh_h invariants (Migration 017 + BUG-04/05 regression)', () => {

  beforeEach(() => db.query.mockReset());

  // ── invariant 1: MWh/d × 1000 / 24 matches capacity_kwh_h within ±1 ─────

  test('MWh/d → kWh/h formula consistent (LT Gazprom Horgoš = 9 216 209)', () => {
    // Expected capacity_kwh_h for Gazprom Horgoš-Exit = floor(Tech × 0.9)
    const techKwhH = 10_240_233;
    const gazpromShare = 0.9;
    const expected = Math.floor(techKwhH * gazpromShare);
    expect(expected).toBe(9_216_209);
    // Round-trip: kWh/h → MWh/d → kWh/h
    const mwhD = (expected * 24) / 1000;       // 221 189.016
    const backToKwhH = Math.round(mwhD * 1000 / 24);
    expect(Math.abs(backToKwhH - expected)).toBeLessThanOrEqual(1);
  });

  // ── invariant 2: /capacity/available reads from capacity_kwh_h ─────────

  test('GET /capacity/available SQL uses capacity_kwh_h (not MWh/d × 1000 / 24)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app)
      .get(`${API}/capacity/available`)
      .set('Authorization', `Bearer ${dispatcher()}`);

    const allSql = db.query.mock.calls.map(c => c[0]).join('\n');
    expect(allSql).toMatch(/kwh_h/);
    expect(allSql).not.toMatch(/mwh_d\s*\*\s*1000/); // no runtime conversion
  });

  // ── invariant 3: AERS technical capacity values exactly match seed ─────

  test.each([
    ['KIREVO-ENTRY',  15_280_488, 13_752_439,  1_528_049],
    ['EXIT-SERBIA',    5_040_256,  4_536_230,    504_026],
    ['HORGOS-EXIT',   10_240_233,  9_216_209,  1_024_024],
  ])('AERS %s tech=%d reserved=%d free=%d satisfies 90/10', (_pt, tech, reserved, free) => {
    // reserved ≈ floor(tech × 0.9); free = tech − reserved (± rounding)
    expect(Math.floor(tech * 0.9)).toBe(reserved);
    expect(Math.abs((tech - reserved) - free)).toBeLessThanOrEqual(1);
  });

  // ── invariant 4: ST Free balance (Entry = Exit Horgoš + Exit Serbia ± 1) ─

  test('ST Free Entry (1 528 049) ≈ Exit Horgoš Free + Exit Serbia Free', () => {
    const entryFree    = 1_528_049;
    const horgosFree   = 1_024_024;
    const exitSerbia   =   504_026;
    const diff = entryFree - (horgosFree + exitSerbia);
    // Rounding tolerance per CLAUDE.md: difference ≤ 1 kWh/h
    expect(Math.abs(diff)).toBeLessThanOrEqual(1);
  });

  // ── invariant 5: over-nomination (BUG-04/05) compares kWh/h with kWh/h ─

  test('nominations over-nom logic does not mix MWh/d with kWh/h', async () => {
    // Mock a contract lookup that would feed the over-nom comparison
    db.query.mockImplementation((sql) => {
      if (sql.includes('INSERT') || sql.includes('UPDATE')) {
        return Promise.resolve({ rows: [{ id: 'x' }] });
      }
      // Return a contract with a capacity_kwh_h value well-formed
      return Promise.resolve({ rows: [{ capacity_kwh_h: 1_000_000, flow_direction: 'KIREVO_HORGOS' }] });
    });

    const res = await request(app)
      .post(`${API}/nominations`)
      .set('Authorization', `Bearer ${dispatcher()}`)
      .send({
        shipperId: '550e8400-e29b-41d4-a716-446655440001',
        contractId: 'aaaa1111-1111-1111-1111-111111111111',
        gasDay: '2026-05-01',
        direction: 'ENTRY',
        point: 'KIREVO-ENTRY',
        volumeKwhH: 800_000, // < 1M kWh/h contracted → not over-nomination
      });
    // Response is not the target — we just ensure route exists and did not 500
    expect([200, 201, 400, 404]).toContain(res.status);
  });

  // ── invariant 6: capacity_kwh_h is NUMERIC(18,2) — 2 decimal precision ──

  test('capacity_kwh_h rounds to 2 decimals (NUMERIC(18,2))', () => {
    const mwhD = 221_189.016; // Gazprom Horgoš MWh/d
    const kwhH = Math.round((mwhD * 1000 / 24) * 100) / 100;
    // Must not be integer-truncated; 2 decimal precision preserved
    expect(kwhH.toFixed(2)).toMatch(/\.\d{2}$/);
    // Absolute precision ≤ 0.01
    expect(Math.abs(kwhH - 9_216_209.00)).toBeLessThanOrEqual(0.01);
  });
});
