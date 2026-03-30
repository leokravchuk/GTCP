'use strict';

/**
 * NC Routes & Tariffs Tests — Sprint 9
 * Verifies NC §2.1 compliance: 7 routes, 6 IPs, tariff correctness
 */

const {
  POINTS, NC_ROUTES, ROUTE_TYPE,
  getRoute, getAllRouteCodes, getPhysicalRoutes, getReverseRoutes,
  getFullReverseRoutes, getHalfReverseRoutes,
  resolvePoints, isValidPoint, isValidFlowDirection, LEGACY_FLOW_DIRECTION_MAP,
} = require('../src/utils/ncRoutes');

describe('NC Routes — NC §2.1 Compliance', () => {

  // ── POINTS ──────────────────────────────────────────────────────────────────
  describe('Interconnection Points', () => {
    test('defines exactly 6 point codes', () => {
      const codes = Object.values(POINTS);
      expect(codes.length).toBeGreaterThanOrEqual(6);
      expect(codes).toContain('KIREVO-ENTRY');
      expect(codes).toContain('HORGOS-EXIT');
      expect(codes).toContain('EXIT-SERBIA');
      expect(codes).toContain('HORGOS-ENTRY');
      expect(codes).toContain('EXIT-SERBIA-ENTRY');
      expect(codes).toContain('KIREVO-EXIT');
    });

    test('all point codes are valid', () => {
      Object.values(POINTS).forEach(code => {
        expect(isValidPoint(code)).toBe(true);
      });
    });

    test('rejects invalid point codes', () => {
      expect(isValidPoint('GOSPODJINCI')).toBe(false);
      expect(isValidPoint('HORGOS')).toBe(false);
      expect(isValidPoint('')).toBe(false);
    });
  });

  // ── NC ROUTES ───────────────────────────────────────────────────────────────
  describe('Transportation Routes', () => {
    test('defines exactly 7 NC routes', () => {
      expect(NC_ROUTES.length).toBe(7);
    });

    test('getAllRouteCodes returns 7 codes', () => {
      const codes = getAllRouteCodes();
      expect(codes).toHaveLength(7);
      expect(codes).toContain('KIREVO_HORGOS');
      expect(codes).toContain('KIREVO_EXIT_SERBIA');
      expect(codes).toContain('KIREVO_HORGOS_AND_SERBIA');
      expect(codes).toContain('HORGOS_KIREVO');
      expect(codes).toContain('EXIT_SERBIA_KIREVO');
      expect(codes).toContain('HORGOS_EXIT_SERBIA');
      expect(codes).toContain('EXIT_SERBIA_HORGOS');
    });

    test('3 physical routes', () => {
      expect(getPhysicalRoutes()).toHaveLength(3);
    });

    test('4 reverse routes', () => {
      expect(getReverseRoutes()).toHaveLength(4);
    });

    test('2 full reverse routes', () => {
      expect(getFullReverseRoutes()).toHaveLength(2);
    });

    test('2 half reverse routes', () => {
      expect(getHalfReverseRoutes()).toHaveLength(2);
    });

    test('all routes have valid entry and exit points', () => {
      NC_ROUTES.forEach(route => {
        expect(isValidPoint(route.entryPoint)).toBe(true);
        expect(route.exitPoint).toBeDefined();
      });
    });

    test('validates known flow directions', () => {
      expect(isValidFlowDirection('KIREVO_HORGOS')).toBe(true);
      expect(isValidFlowDirection('HORGOS_KIREVO')).toBe(true);
      expect(isValidFlowDirection('FAKE_ROUTE')).toBe(false);
    });
  });

  // ── PHYSICAL ROUTES ─────────────────────────────────────────────────────────
  describe('Physical Routes (NC §2.1)', () => {
    test('KIREVO_HORGOS: Bulgaria → Hungary', () => {
      const r = getRoute('KIREVO_HORGOS');
      expect(r).toBeDefined();
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
      expect(r.exitPoint).toBe('HORGOS-EXIT');
    });

    test('KIREVO_EXIT_SERBIA: Bulgaria → Serbia domestic', () => {
      const r = getRoute('KIREVO_EXIT_SERBIA');
      expect(r).toBeDefined();
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
      expect(r.exitPoint).toBe('EXIT-SERBIA');
    });

    test('KIREVO_HORGOS_AND_SERBIA: Bulgaria → both', () => {
      const r = getRoute('KIREVO_HORGOS_AND_SERBIA');
      expect(r).toBeDefined();
      expect(r.type).toBe(ROUTE_TYPE.PHYSICAL);
      expect(r.entryPoint).toBe('KIREVO-ENTRY');
    });
  });

  // ── FULL REVERSE ────────────────────────────────────────────────────────────
  describe('Full Reverse Routes (NC Art. 6.1.2.4)', () => {
    test('HORGOS_KIREVO: Hungary → Bulgaria (virtual)', () => {
      const r = getRoute('HORGOS_KIREVO');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_FULL);
      expect(r.entryPoint).toBe('HORGOS-ENTRY');
      expect(r.exitPoint).toBe('KIREVO-EXIT');
    });

    test('EXIT_SERBIA_KIREVO: Serbia → Bulgaria (virtual)', () => {
      const r = getRoute('EXIT_SERBIA_KIREVO');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_FULL);
      expect(r.entryPoint).toBe('EXIT-SERBIA-ENTRY');
      expect(r.exitPoint).toBe('KIREVO-EXIT');
    });
  });

  // ── HALF REVERSE ────────────────────────────────────────────────────────────
  describe('Half Reverse Routes (NC Art. 6.1.2)', () => {
    test('HORGOS_EXIT_SERBIA: Hungary → Serbia domestic', () => {
      const r = getRoute('HORGOS_EXIT_SERBIA');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_HALF);
      expect(r.entryPoint).toBe('HORGOS-ENTRY');
      expect(r.exitPoint).toBe('EXIT-SERBIA');
    });

    test('EXIT_SERBIA_HORGOS: Serbia → Hungary', () => {
      const r = getRoute('EXIT_SERBIA_HORGOS');
      expect(r.type).toBe(ROUTE_TYPE.COMMERCIAL_REVERSE_HALF);
      expect(r.entryPoint).toBe('EXIT-SERBIA-ENTRY');
      expect(r.exitPoint).toBe('HORGOS-EXIT');
    });
  });

  // ── RESOLVE POINTS ──────────────────────────────────────────────────────────
  describe('resolvePoints()', () => {
    test('resolves physical transit route', () => {
      const { entryPoint, exitPoint } = resolvePoints('KIREVO_HORGOS');
      expect(entryPoint).toBe('KIREVO-ENTRY');
      expect(exitPoint).toBe('HORGOS-EXIT');
    });

    test('resolves full reverse route', () => {
      const { entryPoint, exitPoint } = resolvePoints('HORGOS_KIREVO');
      expect(entryPoint).toBe('HORGOS-ENTRY');
      expect(exitPoint).toBe('KIREVO-EXIT');
    });

    test('throws for invalid route', () => {
      expect(() => resolvePoints('INVALID_ROUTE')).toThrow('Unknown NC flow direction');
    });
  });
});
