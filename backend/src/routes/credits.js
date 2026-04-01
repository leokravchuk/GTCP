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

// GET /credits/margin-calls — list open margin calls
router.get('/margin-calls', authorize('credits:read'), async (req, res, next) => {
  try {
    // Return existing margin calls from DB
    const { rows: existing } = await db.query(
      `SELECT mc.*, s.code AS shipper_code, s.name AS shipper_name
       FROM margin_calls mc
       JOIN shippers s ON s.id = mc.shipper_id
       ORDER BY mc.created_at DESC LIMIT 50`
    );

    // Auto-detect new margin call situations (NC Art.5.5)
    // Exposure > Credit Limit AND shipper is NOT rating exempt
    const { rows: violations } = await db.query(
      `SELECT s.id, s.code AS shipper_code, s.name AS shipper_name,
              s.credit_limit, s.current_exposure,
              (s.current_exposure - s.credit_limit) AS shortfall_eur,
              s.rating_exempt
       FROM shippers s
       WHERE s.is_active = true
         AND s.current_exposure > s.credit_limit
         AND s.rating_exempt = false
       ORDER BY (s.current_exposure - s.credit_limit) DESC`
    );

    // Auto-create margin calls for new violations
    for (const v of violations) {
      const alreadyExists = existing.some(mc => mc.shipper_id === v.id && mc.status === 'OPEN');
      if (!alreadyExists) {
        try {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + 2); // 2 Business Days (NC Art.5.5)
          await db.query(
            `INSERT INTO margin_calls (shipper_id, exposure_eur, limit_eur, status, issued_by, notes)
             VALUES ($1, $2, $3, 'OPEN', $4, $5)`,
            [v.id, v.current_exposure, v.credit_limit, req.user.id,
             `Auto: exposure ${v.current_exposure} > limit ${v.credit_limit}, shortfall ${v.shortfall_eur} EUR. Deadline: 2 BD (NC Art.5.5)`]
          );
        } catch (insertErr) {
          console.error('[Margin Call] Auto-insert failed:', insertErr.message);
        }
      }
    }

    // Re-fetch with any new ones
    const { rows } = await db.query(
      `SELECT mc.*, s.code AS shipper_code, s.name AS shipper_name,
              s.credit_limit, s.current_exposure,
              (s.current_exposure - s.credit_limit) AS shortfall_eur
       FROM margin_calls mc
       JOIN shippers s ON s.id = mc.shipper_id
       ORDER BY mc.created_at DESC LIMIT 50`
    );

    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});

// GET /credits/:shipperId/instruments — credit instruments (NC Art.5)
router.get('/:shipperId/instruments', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cs.*, s.code AS shipper_code, s.name AS shipper_name
       FROM credit_support cs
       JOIN shippers s ON s.id = cs.shipper_id
       WHERE cs.shipper_id = $1 ORDER BY cs.status, cs.valid_to DESC`,
      [req.params.shipperId]
    );
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// POST /credits/:shipperId/instruments — add credit instrument
router.post('/:shipperId/instruments', authorize('credits:update'), async (req, res, next) => {
  const { type, bank, amount, validFrom, validTo, product } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO credit_support (shipper_id, support_type, bank_name, amount_eur, valid_from, valid_to, product_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE') RETURNING *`,
      [req.params.shipperId, type || 'BANK_GUARANTEE', bank || null, amount || 0, validFrom || null, validTo || null, product || 'ANNUAL']
    );

    // NC Art.5.3.2: Credit Limit = sum of all active Credit Support
    await db.query(
      `UPDATE shippers SET credit_limit = (
        SELECT COALESCE(SUM(amount_eur), 0) FROM credit_support
        WHERE shipper_id = $1 AND status = 'ACTIVE'
      ) WHERE id = $1`,
      [req.params.shipperId]
    );

    await addAudit({
      actionType: 'CREDIT_INSTRUMENT_ADD', entityType: 'credit_support', entityId: rows[0].id,
      userId: req.user.id, username: req.user.username, ipAddress: req.ip,
      description: `Credit instrument added: ${type || 'BANK_GUARANTEE'} ${amount} EUR for shipper ${req.params.shipperId}`,
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /credits/:shipperId/rating — credit rating for shipper (NC Art.5.1.6)
router.get('/:shipperId/rating', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.code, s.name, s.credit_limit, s.current_exposure,
              s.rating_exempt, s.sp_rating, s.moodys_rating, s.creditreform_score,
              s.rating_updated_at,
              (s.credit_limit - s.current_exposure) AS available_credit
       FROM shippers s WHERE s.id = $1`, [req.params.shipperId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    const s = rows[0];
    res.json({
      ...s,
      sp: s.sp_rating || null,
      s_and_p: s.sp_rating || null,
      moodys: s.moodys_rating || null,
      creditreform: s.creditreform_score || 0,
      rating: s.rating_exempt ? 'EXEMPT' : 'STANDARD',
      exempt: s.rating_exempt,
      updated_at: s.rating_updated_at,
    });
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
