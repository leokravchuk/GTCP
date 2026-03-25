'use strict';

const jwt = require('jsonwebtoken');

/**
 * Issue an access token (short-lived, 24 h by default).
 * @param {{ id: string, username: string, role: string }} user
 * @returns {string} signed JWT
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_ACCESS_EXPIRES || '24h' }
  );
}

/**
 * Issue a refresh token (long-lived, 7 d by default).
 * @param {{ id: string }} user
 * @returns {string} signed JWT
 */
function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {{ sub: string }} decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyRefreshToken(token) {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  });
  if (payload.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return payload;
}

module.exports = { signAccessToken, signRefreshToken, verifyRefreshToken };
