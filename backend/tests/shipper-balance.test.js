'use strict';

/**
 * Shipper balance invariants (NC Art.12.3 + Sprint 16 LT Booking Rules).
 * Sprint 17 · US-1701 (DEBT-01) · 15.04.2026
 *
 * Binding rules (CLAUDE.md "LT Booking Rules"):
 *   - Γазпром HORGOS-EXIT = floor(Tech × 0.9) = 9,216,209 kWh/h.
 *   - LT total per IP ≤ floor(Tech × 0.9).
 *   - Each shipper's Σ Entry = Σ Exit (NC Art.12.3).
 *   - ST = 10% pool is fully free for Quarterly/Monthly/Daily/WD auctions.
 */

require('./setup');

// Authoritative seed snapshot (from CLAUDE.md "Current LT Bookings").
const LT_BOOKINGS = {
  'SHP-001': { // Gazprom
    'KIREVO-ENTRY': 9_752_230,
    'HORGOS-EXIT':  9_216_209,
    'EXIT-SERBIA':    536_021,
  },
  'SHP-002': { // NIS
    'KIREVO-ENTRY': 4_000_209,
    'HORGOS-EXIT':          0,
    'EXIT-SERBIA':  4_000_209,
  },
};

const TECH_CAPACITY = {
  'KIREVO-ENTRY': 15_280_488,
  'EXIT-SERBIA':   5_040_256,
  'HORGOS-EXIT':  10_240_233,
};

describe('Shipper balance invariants (NC Art.12.3 + LT Booking Rules)', () => {

  // ── Invariant 1: Σ Entry = Σ Exit per shipper (Art.12.3) ──────────────

  test.each(Object.keys(LT_BOOKINGS))('shipper %s: Σ Entry === Σ Exit', (code) => {
    const b = LT_BOOKINGS[code];
    const entry = b['KIREVO-ENTRY'];
    const exit = b['HORGOS-EXIT'] + b['EXIT-SERBIA'];
    expect(entry).toBe(exit);
  });

  // ── Invariant 2: LT total per IP equals floor(Tech × 0.9) ─────────────

  test.each([
    ['KIREVO-ENTRY', 13_752_439],
    ['HORGOS-EXIT',   9_216_209],
    ['EXIT-SERBIA',   4_536_230],
  ])('LT total at %s = %d (floor of Tech × 0.9)', (point, expectedTotal) => {
    const sum = LT_BOOKINGS['SHP-001'][point] + LT_BOOKINGS['SHP-002'][point];
    expect(sum).toBe(expectedTotal);
    expect(sum).toBe(Math.floor(TECH_CAPACITY[point] * 0.9));
  });

  // ── Invariant 3: Gazprom HORGOS-EXIT is exactly 90% of Tech ───────────

  test('Gazprom HORGOS-EXIT = 9,216,209 (floor of 10,240,233 × 0.9)', () => {
    expect(LT_BOOKINGS['SHP-001']['HORGOS-EXIT'])
      .toBe(Math.floor(TECH_CAPACITY['HORGOS-EXIT'] * 0.9));
  });

  // ── Invariant 4: No LT per IP exceeds its Tech × 0.9 ceiling ──────────

  test('no LT booking per IP exceeds floor(Tech × 0.9)', () => {
    for (const [point, tech] of Object.entries(TECH_CAPACITY)) {
      const cap = Math.floor(tech * 0.9);
      const total = Object.values(LT_BOOKINGS).reduce((s, b) => s + (b[point] || 0), 0);
      expect(total).toBeLessThanOrEqual(cap);
    }
  });

  // ── Invariant 5: ST pool (Tech × 0.1) is fully free (no LT pre-bookings) ─

  test.each([
    ['KIREVO-ENTRY', 1_528_049],
    ['EXIT-SERBIA',    504_026],
    ['HORGOS-EXIT',  1_024_024],
  ])('ST pool at %s = %d (Tech − LT, rounded)', (point, expectedFree) => {
    const tech = TECH_CAPACITY[point];
    const lt = Object.values(LT_BOOKINGS).reduce((s, b) => s + (b[point] || 0), 0);
    const stFree = tech - lt;
    expect(Math.abs(stFree - expectedFree)).toBeLessThanOrEqual(1);
  });

  // ── Invariant 6: NIS does not use HORGOS-EXIT (domestic-only) ─────────

  test('NIS has zero capacity at HORGOS-EXIT (domestic supplier only)', () => {
    expect(LT_BOOKINGS['SHP-002']['HORGOS-EXIT']).toBe(0);
  });
});
