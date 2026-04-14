'use strict';

/**
 * Adjacent TSO matching API integration tests (NC Art.13).
 * Sprint 17 · US-1703 + US-1704 · 15.04.2026
 *
 * Endpoints under test:
 *   POST /nominations/:id/match-adjacent   — Lesser Rule with adjacent TSO
 *   GET  /nominations/:id/matching-result  — double-sided matching summary
 */

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
const admin = () => makeToken({ ...SEED.ADMIN_USER });
const billing = () => makeToken({ ...SEED.BILLING_USER });

const NOM_ID = 'aaaaaaaa-1111-1111-1111-111111111111';

const SAMPLE_NOM = {
  id: NOM_ID,
  shipper_id: 'shp-1',
  reference: 'NOM-2026-00001',
  gas_day: '2026-05-01',
  point: 'HORGOS-EXIT',
  direction: 'EXIT',
  volume_kwh_h: '1000000',
  matched_kwh_h: null,
  allocated_kwh_h: null,
  status: 'CONFIRMED',
};

describe('POST /nominations/:id/match-adjacent (NC Art.13)', () => {

  beforeEach(() => db.query.mockReset());

  test('returns 401 without auth', async () => {
    const res = await request(app).post(`${API}/nominations/${NOM_ID}/match-adjacent`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown nomination', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // SELECT nomination

    const res = await request(app)
      .post(`${API}/nominations/${NOM_ID}/match-adjacent`)
      .set('Authorization', `Bearer ${admin()}`)
      .send({ scenario: 'equal' });

    expect(res.status).toBe(404);
  });

  test('returns 400 for IP with no adjacent TSO configured', async () => {
    const badNom = { ...SAMPLE_NOM, point: 'UNKNOWN-IP' };
    db.query.mockResolvedValueOnce({ rows: [badNom] });

    const res = await request(app)
      .post(`${API}/nominations/${NOM_ID}/match-adjacent`)
      .set('Authorization', `Bearer ${admin()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/adjacent TSO/);
  });

  test('MATCHED scenario=less persists row + returns 201 with NC Art.13 ref', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [SAMPLE_NOM] })                  // fetch nomination
      .mockResolvedValueOnce({ rows: [{                                // INSERT match
        id: 'match-1', nomination_id: NOM_ID, adjacent_tso: 'FGSZ',
        ip_code: 'HORGOS-EXIT', our_side_kwh_h: '1000000',
        their_side_kwh_h: '950000', matched_kwh_h: '950000',
        lesser_side: 'THEIRS', match_status: 'MATCHED',
      }] })
      .mockResolvedValueOnce({ rows: [] })                             // UPDATE nomination
      .mockResolvedValueOnce({ rows: [] });                            // audit insert

    const res = await request(app)
      .post(`${API}/nominations/${NOM_ID}/match-adjacent`)
      .set('Authorization', `Bearer ${admin()}`)
      .send({ scenario: 'less' });

    expect(res.status).toBe(201);
    expect(res.body.match.adjacent_tso).toBe('FGSZ');
    expect(res.body.match.lesser_side).toBe('THEIRS');
    expect(res.body.nominationStatus).toBe('MATCHED_ADJACENT');
    expect(res.body.ncRef).toMatch(/Art\.13/);
  });

  test('REJECTED when adjacent side returns 0 → nomination becomes REJECTED', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [SAMPLE_NOM] })
      .mockResolvedValueOnce({ rows: [{
        id: 'match-2', adjacent_tso: 'FGSZ', ip_code: 'HORGOS-EXIT',
        our_side_kwh_h: '1000000', their_side_kwh_h: '0',
        matched_kwh_h: '0', lesser_side: 'THEIRS', match_status: 'REJECTED',
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/nominations/${NOM_ID}/match-adjacent`)
      .set('Authorization', `Bearer ${admin()}`)
      .send({ factor: 0 });

    expect(res.status).toBe(201);
    expect(res.body.nominationStatus).toBe('REJECTED');
  });

  test('dispatcher gets 403 (no nominations:match permission)', async () => {
    const dispatcher = makeToken({ ...SEED.DISPATCHER });
    const res = await request(app)
      .post(`${API}/nominations/${NOM_ID}/match-adjacent`)
      .set('Authorization', `Bearer ${dispatcher}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /nominations/:id/matching-result (NC Art.13 Double-Sided)', () => {

  beforeEach(() => db.query.mockReset());

  test('returns 401 without auth', async () => {
    const res = await request(app).get(`${API}/nominations/${NOM_ID}/matching-result`);
    expect(res.status).toBe(401);
  });

  test('returns 404 when nomination not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`${API}/nominations/${NOM_ID}/matching-result`)
      .set('Authorization', `Bearer ${admin()}`);
    expect(res.status).toBe(404);
  });

  test('returns full matching result with adjacent matches and summary', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{
        ...SAMPLE_NOM,
        shipper_code: 'SHP-001', shipper_name: 'Gazprom',
        matched_kwh_h: '950000', allocated_kwh_h: '950000',
        status: 'MATCHED_ADJACENT',
      }] })
      .mockResolvedValueOnce({ rows: [
        { id: 'match-1', adjacent_tso: 'FGSZ', ip_code: 'HORGOS-EXIT',
          lesser_side: 'THEIRS', matched_kwh_h: '950000', match_status: 'MATCHED' },
      ] });

    const res = await request(app)
      .get(`${API}/nominations/${NOM_ID}/matching-result`)
      .set('Authorization', `Bearer ${admin()}`);

    expect(res.status).toBe(200);
    expect(res.body.nomination.shipperCode).toBe('SHP-001');
    expect(res.body.nomination.status).toBe('MATCHED_ADJACENT');
    expect(res.body.adjacentMatches).toHaveLength(1);
    expect(res.body.summary.hasAdjacentMatch).toBe(true);
    expect(res.body.summary.lastLesserSide).toBe('THEIRS');
    expect(res.body.summary.adjacentTso).toBe('FGSZ');
    expect(res.body.ncRef).toMatch(/Art\.13/);
  });

  test('summary.hasAdjacentMatch=false when no matches exist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{
        ...SAMPLE_NOM,
        shipper_code: 'SHP-001', shipper_name: 'Gazprom',
      }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/nominations/${NOM_ID}/matching-result`)
      .set('Authorization', `Bearer ${admin()}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.hasAdjacentMatch).toBe(false);
    expect(res.body.summary.lastLesserSide).toBeNull();
  });
});
