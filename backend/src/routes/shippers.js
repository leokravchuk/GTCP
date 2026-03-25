'use strict';

const express   = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db        = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// GET /shippers
router.get('/', authorize('shippers:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, name, country, eic_code, credit_limit, current_exposure, is_active, created_at
       FROM shippers ORDER BY code`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /shippers/:id
router.get('/:id', authorize('shippers:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM shippers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /shippers
router.post(
  '/',
  authorize('shippers:create'),
  [
    body('code').trim().isLength({ min: 1, max: 20 }),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('creditLimit').isNumeric(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { code, name, country, eicCode, creditLimit } = req.body;
    try {
      const { rows } = await db.query(
        `INSERT INTO shippers (code, name, country, eic_code, credit_limit)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [code, name, country || null, eicCode || null, creditLimit]
      );
      await addAudit({ actionType: 'CREATE', entityType: 'shipper', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Shipper ${code} created`, newValue: rows[0] });
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// PATCH /shippers/:id
router.patch('/:id', authorize('shippers:update'), async (req, res, next) => {
  const allowed = ['name','country','eic_code','credit_limit','is_active'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE shippers SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    await addAudit({ actionType: 'UPDATE', entityType: 'shipper', entityId: rows[0].id,
      userId: req.user.id, username: req.user.username, ipAddress: req.ip,
      description: `Shipper ${rows[0].code} updated`, newValue: rows[0] });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
