'use strict';

/**
 * Auth Router
 * POST /api/v1/auth/login    — exchange username+password for tokens
 * POST /api/v1/auth/refresh  — exchange refresh token for new access token
 * POST /api/v1/auth/logout   — invalidate session (client-side token removal)
 * GET  /api/v1/auth/me       — return current user profile
 */

const express     = require('express');
const argon2      = require('argon2');
const rateLimit   = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db            = require('../db');
const authenticate  = require('../middleware/authenticate');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { addAudit }  = require('../services/auditService');
const logger        = require('../utils/logger');

const router = express.Router();

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                        // 15 min
  max:      Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message:  { error: 'Too many login attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── POST /auth/login ───────────────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().isLength({ min: 1, max: 64 }).withMessage('Username required'),
    body('password').isLength({ min: 1 }).withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { username, password } = req.body;

    try {
      const { rows } = await db.query(
        'SELECT id, username, email, password_hash, role, full_name, is_active FROM users WHERE username = $1',
        [username]
      );

      const user = rows[0];

      // Constant-time path — always verify even if user not found (prevents timing attacks)
      const fakeHash = '$argon2id$v=19$m=65536,t=3,p=4$fake$fake';
      const hash = user ? user.password_hash : fakeHash;

      let valid = false;
      try {
        valid = await argon2.verify(hash, password);
      } catch (_) {
        valid = false;
      }

      if (!user || !user.is_active || !valid) {
        await addAudit({
          actionType:  'LOGIN_FAILED',
          description: `Failed login attempt for username: ${username}`,
          ipAddress:   req.ip,
        });
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Issue tokens
      const accessToken  = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      // Update last_login_at
      await db.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      await addAudit({
        actionType:  'LOGIN',
        userId:      user.id,
        username:    user.username,
        ipAddress:   req.ip,
        description: `User ${user.username} logged in`,
      });

      res.json({
        accessToken,
        refreshToken,
        user: {
          id:       user.id,
          username: user.username,
          fullName: user.full_name,
          role:     user.role,
          email:    user.email,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /auth/refresh ─────────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    const { rows } = await db.query(
      'SELECT id, username, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const newAccessToken  = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired, please log in again' });
    }
    if (err.name === 'JsonWebTokenError' || err.message === 'Not a refresh token') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await addAudit({
      actionType:  'LOGOUT',
      userId:      req.user.id,
      username:    req.user.username,
      ipAddress:   req.ip,
      description: `User ${req.user.username} logged out`,
    });
    // Tokens are stateless — client must delete them.
    // Sprint 5: implement token blacklist via Redis.
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ── GET /auth/me ───────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, email, full_name, role, last_login_at, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = rows[0];
    res.json({
      id:          u.id,
      username:    u.username,
      email:       u.email,
      fullName:    u.full_name,
      role:        u.role,
      lastLoginAt: u.last_login_at,
      createdAt:   u.created_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
