'use strict';

/**
 * Capacity Surrender + UIOLI + Within-Day + Interruption tests
 * Sprint 20 · US-2001, US-2002, US-2003
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

const UUID_SHP = '22222222-0000-0000-0000-000000000001';
const UUID_BK  = '33333333-0000-0000-0000-000000000001';

describe('Capacity Surrender — NC Art.8', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('POST /capacity/surrender — creates surrender request', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('capacity_bookings')) return Promise.resolve({ rows: [{ id: UUID_BK, capacity_kwh_h: 500000 }] });
      if (sql.includes('INSERT INTO capacity_surrenders')) return Promise.resolve({ rows: [{
        id: 1, shipper_id: UUID_SHP, volume_kwh_h: 100000, status: 'PENDING',
      }] });
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`${API}/capacity/surrender`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, effectiveDate: '2026-05-01' });
    expect(res.status).toBe(201);
    expect(res.body.ncRef).toContain('Art.8.3');
  });

  test('rejects surrender exceeding contracted capacity', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: UUID_BK, capacity_kwh_h: 50000 }] });

    const res = await request(app)
      .post(`${API}/capacity/surrender`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, effectiveDate: '2026-05-01' });
    expect(res.status).toBe(422);
  });

  test('rejects surrender without active booking', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/capacity/surrender`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, effectiveDate: '2026-05-01' });
    expect(res.status).toBe(422);
  });

  test('PATCH /capacity/surrender/:id/approve — approves surrender', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'PENDING' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED' }] });

    const res = await request(app)
      .patch(`${API}/capacity/surrender/1/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  test('rejects approve on non-PENDING surrender', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED' }] });

    const res = await request(app)
      .patch(`${API}/capacity/surrender/1/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ approved: true });
    expect(res.status).toBe(422);
  });

  test('GET /capacity/surrender/history — returns list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, shipper_code: 'SHP-001', status: 'APPROVED' }] });

    const res = await request(app)
      .get(`${API}/capacity/surrender/history`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('UIOLI Check — NC Art.10', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('POST /capacity/uioli/check — identifies underutilized shippers', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { shipper_id: UUID_SHP, shipper_code: 'SHP-004', contracted: 500000, avg_utilized_kwh_h: 200000, utilization_pct: 40.0 },
    ] });

    const res = await request(app)
      .post(`${API}/capacity/uioli/check`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ thresholdPct: 80 });
    expect(res.status).toBe(200);
    expect(res.body.ncRef).toContain('Art.10');
    expect(res.body.underutilized_count).toBe(1);
  });
});

describe('Within-Day Capacity — NC Art.6.3.1.4', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('POST /capacity/within-day — books WD capacity with correct fee', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'wd-1', shipper_id: UUID_SHP, capacity_kwh_h: 100000 }] });

    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, hours: 12, pricePerHour: 0.0021 });
    expect(res.status).toBe(201);
    expect(res.body.fee_calculation.total_fee_eur).toBe(2520); // 100000 × 0.0021 × 12
    expect(res.body.fee_calculation.formula).toContain('price_per_hour');
  });

  test('rejects invalid hours', async () => {
    const res = await request(app)
      .post(`${API}/capacity/within-day`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, point: 'KIREVO-ENTRY', direction: 'ENTRY', volumeKwhH: 100000, hours: 25, pricePerHour: 0.0021 });
    expect(res.status).toBe(400);
  });

  test('GET /capacity/within-day/available — returns available WD capacity', async () => {
    db.query.mockResolvedValueOnce({ rows: [
      { point: 'KIREVO-ENTRY', direction: 'ENTRY', contracted: '13752439' },
    ] });

    const res = await request(app)
      .get(`${API}/capacity/within-day/available`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.capacities).toHaveLength(3);
    expect(res.body.ncRef).toContain('Art.6.3.1.4');
  });
});

describe('Interruption — NC Art.14', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('POST /capacity/interrupt — creates interruption with ×3 penalty', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      id: 1, shipper_id: UUID_SHP, gas_day: '2026-04-15', point: 'KIREVO-ENTRY',
      hours_interrupted: 6, interrupted_kwh_h: 500000, penalty_eur: 49350,
    }] });

    const res = await request(app)
      .post(`${API}/capacity/interrupt`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, gasDay: '2026-04-15', point: 'KIREVO-ENTRY', hoursInterrupted: 6, interruptedKwhH: 500000, reason: 'Maintenance' });
    expect(res.status).toBe(201);
    expect(res.body.penalty_calculation.penalty_multiplier).toBe(3);
    expect(res.body.penalty_calculation.penalty_eur).toBeGreaterThan(0);
  });

  test('rejects interruption without reason', async () => {
    const res = await request(app)
      .post(`${API}/capacity/interrupt`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ shipperId: UUID_SHP, gasDay: '2026-04-15', point: 'KIREVO-ENTRY', hoursInterrupted: 6, interruptedKwhH: 500000 });
    expect(res.status).toBe(400);
  });

  test('GET /capacity/interruptions — returns history', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, shipper_code: 'SHP-001', penalty_eur: 49350 }] });

    const res = await request(app)
      .get(`${API}/capacity/interruptions`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body[0].penalty_eur).toBe(49350);
  });
});
