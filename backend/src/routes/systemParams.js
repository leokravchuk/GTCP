'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /system-params
router.get('/', authorize('system-params:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM system_params ORDER BY key');
    res.json(rows);
  } catch (err) { next(err); }
});

// PATCH /system-params/:key
router.patch(
  '/:key',
  authorize('system-params:update'),
  [body('value').exists()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    try {
      const { rows } = await db.query(
        'UPDATE system_params SET value = $1 WHERE key = $2 RETURNING *',
        [String(req.body.value), req.params.key]
      );
      if (!rows.length) return res.status(404).json({ error: 'Parameter not found' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
