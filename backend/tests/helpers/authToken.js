'use strict';

const jwt = require('jsonwebtoken');

/**
 * Generate a signed test JWT that will pass the authenticate middleware
 * (which calls db.query — mock it to return the user row).
 */
function makeToken({ id = 1, username = 'testuser', role = 'admin' } = {}) {
  return jwt.sign(
    { sub: id, username, role },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

/** Pre-built headers for supertest requests */
function authHeaders(opts) {
  return { Authorization: `Bearer ${makeToken(opts)}` };
}

/** Mock db row that authenticate middleware expects */
function activeUserRow({ id = 1, username = 'testuser', role = 'admin' } = {}) {
  return { rows: [{ id, username, role, is_active: true }], rowCount: 1 };
}

module.exports = { makeToken, authHeaders, activeUserRow };
