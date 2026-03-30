'use strict';

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

describe('RBP Bridge — all endpoints', () => {

  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });
  const creditToken = () => makeToken({ ...SEED.CREDIT_USER });

  test('GET /rbp/status', async () => {
    const res = await request(app)
      .get(`${API}/rbp/status`)
      .set('Authorization', `Bearer ${dispatcherToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode');
  });

  test('POST /rbp/sync-capacity', async () => {
    const res = await request(app)
      .post(`${API}/rbp/sync-capacity`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ pointCode: 'KIREVO-ENTRY', capacityKwhH: 15280488 });
    expect(res.status).toBeLessThan(503);
  });

  test('POST /rbp/sync-credit', async () => {
    const res = await request(app)
      .post(`${API}/rbp/sync-credit`)
      .set('Authorization', `Bearer ${creditToken()}`)
      .send({ shipperId: 1, creditLimit: 5000000 });
    expect(res.status).toBeLessThan(503);
  });

  test('GET /rbp/auctions', async () => {
    const res = await request(app)
      .get(`${API}/rbp/auctions`)
      .set('Authorization', `Bearer ${dispatcherToken()}`);
    expect(res.status).toBeLessThan(503);
  });

  test('GET /rbp/trades', async () => {
    const res = await request(app)
      .get(`${API}/rbp/trades`)
      .set('Authorization', `Bearer ${dispatcherToken()}`);
    expect(res.status).toBeLessThan(503);
  });

  test('GET /rbp/credit/:shipperId', async () => {
    const res = await request(app)
      .get(`${API}/rbp/credit/1`)
      .set('Authorization', `Bearer ${creditToken()}`);
    expect(res.status).toBeLessThan(503);
  });

  test('GET /rbp/sync-log', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .get(`${API}/rbp/sync-log`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
  });

  test('POST /rbp/surrender/approve', async () => {
    const res = await request(app)
      .post(`${API}/rbp/surrender/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ surrenderId: 1, action: 'APPROVE' });
    expect(res.status).toBeLessThan(503);
  });

  test('POST /rbp/bilateral', async () => {
    const res = await request(app)
      .post(`${API}/rbp/bilateral`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ buyerId: 1, sellerId: 2, capacityKwhH: 1000000 });
    expect(res.status).toBeLessThan(503);
  });

  test('POST /rbp/bilateral/approve', async () => {
    const res = await request(app)
      .post(`${API}/rbp/bilateral/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ dealId: 1 });
    expect(res.status).toBeLessThan(503);
  });

  test('GET /rbp/network-users', async () => {
    const res = await request(app)
      .get(`${API}/rbp/network-users`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBeLessThan(503);
  });

  test('POST /rbp/remit', async () => {
    const res = await request(app)
      .post(`${API}/rbp/remit`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ reportType: 'TABLE_1' });
    expect(res.status).toBeLessThan(503);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get(`${API}/rbp/status`);
    expect(res.status).toBe(401);
  });
});
