'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { addAudit } = require('../services/auditService');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const SECRET = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-me';
const EXPIRES = process.env.JWT_ACCESS_EXPIRES || '24h';

// Role → permissions mapping
const ROLE_PERMISSIONS = {
  admin:      ['*'],
  dispatcher: ['nominations:read', 'nominations:create', 'nominations:update', 'shippers:read', 'contracts:read', 'capacity:read'],
  credit:     ['credits:read', 'credits:update', 'shippers:read', 'shippers:update'],
  billing:    ['billing:read', 'billing:create', 'billing:update', 'shippers:read', 'contracts:read'],
  contracts:  ['contracts:read', 'contracts:create', 'contracts:update', 'shippers:read', 'auctions:read'],
};

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, permissions: ROLE_PERMISSIONS[user.role] || [] },
    SECRET,
    { expiresIn: EXPIRES }
  );
}

// POST /auth/login
router.post(
  '/login',
  [
    body('username').trim().isLength({ min: 1 }),
    body('password').isLength({ min: 1 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { username, password } = req.body;
    try {
      const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const valid = await argon2.verify(user.password_hash, password);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = signToken(user);

      await addAudit({
        actionType: 'LOGIN', entityType: 'user', entityId: user.id,
        userId: user.id, username: user.username, ipAddress: req.ip,
        description: `User ${user.username} logged in`,
      });

      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) { next(err); }
  }
);

// GET /auth/me — current user info
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// POST /auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 6 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    try {
      const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      if (!rows.length) return res.status(404).json({ error: 'User not found' });

      const valid = await argon2.verify(rows[0].password_hash, req.body.currentPassword);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      const newHash = await argon2.hash(req.body.newPassword);
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'user', entityId: req.user.id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: 'Password changed',
      });

      res.json({ message: 'Password changed successfully' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
