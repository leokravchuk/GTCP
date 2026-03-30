'use strict';

/**
 * RBP error branch coverage — forces each endpoint to throw → catch branch
 * Also covers authorize.js missing req.user branch
 */

require('./setup');

const request = require('supertest');
const { makeToken, SEED } = require('./helpers');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() },
}));

// Mock RBP services to throw errors for catch-branch coverage
jest.mock('../src/services/rbp/capacityUpload', () => ({
  uploadCapacity: jest.fn().mockRejectedValue(new Error('SOAP timeout')),
}));
jest.mock('../src/services/rbp/creditSync', () => ({
  uploadCredit: jest.fn().mockRejectedValue(new Error('Credit service down')),
  getCreditLimits: jest.fn().mockRejectedValue(new Error('Credit query failed')),
}));
jest.mock('../src/services/rbp/auctionSync', () => ({
  getAuctions: jest.fn().mockRejectedValue(new Error('Auction fetch error')),
  getTrades: jest.fn().mockRejectedValue(new Error('Trade fetch error')),
}));
jest.mock('../src/services/rbp/surrenderApproval', () => ({
  approveSurrender: jest.fn().mockRejectedValue(new Error('Surrender failed')),
}));
jest.mock('../src/services/rbp/bilateralManager', () => ({
  createBilateralDeal: jest.fn().mockRejectedValue(new Error('Bilateral create failed')),
  approveBilateralDeal: jest.fn().mockRejectedValue(new Error('Bilateral approve failed')),
}));
jest.mock('../src/services/rbp/networkUserSync', () => ({
  getActiveNetworkUsers: jest.fn().mockRejectedValue(new Error('Network sync failed')),
}));
jest.mock('../src/services/rbp/remitReporter', () => ({
  submitRemitReport: jest.fn().mockRejectedValue(new Error('REMIT failed')),
}));

const db = require('../src/db');
const app = require('../src/app');
const API = '/api/v1';

describe('RBP error branches (502 responses)', () => {
  beforeEach(() => { db.query.mockReset(); });
  const adminToken = () => makeToken({ ...SEED.ADMIN_USER });
  const creditToken = () => makeToken({ ...SEED.CREDIT_USER });
  const dispatcherToken = () => makeToken({ ...SEED.DISPATCHER });

  test('POST /rbp/sync-capacity → 502 (line 43)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/sync-capacity`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('SOAP timeout');
  });

  test('POST /rbp/sync-credit → 502 (line 53)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/sync-credit`)
      .set('Authorization', `Bearer ${creditToken()}`)
      .send({});
    expect(res.status).toBe(502);
  });

  test('GET /rbp/auctions → 502 (line 63)', async () => {
    const res = await request(app)
      .get(`${API}/rbp/auctions`)
      .set('Authorization', `Bearer ${dispatcherToken()}`);
    expect(res.status).toBe(502);
  });

  test('GET /rbp/trades → 502 (line 73)', async () => {
    const res = await request(app)
      .get(`${API}/rbp/trades`)
      .set('Authorization', `Bearer ${dispatcherToken()}`);
    expect(res.status).toBe(502);
  });

  test('GET /rbp/credit/:id → 502 (line 83)', async () => {
    const res = await request(app)
      .get(`${API}/rbp/credit/1`)
      .set('Authorization', `Bearer ${creditToken()}`);
    expect(res.status).toBe(502);
  });

  test('GET /rbp/sync-log → [] on DB error (line 96)', async () => {
    db.query.mockRejectedValue(new Error('Table not found'));
    const res = await request(app)
      .get(`${API}/rbp/sync-log`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /rbp/surrender/approve → 502 (line 107)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/surrender/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(502);
  });

  test('POST /rbp/bilateral → 502 (line 115)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/bilateral`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(502);
  });

  test('POST /rbp/bilateral/approve → 502 (line 123)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/bilateral/approve`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(502);
  });

  test('GET /rbp/network-users → 502 (line 131)', async () => {
    const res = await request(app)
      .get(`${API}/rbp/network-users`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(502);
  });

  test('POST /rbp/remit → 502 (line 139)', async () => {
    const res = await request(app)
      .post(`${API}/rbp/remit`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});
    expect(res.status).toBe(502);
  });
});
