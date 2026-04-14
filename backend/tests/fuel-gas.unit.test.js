'use strict';

/**
 * Fuel Gas allocation matrix — NC Art.18 + Art.19.1.4.
 * Sprint 17 · US-1713 (FG-T) · 15.04.2026
 *
 * Binding rule (CLAUDE.md "Fuel Gas Allocation Rules"):
 *   FG_fee > 0 ⟺ flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA}
 *             AND fuel_gas_election = 'CASH'
 *             AND qHorgosKwh > 0
 */

require('./setup');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

const { _test } = require('../src/routes/billing');
const { calcFuelGas, FG_APPLICABLE_DIRECTIONS } = _test;

const BASE = {
  x1Pct: 0.42,
  x2Pct: 0.08,
  knKwh: 0,
  gcvKwhNm3: 11.523,
  fuelGasPriceEurMwh: 32.50,
};

describe('Fuel Gas allocation matrix (NC Art.18 + Art.19.1.4)', () => {

  test('FG_APPLICABLE_DIRECTIONS contains exactly the two transit routes', () => {
    expect(FG_APPLICABLE_DIRECTIONS).toEqual(['KIREVO_HORGOS', 'KIREVO_HORGOS_AND_SERBIA']);
  });

  test('KIREVO_HORGOS + CASH + AAQ>0 → FG fee > 0 (transit shipper pays)', () => {
    const r = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_HORGOS',
      fuelGasElection: 'CASH',
      qHorgosKwh: 10_000_000,
    });
    expect(r.fuelGasKwh).toBeGreaterThan(0);
    expect(r.fuelGasAmountEur).toBeGreaterThan(0);
  });

  test('KIREVO_HORGOS_AND_SERBIA forces qSerbia=0 (domestic exit excluded)', () => {
    const onlyHorgos = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_HORGOS_AND_SERBIA',
      fuelGasElection: 'CASH',
      qHorgosKwh: 10_000_000,
      qSerbiaKwh: 0,
    });
    const withSerbia = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_HORGOS_AND_SERBIA',
      fuelGasElection: 'CASH',
      qHorgosKwh: 10_000_000,
      qSerbiaKwh: 5_000_000,
    });
    expect(withSerbia.fuelGasKwh).toBe(onlyHorgos.fuelGasKwh);
    expect(withSerbia.fuelGasAmountEur).toBe(onlyHorgos.fuelGasAmountEur);
  });

  test('KIREVO_EXIT_SERBIA + CASH + any AAQ → FG=0 (no compressor, GMS-4 no preheater)', () => {
    const r = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_EXIT_SERBIA',
      fuelGasElection: 'CASH',
      qHorgosKwh: 10_000_000,
      qSerbiaKwh: 10_000_000,
    });
    expect(r).toEqual({ fuelGasKwh: 0, fuelGasNm3: 0, fuelGasMwh: 0, fuelGasAmountEur: 0 });
  });

  test.each([
    'HORGOS_KIREVO',
    'EXIT_SERBIA_KIREVO',
    'HORGOS_EXIT_SERBIA',
    'EXIT_SERBIA_HORGOS',
  ])('Commercial Reverse route %s → FG=0 (virtual flow)', (dir) => {
    const r = calcFuelGas({
      ...BASE,
      flowDirection: dir,
      fuelGasElection: 'CASH',
      qHorgosKwh: 10_000_000,
    });
    expect(r.fuelGasAmountEur).toBe(0);
  });

  test('KIREVO_HORGOS + IN_KIND → FG=0 (shipper delivers via Nomination, Art.18.1.1(a))', () => {
    const r = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_HORGOS',
      fuelGasElection: 'IN_KIND',
      qHorgosKwh: 10_000_000,
    });
    expect(r.fuelGasAmountEur).toBe(0);
  });

  test('KIREVO_HORGOS + CASH + AAQ=0 → FG=0 (no allocated flow = no FG allocation)', () => {
    const r = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_HORGOS',
      fuelGasElection: 'CASH',
      qHorgosKwh: 0,
    });
    expect(r.fuelGasAmountEur).toBe(0);
  });

  test('legacy call without flowDirection → falls through to formula (backward compat)', () => {
    const r = calcFuelGas({ ...BASE, qHorgosKwh: 1_000_000 });
    expect(r.fuelGasKwh).toBeGreaterThan(0);
  });

  test('regression INV-2026-0008: NIS on KIREVO_EXIT_SERBIA must get FG=0', () => {
    // NIS real billing: cap_entry=cap_exit=4_000_209 kWh/h, 30 days, election=IN_KIND.
    // Even without the IN_KIND guard, the route alone should zero out FG.
    const r = calcFuelGas({
      ...BASE,
      flowDirection: 'KIREVO_EXIT_SERBIA',
      fuelGasElection: 'CASH',           // worst case: even if election=CASH
      qHorgosKwh: 4_000_209 * 24 * 30,   // full monthly nomination
    });
    expect(r.fuelGasAmountEur).toBe(0);
  });
});
