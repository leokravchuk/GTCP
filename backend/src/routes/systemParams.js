'use strict';

/**
 * System Parameters API
 *
 * GET  /system-params               — list all params (dispatcher+)
 * GET  /system-params/:key          — single param
 * PATCH /system-params/:key         — update value (admin only)
 * GET  /system-params/points        — interconnection points list
 *
 * Parameters managed here:
 *   fuel_gas_rate_pct               — % of volume consumed as fuel gas
 *   fuel_gas_price_eur_mwh          — EUR/MWh price for fuel gas
 *   balancing_gas_rate_eur_mwh      — EUR/MWh premium for balancing gas
 *   vtp_serbia_price_eur_mwh        — VTP Serbia reference price
 */

const express  = require('express');
const { body, validationResult } = require('express-validator');
const db       = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ── GET /points — interconnection points ────────────────────────────────────
router.get('/points', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { type, active } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    if (type)   { conditions.push(`point_type = $${i++}`); params.push(type.toUpperCase()); }
    if (active !== undefined) { conditions.push(`is_active = $${i++}`); params.push(active !== 'false'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT * FROM interconnection_points ${where} ORDER BY point_type, direction, name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET / — all params ───────────────────────────────────────────────────────
router.get('/', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT key, value, description, updated_at FROM system_params ORDER BY key`
    );
    // Flatten: return { key: value_object, ... }
    const result = {};
    for (const row of rows) {
      result[row.key] = {
        ...row.value,
        description: row.description,
        updated_at:  row.updated_at,
      };
    }
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /:key — single param ─────────────────────────────────────────────────
router.get('/:key', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT key, value, description, updated_at FROM system_params WHERE key = $1`,
      [req.params.key]
    );
    if (!rows.length) return res.status(404).json({ error: `Parameter '${req.params.key}' not found` });
    res.json({ ...rows[0].value, description: rows[0].description, updated_at: rows[0].updated_at });
  } catch (err) { next(err); }
});

// ── PATCH /:key — update param (admin only) ───────────────────────────────────
router.patch(
  '/:key',
  authorize('admin'),
  [ body('value').isNumeric().withMessage('value must be a number') ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { key } = req.params;
    const newValue = Number(req.body.value);

    try {
      // Fetch current
      const { rows: current } = await db.query(
        `SELECT * FROM system_params WHERE key = $1`, [key]
      );
      if (!current.length) return res.status(404).json({ error: `Parameter '${key}' not found` });

      const oldVal = current[0].value;
      const updatedValue = { ...oldVal, value: newValue };

      const { rows } = await db.query(
        `UPDATE system_params
         SET value = $1, updated_by = $2, updated_at = NOW()
         WHERE key = $3
         RETURNING *`,
        [JSON.stringify(updatedValue), req.user.id, key]
      );

      await addAudit({
        actionType:  'SYSTEM_PARAM_UPDATE',
        entityType:  'system_params',
        entityId:    key,
        userId:      req.user.id,
        username:    req.user.username,
        ipAddress:   req.ip,
        description: `System param '${key}' updated: ${oldVal.value} → ${newValue} ${oldVal.unit}`,
        oldValue:    oldVal,
        newValue:    updatedValue,
      });

      res.json({ key, ...rows[0].value, updated_at: rows[0].updated_at });
    } catch (err) { next(err); }
  }
);

module.exports = router;
