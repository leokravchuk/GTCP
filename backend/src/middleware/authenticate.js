'use strict';

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';

/**
 * JWT Authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Sets req.user = { id, username, role, permissions }
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = {
      id: payload.sub || payload.id,
      username: payload.username,
      role: payload.role,
      permissions: payload.permissions || [],
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authenticate;
