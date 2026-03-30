'use strict';

const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-for-jwt-signing';

// Role → permissions (mirrors auth.js ROLE_PERMISSIONS)
const ROLE_PERMISSIONS = {
  admin:      ['*'],
  dispatcher: ['nominations:read', 'nominations:create', 'nominations:update', 'shippers:read', 'contracts:read', 'capacity:read'],
  credit:     ['credits:read', 'credits:update', 'shippers:read', 'shippers:update'],
  billing:    ['billing:read', 'billing:create', 'billing:update', 'shippers:read', 'contracts:read'],
  contracts:  ['contracts:read', 'contracts:create', 'contracts:update', 'shippers:read', 'auctions:read'],
};

/**
 * Generate a valid JWT for testing.
 * @param {Object} opts
 * @param {number} [opts.id=1]
 * @param {string} [opts.username='admin']
 * @param {string} [opts.role='admin']
 * @returns {string} Bearer token (without "Bearer " prefix)
 */
function makeToken({ id = 1, username = 'admin', role = 'admin' } = {}) {
  return jwt.sign(
    { sub: id, username, role, permissions: ROLE_PERMISSIONS[role] || [] },
    SECRET,
    { expiresIn: '1h' }
  );
}

/** Seed data IDs for consistent test references */
const SEED = {
  ADMIN_USER:  { id: 1, username: 'admin', role: 'admin' },
  DISPATCHER:  { id: 2, username: 'dispatcher1', role: 'dispatcher' },
  CREDIT_USER: { id: 3, username: 'credit1', role: 'credit' },
  BILLING_USER: { id: 4, username: 'billing1', role: 'billing' },
  CONTRACTS_USER: { id: 5, username: 'contracts1', role: 'contracts' },

  SHIPPER_1: { id: 1, code: 'SHP-001', name: 'Газпром Экспорт', credit_limit: 5000000, current_exposure: 2100000 },
  SHIPPER_2: { id: 2, code: 'SHP-002', name: 'NIS', credit_limit: 3000000, current_exposure: 1500000 },

  CONTRACT_1: { id: 1, code: 'CT R-2026-001', shipper_id: 1, contract_type: 'TSA_FIRM_ANNUAL', status: 'ACTIVE' },
};

/**
 * Create a mock for ../db module.
 * Returns an object with a mockable `query` function.
 */
function createDbMock() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    getClient: jest.fn(),
    pool: { end: jest.fn() },
  };
}

module.exports = { makeToken, SEED, createDbMock, SECRET, ROLE_PERMISSIONS };
