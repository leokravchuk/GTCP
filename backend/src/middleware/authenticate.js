'use strict';

const jwt    = require('jsonwebtoken');
const db     = require('../db');
const logger = require('../utils/logger');

/**
 * authenticate — verifies Bearer JWT in Authorization header.
 * Attaches req.user = { id, username, role } on success.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });

    // Verify user still exists and is active (prevents using tokens after deactivation)
    const { rows } = await db.query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = {
      id:       rows[0].id,
      username: rows[0].username,
      role:     rows[0].role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('authenticate middleware error:', err);
    next(err);
  }
}

module.exports = authenticate;
