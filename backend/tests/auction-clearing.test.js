'use strict';

/**
 * Auction clearing price + premium tests — CAM NC Art.17-18
 * Sprint 22 diploma compliance
 */

require('./setup');
const request = require('supertest');
const { makeToken, SEED } = require('./helpers');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
  withTransaction: jest.fn(async (fn) => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    return fn(client);
  }),
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

describe('Auction Clearing Price + Premium — CAM NC Art.17-18', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });

  test('result WON calculates premium = clearing - reserve', async () => {
    // Bid lookup
    db.query.mockResolvedValueOnce({ rows: [{
      id: 1, auction_id: 10, bid_capacity_kwh_h: 500000,
      bid_price_eur_kwh_h_yr: 2.10, status: 'SUBMITTED',
    }] });
    // Auction lookup
    db.query.mockResolvedValueOnce({ rows: [{
      id: 10, reserve_price_eur_kwh_h: 1.81, product_type: 'QUARTERLY',
    }] });
    // Update bid
    db.query.mockResolvedValueOnce({ rows: [{
      id: 1, status: 'WON', allocated_capacity_kwh_h: 500000,
      clearing_price_eur_kwh_h_yr: 2.10, auction_premium_eur: 145000,
    }] });
    // Update auction_calendar
    db.query.mockResolvedValueOnce({ rows: [] });
    // Audit
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/auctions/bids/1/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'WON', final_price_eur: 2.10 });

    expect(res.status).toBe(200);
    // Verify UPDATE was called with clearing price and premium
    const updateCall = db.query.mock.calls[2]; // 3rd call = UPDATE bid
    const params = updateCall[1];
    expect(params[0]).toBe('WON'); // status
    expect(params[1]).toBe(500000); // allocated
    expect(params[2]).toBe(2.10); // clearing price
    // premium = 500000 × (2.10 - 1.81) = 145000
    expect(params[3]).toBeCloseTo(145000, 0);
  });

  test('result WON at reserve price → premium = 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      id: 2, auction_id: 10, bid_capacity_kwh_h: 300000, status: 'SUBMITTED',
    }] });
    db.query.mockResolvedValueOnce({ rows: [{
      id: 10, reserve_price_eur_kwh_h: 1.81,
    }] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 2, status: 'WON' }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/auctions/bids/2/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'WON', final_price_eur: 1.81 });

    expect(res.status).toBe(200);
    const params = db.query.mock.calls[2][1];
    expect(params[2]).toBe(1.81); // clearing = reserve
    expect(params[3]).toBeFalsy(); // premium = 0 (stored as null)
  });

  test('result LOST → no premium', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      id: 3, auction_id: 10, bid_capacity_kwh_h: 200000, status: 'SUBMITTED',
    }] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 10, reserve_price_eur_kwh_h: 1.81 }] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 3, status: 'LOST' }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/auctions/bids/3/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'LOST' });

    expect(res.status).toBe(200);
    const params = db.query.mock.calls[2][1];
    expect(params[0]).toBe('LOST');
    expect(params[1]).toBeNull(); // no allocated
  });

  test('PARTIALLY_WON with explicit premium', async () => {
    db.query.mockResolvedValueOnce({ rows: [{
      id: 4, auction_id: 10, bid_capacity_kwh_h: 800000, status: 'SUBMITTED',
    }] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 10, reserve_price_eur_kwh_h: 0.66 }] });
    db.query.mockResolvedValueOnce({ rows: [{ id: 4, status: 'PARTIALLY_WON' }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`${API}/auctions/bids/4/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'PARTIALLY_WON', won_capacity_kwh_h: 500000, final_price_eur: 0.72, auction_premium_eur: 30000 });

    expect(res.status).toBe(200);
    const params = db.query.mock.calls[2][1];
    expect(params[1]).toBe(500000); // partial allocation
    expect(params[2]).toBe(0.72); // clearing
    expect(params[3]).toBe(30000); // explicit premium overrides calc
  });

  test('returns 404 for unknown bid', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post(`${API}/auctions/bids/999/result`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ result: 'WON' });
    expect(res.status).toBe(404);
  });
});
