'use strict';

/**
 * VTP (Virtual Trading Point) API — NC Art.11
 * Sprint 18 · US-1803
 *
 * VTP = entry + exit from a balancing perspective.
 * Buy on VTP = virtual entry, Sell on VTP = virtual exit.
 *
 * Endpoints:
 *   GET    /vtp/trades           — list VTP trades (filter by gas_day, shipper, status)
 *   POST   /vtp/trades           — create a new VTP trade
 *   GET    /vtp/trades/:id       — trade detail
 *   PATCH  /vtp/trades/:id/confirm — confirm a pending trade
 *   GET    /vtp/balance          — net VTP balance per shipper
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// ── GET /vtp/trades ──────────────────────────────────────────────────────────
router.get('/trades', authorize('nominations:read'), async (req, res, next) => {
  const { gas_day, shipper_id, status, trade_type, from, to, limit = 100, offset = 0 } = req.query;
  const conds = []; const params = []; let i = 1;
  if (gas_day)    { conds.push(`t.gas_day = $${i++}`);      params.push(gas_day); }
  if (shipper_id) { conds.push(`t.shipper_id = $${i++}`);   params.push(shipper_id); }
  if (status)     { conds.push(`t.status = $${i++}`);       params.push(status); }
  if (trade_type) { conds.push(`t.trade_type = $${i++}`);   params.push(trade_type); }
  if (from)       { conds.push(`t.gas_day >= $${i++}`);     params.push(from); }
  if (to)         { conds.push(`t.gas_day <= $${i++}`);     params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT t.*,
              s.code  AS shipper_code,  s.name  AS shipper_name,
              cp.code AS counterparty_code, cp.name AS counterparty_name
         FROM vtp_trades t
         JOIN shippers s  ON s.id = t.shipper_id
         LEFT JOIN shippers cp ON cp.id = t.counterparty_id
       ${where}
       ORDER BY t.gas_day DESC, t.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    const { rows: cRows } = await db.query(
      `SELECT COUNT(*) AS count FROM vtp_trades t ${where}`, params
    );
    res.setHeader('X-Total-Count', (cRows[0] || {}).count || '0');
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /vtp/trades ─────────────────────────────────────────────────────────
router.post(
  '/trades',
  authorize('nominations:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('gasDay').isDate(),
    body('volumeKwhH').isFloat({ min: 0.01 }),
    body('direction').isIn(['BUY', 'SELL']),
    body('tradeType').optional().isIn(['TITLE_TRANSFER', 'BALANCING']),
    body('counterpartyId').optional().isString().isLength({ min: 36, max: 36 }),
    body('priceEurMwh').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const {
      shipperId, gasDay, volumeKwhH, direction,
      tradeType = 'TITLE_TRANSFER', counterpartyId, priceEurMwh, notes,
    } = req.body;

    try {
      // Validate shipper is ACTIVE
      const { rows: shippers } = await db.query(
        `SELECT id, status FROM shippers WHERE id = $1`, [shipperId]
      );
      if (!shippers.length) return res.status(404).json({ error: 'Shipper not found' });
      if (shippers[0].status !== 'ACTIVE') {
        return res.status(422).json({
          error: `Shipper status is ${shippers[0].status}, must be ACTIVE`,
          ncRef: 'NC Art.11 — VTP access requires active shipper registration',
        });
      }

      // Validate gas_day >= today
      const today = new Date().toISOString().slice(0, 10);
      if (gasDay < today) {
        return res.status(422).json({
          error: `Gas day ${gasDay} is in the past`,
          ncRef: 'NC Art.11 — VTP trades must be for current or future gas day',
        });
      }

      // Generate trade reference
      const { rows: seqRows } = await db.query(
        `SELECT COALESCE(MAX(CAST(REPLACE(trade_ref, $1, '') AS INTEGER)), 0) AS max_seq
         FROM vtp_trades WHERE trade_ref LIKE $2`,
        ['VTP-' + gasDay.slice(0, 4) + '-', 'VTP-' + gasDay.slice(0, 4) + '-%']
      );
      const tradeRef = `VTP-${gasDay.slice(0, 4)}-${String(Number(seqRows[0].max_seq) + 1).padStart(5, '0')}`;

      const { rows } = await db.query(
        `INSERT INTO vtp_trades
           (trade_ref, shipper_id, counterparty_id, gas_day, volume_kwh_h,
            direction, trade_type, price_eur_mwh, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [tradeRef, shipperId, counterpartyId || null, gasDay, volumeKwhH,
         direction, tradeType, priceEurMwh || null, notes || null, req.user.id]
      );

      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── GET /vtp/trades/:id ──────────────────────────────────────────────────────
router.get('/trades/:id', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*,
              s.code  AS shipper_code,  s.name  AS shipper_name,
              cp.code AS counterparty_code, cp.name AS counterparty_name
         FROM vtp_trades t
         JOIN shippers s  ON s.id = t.shipper_id
         LEFT JOIN shippers cp ON cp.id = t.counterparty_id
        WHERE t.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'VTP trade not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── PATCH /vtp/trades/:id/confirm ────────────────────────────────────────────
router.patch('/trades/:id/confirm', authorize('nominations:update'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows: existing } = await db.query(
      `SELECT * FROM vtp_trades WHERE id = $1`, [id]
    );
    if (!existing.length) return res.status(404).json({ error: 'VTP trade not found' });
    if (existing[0].status !== 'PENDING') {
      return res.status(422).json({
        error: `Trade is ${existing[0].status}, only PENDING trades can be confirmed`,
      });
    }

    const { rows } = await db.query(
      `UPDATE vtp_trades SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = $1
       WHERE id = $2 RETURNING *`,
      [req.user.id, id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── GET /vtp/balance ─────────────────────────────────────────────────────────
// Net VTP position per shipper: BUY = virtual entry (+), SELL = virtual exit (-)
router.get('/balance', authorize('nominations:read'), async (req, res, next) => {
  const { gas_day, from, to } = req.query;
  const conds = ["t.status = 'CONFIRMED'"]; const params = []; let i = 1;
  if (gas_day) { conds.push(`t.gas_day = $${i++}`); params.push(gas_day); }
  if (from)    { conds.push(`t.gas_day >= $${i++}`); params.push(from); }
  if (to)      { conds.push(`t.gas_day <= $${i++}`); params.push(to); }
  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const { rows } = await db.query(
      `SELECT t.shipper_id,
              s.code AS shipper_code, s.name AS shipper_name,
              SUM(CASE WHEN t.direction = 'BUY'  THEN t.volume_kwh_h ELSE 0 END)::numeric AS buy_kwh_h,
              SUM(CASE WHEN t.direction = 'SELL' THEN t.volume_kwh_h ELSE 0 END)::numeric AS sell_kwh_h,
              SUM(CASE WHEN t.direction = 'BUY'  THEN t.volume_kwh_h ELSE -t.volume_kwh_h END)::numeric AS net_kwh_h,
              COUNT(*)::int AS trade_count
         FROM vtp_trades t
         JOIN shippers s ON s.id = t.shipper_id
       ${where}
       GROUP BY t.shipper_id, s.code, s.name
       ORDER BY s.code`,
      params
    );
    res.json({
      ncRef: 'NC Art.11 — VTP: BUY=virtual entry, SELL=virtual exit',
      balances: rows,
    });
  } catch (err) { next(err); }
});

module.exports = router;
