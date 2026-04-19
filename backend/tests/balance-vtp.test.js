'use strict';

/**
 * Balance + VTP integration tests — NC Art.12.3 + Art.11
 * Sprint 20 · US-2004
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

describe('Balance + VTP Integration — NC Art.12.3 + Art.11', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('balance includes VTP buy as virtual entry', async () => {
    // Mock nominations
    db.query.mockResolvedValueOnce({ rows: [{
      shipper_id: UUID_SHP, shipper_code: 'SHP-001', shipper_name: 'Газпром',
      gas_day: '2026-04-15',
      nom_entry_kwh_h: '10000000', nom_exit_kwh_h: '9000000',
    }] });
    // Mock VTP trades
    db.query.mockResolvedValueOnce({ rows: [{
      shipper_id: UUID_SHP, gas_day: '2026-04-15',
      vtp_buy_kwh_h: '1000000', vtp_sell_kwh_h: '0',
    }] });

    const res = await request(app)
      .get(`${API}/balance?gas_day=2026-04-15&shipper_id=${UUID_SHP}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ncRef).toContain('Art.12.3');
    const b = res.body.balances[0];
    expect(b.total_entry_kwh_h).toBe(11000000); // 10M nom + 1M VTP buy
    expect(b.total_exit_kwh_h).toBe(9000000);
    expect(b.balance_kwh_h).toBe(2000000);
    expect(b.balanced).toBe(false);
  });

  test('balance includes VTP sell as virtual exit', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      shipper_id: UUID_SHP, shipper_code: 'SHP-001', shipper_name: 'Газпром',
      gas_day: '2026-04-15',
      nom_entry_kwh_h: '10000000', nom_exit_kwh_h: '9000000',
    }] });
    db.query.mockResolvedValueOnce({ rows: [{
      shipper_id: UUID_SHP, gas_day: '2026-04-15',
      vtp_buy_kwh_h: '0', vtp_sell_kwh_h: '1000000',
    }] });

    const res = await request(app)
      .get(`${API}/balance?gas_day=2026-04-15`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const b = res.body.balances[0];
    expect(b.total_exit_kwh_h).toBe(10000000); // 9M nom + 1M VTP sell
    expect(b.balance_kwh_h).toBe(0);
    expect(b.balanced).toBe(true); // 10M entry = 10M exit
  });

  test('balanced flag true when diff < 1 kWh/h', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      shipper_id: UUID_SHP, shipper_code: 'SHP-001', shipper_name: 'Газпром',
      gas_day: '2026-04-15',
      nom_entry_kwh_h: '5000000', nom_exit_kwh_h: '5000000',
    }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/balance?gas_day=2026-04-15`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.balances[0].balanced).toBe(true);
    expect(res.body.balances[0].vtp_buy_kwh_h).toBe(0);
  });

  test('empty balance when no nominations', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/balance?gas_day=2026-04-15`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.balances).toHaveLength(0);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get(`${API}/balance`);
    expect(res.status).toBe(401);
  });
});

describe('Capacity Available — NC Art.7.1.1', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('returns 3 physical IPs with utilization', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { point: 'KIREVO-ENTRY', direction: 'ENTRY', contracted_kwh_h: '13752439', lt_kwh_h: '13752439', st_kwh_h: '0' },
        { point: 'HORGOS-EXIT',  direction: 'EXIT',  contracted_kwh_h: '9216209',  lt_kwh_h: '9216209',  st_kwh_h: '0' },
      ] })
      .mockResolvedValueOnce({ rows: [] }) // surrendered
      .mockResolvedValueOnce({ rows: [] }) // non-nominated
      .mockResolvedValueOnce({ rows: [] }); // CR contracted

    const res = await request(app)
      .get(`${API}/capacity/available`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.physical).toHaveLength(3);
    expect(res.body.ncRef).toContain('Art.7.1.1');

    const kirevo = res.body.physical.find(p => p.ip === 'KIREVO-ENTRY');
    expect(kirevo.tech).toBe(15280488);
    expect(kirevo.contracted).toBe(13752439);
    expect(kirevo.availableQuarterly).toBe(1528049); // 10% free
    expect(kirevo.utilizationPct).toBe(90.0);
  });

  test('available increases with surrendered capacity', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { point: 'KIREVO-ENTRY', direction: 'ENTRY', contracted_kwh_h: '13752439', lt_kwh_h: '13752439', st_kwh_h: '0' },
      ] })
      .mockResolvedValueOnce({ rows: [{ point: 'KIREVO-ENTRY', surrendered: '500000' }] }) // surrendered
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`${API}/capacity/available`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const kirevo = res.body.physical.find(p => p.ip === 'KIREVO-ENTRY');
    expect(kirevo.availableQuarterly).toBe(2028049); // 1,528,049 + 500,000 surrendered
  });

  test('CR available = physical contracted - CR already booked', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { point: 'HORGOS-EXIT', direction: 'EXIT', contracted_kwh_h: '9216209', lt_kwh_h: '9216209', st_kwh_h: '0' },
      ] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ point: 'HORGOS-ENTRY', cr_kwh_h: '1000000' }] });

    const res = await request(app)
      .get(`${API}/capacity/available`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const horgosEntry = res.body.commercialReverse.find(cr => cr.ip === 'HORGOS-ENTRY');
    expect(horgosEntry.totalPhysicalContracted).toBe(9216209);
    expect(horgosEntry.crContracted).toBe(1000000);
    expect(horgosEntry.available).toBe(8216209);
  });
});
