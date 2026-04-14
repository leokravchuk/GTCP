'use strict';

/**
 * Adjacent TSO matching service unit tests (NC Art.13 Lesser Rule).
 * Sprint 17 · US-1703 · 15.04.2026
 */

require('./setup');

const {
  ADJACENT_TSO_BY_POINT,
  fetchAdjacentNomination,
  applyLesserRule,
  matchWithAdjacentTso,
} = require('../src/services/adjacentTsoService');

// ── IP → TSO mapping ────────────────────────────────────────────────────────

describe('ADJACENT_TSO_BY_POINT mapping (NC Art.13)', () => {
  test('KIREVO-ENTRY → Bulgartransgaz', () => {
    expect(ADJACENT_TSO_BY_POINT['KIREVO-ENTRY']).toBe('Bulgartransgaz');
  });
  test('HORGOS-EXIT → FGSZ', () => {
    expect(ADJACENT_TSO_BY_POINT['HORGOS-EXIT']).toBe('FGSZ');
  });
  test('EXIT-SERBIA → TRANSPORTGAS SRBIJA', () => {
    expect(ADJACENT_TSO_BY_POINT['EXIT-SERBIA']).toBe('TRANSPORTGAS SRBIJA');
  });
  test('Commercial Reverse IPs share the same adjacent TSOs', () => {
    expect(ADJACENT_TSO_BY_POINT['HORGOS-ENTRY']).toBe('FGSZ');
    expect(ADJACENT_TSO_BY_POINT['EXIT-SERBIA-ENTRY']).toBe('TRANSPORTGAS SRBIJA');
    expect(ADJACENT_TSO_BY_POINT['KIREVO-EXIT']).toBe('Bulgartransgaz');
  });
});

// ── fetchAdjacentNomination (mock) ──────────────────────────────────────────

describe('fetchAdjacentNomination (mock)', () => {
  test('scenario=less returns 95% of our value', async () => {
    const r = await fetchAdjacentNomination('HORGOS-EXIT', '2026-05-01', 1_000_000, { scenario: 'less' });
    expect(r.adjacentTso).toBe('FGSZ');
    expect(r.theirKwhH).toBe(950_000);
    expect(r.mocked).toBe(true);
  });
  test('scenario=more returns 105% of our value', async () => {
    const r = await fetchAdjacentNomination('KIREVO-ENTRY', '2026-05-01', 1_000_000, { scenario: 'more' });
    expect(r.theirKwhH).toBe(1_050_000);
  });
  test('scenario=equal returns same value', async () => {
    const r = await fetchAdjacentNomination('EXIT-SERBIA', '2026-05-01', 500_000, { scenario: 'equal' });
    expect(r.theirKwhH).toBe(500_000);
  });
  test('explicit factor overrides scenario default', async () => {
    const r = await fetchAdjacentNomination('HORGOS-EXIT', '2026-05-01', 1_000_000, { factor: 0.5 });
    expect(r.theirKwhH).toBe(500_000);
  });
  test('unknown IP throws', async () => {
    await expect(fetchAdjacentNomination('UNKNOWN-IP', '2026-05-01', 100)).rejects.toThrow(/No adjacent TSO/);
  });
});

// ── applyLesserRule ─────────────────────────────────────────────────────────

describe('applyLesserRule (NC Art.13)', () => {
  test('OURS when our nomination < theirs', () => {
    const r = applyLesserRule(800_000, 1_000_000);
    expect(r.matchedKwhH).toBe(800_000);
    expect(r.lesserSide).toBe('OURS');
  });
  test('THEIRS when their nomination < ours', () => {
    const r = applyLesserRule(1_000_000, 800_000);
    expect(r.matchedKwhH).toBe(800_000);
    expect(r.lesserSide).toBe('THEIRS');
  });
  test('EQUAL when both sides match', () => {
    const r = applyLesserRule(1_000_000, 1_000_000);
    expect(r.matchedKwhH).toBe(1_000_000);
    expect(r.lesserSide).toBe('EQUAL');
  });
  test('zero on either side yields 0 matched', () => {
    expect(applyLesserRule(0, 1_000_000).matchedKwhH).toBe(0);
    expect(applyLesserRule(1_000_000, 0).matchedKwhH).toBe(0);
  });
});

// ── matchWithAdjacentTso (persistence) ──────────────────────────────────────

describe('matchWithAdjacentTso (DB write + nomination update)', () => {
  let db;
  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
  });

  test('MATCHED scenario writes row and updates nomination to MATCHED_ADJACENT', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'match-1', matched_kwh_h: 950_000, lesser_side: 'THEIRS', match_status: 'MATCHED' }] })
      .mockResolvedValueOnce({ rows: [] });

    const r = await matchWithAdjacentTso(
      { db },
      { id: 'nom-1', point: 'HORGOS-EXIT', gas_day: '2026-05-01', volume_kwh_h: 1_000_000 },
      { scenario: 'less' },
    );

    expect(db.query).toHaveBeenCalledTimes(2);
    const insertCall = db.query.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT INTO adjacent_tso_matches/);
    expect(insertCall[1]).toEqual(
      expect.arrayContaining(['nom-1', 'FGSZ', 'HORGOS-EXIT', 1_000_000, 950_000, 950_000, 'THEIRS', 'MATCHED'])
    );
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE nominations/);
    expect(updateCall[1]).toEqual(['MATCHED_ADJACENT', 950_000, 'nom-1']);
    expect(r.newNominationStatus).toBe('MATCHED_ADJACENT');
  });

  test('REJECTED when matched = 0 (their side is zero)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'match-2', matched_kwh_h: 0, lesser_side: 'THEIRS', match_status: 'REJECTED' }] })
      .mockResolvedValueOnce({ rows: [] });

    const r = await matchWithAdjacentTso(
      { db },
      { id: 'nom-2', point: 'KIREVO-ENTRY', gas_day: '2026-05-01', volume_kwh_h: 500_000 },
      { factor: 0 },
    );

    expect(r.newNominationStatus).toBe('REJECTED');
    const insertCall = db.query.mock.calls[0];
    expect(insertCall[1]).toContain('REJECTED');
  });
});
