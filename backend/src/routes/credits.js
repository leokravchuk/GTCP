'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// GET /credits — credit overview per shipper (NC Art. 5)
router.get('/', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.code, s.name, s.credit_limit, s.current_exposure,
              (s.credit_limit - s.current_exposure) AS available_credit
       FROM shippers s WHERE s.is_active = true ORDER BY s.code`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /credits/:shipperId — single shipper credit detail
router.get('/:shipperId', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.code, s.name, s.credit_limit, s.current_exposure,
              (s.credit_limit - s.current_exposure) AS available_credit
       FROM shippers s WHERE s.id = $1`, [req.params.shipperId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /credits/:shipperId — update credit limit (NC Art. 5.5 — margin call)
router.patch(
  '/:shipperId',
  authorize('credits:update'),
  [body('creditLimit').isNumeric()],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    try {
      const { rows: old } = await db.query('SELECT * FROM shippers WHERE id = $1', [req.params.shipperId]);
      if (!old.length) return res.status(404).json({ error: 'Shipper not found' });

      const { rows } = await db.query(
        'UPDATE shippers SET credit_limit = $1 WHERE id = $2 RETURNING *',
        [req.body.creditLimit, req.params.shipperId]
      );

      await addAudit({
        actionType: 'UPDATE', entityType: 'credit', entityId: req.params.shipperId,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Credit limit updated: ${old[0].credit_limit} → ${req.body.creditLimit}`,
        oldValue: { credit_limit: old[0].credit_limit },
        newValue: { credit_limit: rows[0].credit_limit },
      });

      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
