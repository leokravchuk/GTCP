'use strict';

/**
 * Unit tests for billing.js internal functions.
 * Tests calcCapacityFee, calcFuelGas, calcLatePaymentInterest, calcInterruptionPenalty
 * directly — no HTTP, no Express, no supertest. Covers every branch.
 */

require('./setup');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const { _test } = require('../src/routes/billing');
const { calcCapacityFee, calcFuelGas, calcLatePaymentInterest, calcInterruptionPenalty, REVERSE_ROUTES } = _test;

// ═════════════════════════════════════════════════════════════════════════════
// calcCapacityFee — all 4 modes
// ═════════════════════════════════════════════════════════════════════════════

describe('calcCapacityFee', () => {

  // ── Mode 1: WITHIN_DAY (lines 181-188) ────────────────────────────────
  describe('WITHIN_DAY mode', () => {

    test('FIRM_WITHIN_DAY: 5000 × 0.0021/h × 8h = €84', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 5000, capExitKwhH: 5000,
        productType: 'FIRM_WITHIN_DAY',
        hours: 8,
        withinDayPriceEntry: 0.0021, withinDayPriceExit: 0.0023,
      });
      expect(r.mode).toBe('WITHIN_DAY');
      expect(r.entryFeeEur).toBe(84);
      expect(r.exitFeeEur).toBe(92);
      expect(r.totalFeeEur).toBe(176);
      expect(r.hours).toBe(8);
    });

    test('INTERRUPTIBLE_WITHIN_DAY also triggers hourly mode', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 10000,
        productType: 'INTERRUPTIBLE_WITHIN_DAY',
        hours: 4,
        withinDayPriceEntry: 0.0021, withinDayPriceExit: 0.0023,
      });
      expect(r.mode).toBe('WITHIN_DAY');
    });

    test('hours defaults to 1 if not provided', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 10000, capExitKwhH: 10000,
        productType: 'FIRM_WITHIN_DAY',
        withinDayPriceEntry: 0.0021, withinDayPriceExit: 0.0023,
      });
      expect(r.hours).toBe(1);
    });

    test('falls back to capacityKwhH if capEntry/Exit not set', () => {
      const r = calcCapacityFee({
        capacityKwhH: 5000,
        productType: 'FIRM_WITHIN_DAY',
        hours: 8,
        withinDayPriceEntry: 0.0021, withinDayPriceExit: 0.0023,
      });
      expect(r.entryFeeEur).toBe(84);
      expect(r.exitFeeEur).toBe(92);
    });
  });

  // ── Mode 2: COMMERCIAL_REVERSE (lines 192-196) ────────────────────────
  describe('COMMERCIAL_REVERSE mode', () => {

    test('HORGOS_KIREVO uses CR tariffs', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 5000000, capExitKwhH: 5000000,
        tariffEntryEurKwhHYr: 3.25, tariffExitEurKwhHYr: 2.85,
        billingDays: 31, flowDirection: 'HORGOS_KIREVO',
      });
      expect(r.mode).toBe('COMMERCIAL_REVERSE');
      expect(r.entryFeeEur).toBeGreaterThan(0);
      expect(r.exitFeeEur).toBeGreaterThan(0);
    });

    test('all 5 reverse routes trigger CR mode', () => {
      REVERSE_ROUTES.forEach(route => {
        const r = calcCapacityFee({
          capEntryKwhH: 1000, capExitKwhH: 1000,
          billingDays: 1, flowDirection: route,
        });
        expect(r.mode).toBe('COMMERCIAL_REVERSE');
      });
    });

    test('falls back to tariffCommRevEurKwhHYr if tariffEntry/Exit not set', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 10000, capExitKwhH: 10000,
        tariffCommRevEurKwhHYr: 3.25,
        billingDays: 365, flowDirection: 'EXIT_SERBIA_KIREVO',
      });
      expect(r.mode).toBe('COMMERCIAL_REVERSE');
      // Both entry and exit use 3.25
      expect(r.entryFeeEur).toBe(32500);
      expect(r.exitFeeEur).toBe(32500);
    });
  });

  // ── Mode 3: LEGACY_BUNDLED (lines 203-208) ────────────────────────────
  describe('LEGACY_BUNDLED mode', () => {

    test('single capacityKwhH without capEntry/Exit', () => {
      const r = calcCapacityFee({
        capacityKwhH: 50000,
        tariffEntryEurKwhHYr: 6.00, tariffExitEurKwhHYr: 6.85,
        tariffBundledEurKwhHYr: 12.85,
        billingDays: 31,
      });
      expect(r.mode).toBe('LEGACY_BUNDLED');
      expect(r.totalFeeEur).toBeGreaterThan(0);
      // entry + exit = total
      expect(r.entryFeeEur + r.exitFeeEur).toBeCloseTo(r.totalFeeEur, 1);
    });
  });

  // ── Mode 4: SEPARATE_ENTRY_EXIT (lines 210-214) ───────────────────────
  describe('SEPARATE_ENTRY_EXIT mode', () => {

    test('standard transit: 13.7M entry × 6.00 + 9.2M exit × 6.85, 31 days', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 13752230, capExitKwhH: 9216209,
        tariffEntryEurKwhHYr: 6.00, tariffExitEurKwhHYr: 6.85,
        billingDays: 31,
      });
      expect(r.mode).toBe('SEPARATE_ENTRY_EXIT');
      expect(r.entryFeeEur).toBeCloseTo(13752230 * 6.00 / 365 * 31, 1);
      expect(r.exitFeeEur).toBeCloseTo(9216209 * 6.85 / 365 * 31, 1);
      expect(r.totalFeeEur).toBe(parseFloat((r.entryFeeEur + r.exitFeeEur).toFixed(2)));
    });

    test('entry ≠ exit capacity (Gastrans critical rule)', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 13752230, capExitKwhH: 9216209,
        tariffEntryEurKwhHYr: 6.00, tariffExitEurKwhHYr: 6.85,
        billingDays: 365,
      });
      expect(r.entryFeeEur).not.toBe(r.exitFeeEur);
    });

    test('billingDays defaults to 1', () => {
      const r = calcCapacityFee({
        capEntryKwhH: 10000, capExitKwhH: 10000,
        tariffEntryEurKwhHYr: 6.00, tariffExitEurKwhHYr: 6.85,
      });
      expect(r.entryFeeEur).toBeCloseTo(10000 * 6.00 / 365, 1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// calcFuelGas — NC Art. 18
// ═════════════════════════════════════════════════════════════════════════════

describe('calcFuelGas', () => {

  test('standard: X1=0.42%, Horgos=10M, X2=0.08%, Serbia=5M, KN=1000', () => {
    const r = calcFuelGas({
      qHorgosKwh: 10000000, qSerbiaKwh: 5000000,
      x1Pct: 0.42, x2Pct: 0.08, knKwh: 1000,
      gcvKwhNm3: 11.523, fuelGasPriceEurMwh: 32.50,
    });
    // FG = 0.0042 × 10M + 0.0008 × 5M − 1000 = 42000 + 4000 − 1000 = 45000 kWh
    expect(r.fuelGasKwh).toBe(45000);
    expect(r.fuelGasMwh).toBe(45);
    expect(r.fuelGasAmountEur).toBe(1462.50);
    expect(r.fuelGasNm3).toBeCloseTo(45000 / 11.523, 1);
  });

  test('FG cannot be negative (KN exceeds flow)', () => {
    const r = calcFuelGas({
      qHorgosKwh: 100, qSerbiaKwh: 100,
      x1Pct: 0.42, x2Pct: 0.08, knKwh: 99999,
    });
    expect(r.fuelGasKwh).toBe(0);
    expect(r.fuelGasAmountEur).toBe(0);
  });

  test('zero flow → zero FG', () => {
    const r = calcFuelGas({ qHorgosKwh: 0, qSerbiaKwh: 0 });
    expect(r.fuelGasKwh).toBe(0);
  });

  test('gcvKwhNm3 = 0 → fuelGasNm3 = 0 (no division by zero)', () => {
    const r = calcFuelGas({
      qHorgosKwh: 10000000, gcvKwhNm3: 0,
    });
    expect(r.fuelGasNm3).toBe(0);
  });

  test('uses defaults when no params', () => {
    const r = calcFuelGas({});
    expect(r.fuelGasKwh).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// calcLatePaymentInterest — NC Art. 20.4.2
// ═════════════════════════════════════════════════════════════════════════════

describe('calcLatePaymentInterest', () => {

  test('€100K, EURIBOR 2.64%, +3%, 15 days = €235.00', () => {
    const r = calcLatePaymentInterest({
      overdueEur: 100000, daysOverdue: 15,
      euribor6mPct: 2.64, spreadPct: 3.0, dayBasis: 360,
    });
    expect(r).toBe(235.00);
  });

  test('returns 0 if overdueEur <= 0', () => {
    expect(calcLatePaymentInterest({ overdueEur: 0, daysOverdue: 15 })).toBe(0);
    expect(calcLatePaymentInterest({ overdueEur: -100, daysOverdue: 15 })).toBe(0);
  });

  test('returns 0 if daysOverdue <= 0', () => {
    expect(calcLatePaymentInterest({ overdueEur: 100000, daysOverdue: 0 })).toBe(0);
    expect(calcLatePaymentInterest({ overdueEur: 100000, daysOverdue: -5 })).toBe(0);
  });

  test('returns 0 if overdueEur is falsy', () => {
    expect(calcLatePaymentInterest({ daysOverdue: 15 })).toBe(0);
  });

  test('uses default params (EURIBOR 2.64%, spread 3%, 360 days)', () => {
    const r = calcLatePaymentInterest({ overdueEur: 100000, daysOverdue: 360 });
    // rate = 5.64% → 100000 × 0.0564 = 5640.00
    expect(r).toBe(5640.00);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// calcInterruptionPenalty — AERS 05-145 item 3
// ═════════════════════════════════════════════════════════════════════════════

describe('calcInterruptionPenalty', () => {

  test('INTERRUPTIBLE: fee × 3', () => {
    expect(calcInterruptionPenalty(329, 'INTERRUPTIBLE')).toBe(987);
  });

  test('INTERRUPTIBLE_DAILY: fee × 3', () => {
    expect(calcInterruptionPenalty(100, 'INTERRUPTIBLE_DAILY')).toBe(300);
  });

  test('INTERRUPTIBLE_WITHIN_DAY: fee × 3', () => {
    expect(calcInterruptionPenalty(92, 'INTERRUPTIBLE_WITHIN_DAY')).toBe(276);
  });

  test('FIRM_WITHIN_DAY: fee × 3 (NC Art.14.2.1.1)', () => {
    expect(calcInterruptionPenalty(84, 'FIRM_WITHIN_DAY')).toBe(252);
  });

  test('FIRM_YEARLY → returns 0 (not interruptible)', () => {
    expect(calcInterruptionPenalty(1000000, 'FIRM_YEARLY')).toBe(0);
  });

  test('FIRM_MONTHLY → returns 0', () => {
    expect(calcInterruptionPenalty(5000, 'FIRM_MONTHLY')).toBe(0);
  });

  test('FIRM_DAILY → returns 0', () => {
    expect(calcInterruptionPenalty(329, 'FIRM_DAILY')).toBe(0);
  });

  test('unknown type → returns 0', () => {
    expect(calcInterruptionPenalty(1000, 'UNKNOWN')).toBe(0);
  });
});
