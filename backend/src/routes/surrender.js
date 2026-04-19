'use strict';

/**
 * Capacity Surrender + UIOLI + Interruption — NC Art.8, Art.10, Art.14
 * Sprint 20 · US-2001, US-2002, US-2003
 *
 * Art.8.3: Shipper surrenders contracted capacity → available for re-auction
 * Art.10:  Use-It-Or-Lose-It — TSO reclaims underutilized capacity
 * Art.14:  Interruptible capacity interruption, penalty = fee × 3
 * Art.6.3.1.4: Within-Day capacity = hourly continuous allocation
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// ══════════════════════════════════════════════════════════════
// CAPACITY SURRENDER (NC Art.8)
// ══════════════════════════════════════════════════════════════

// POST /surrender — shipper surrenders capacity
router.post(
  '/surrender',
  authorize('capacity:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('point').trim().isLength({ min: 1 }),
    body('direction').isIn(['ENTRY', 'EXIT']),
    body('volumeKwhH').isFloat({ min: 0.01 }),
    body('effectiveDate').isDate(),
    body('reason').optional().isString(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, point, direction, volumeKwhH, effectiveDate, reason } = req.body;

    try {
      // Verify shipper has active capacity at this point
      const { rows: bookings } = await db.query(
        `SELECT id, capacity_kwh_h FROM capacity_bookings
         WHERE shipper_id = $1 AND point = $2 AND direction = $3 AND status = 'ACTIVE'
         ORDER BY capacity_kwh_h DESC LIMIT 1`,
        [shipperId, point, direction]
      );

      if (!bookings.length) {
        return res.status(422).json({
          error: 'No active capacity booking found at this point',
          ncRef: 'NC Art.8.3 — surrender requires existing contracted capacity',
        });
      }

      const booking = bookings[0];
      if (Number(volumeKwhH) > Number(booking.capacity_kwh_h)) {
        return res.status(422).json({
          error: `Surrender volume ${volumeKwhH} exceeds contracted ${booking.capacity_kwh_h} kWh/h`,
          ncRef: 'NC Art.8.3',
        });
      }

      const { rows } = await db.query(
        `INSERT INTO capacity_surrenders
           (shipper_id, booking_id, point, direction, volume_kwh_h, effective_date, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [shipperId, booking.id, point, direction, volumeKwhH, effectiveDate, reason || null, req.user.id]
      );

      res.status(201).json({
        ...rows[0],
        ncRef: 'NC Art.8.3 — capacity surrendered, pending TSO approval',
      });
    } catch (err) { next(err); }
  }
);

// PATCH /surrender/:id/approve — TSO approves/rejects surrender
router.patch('/surrender/:id/approve', authorize('capacity:create'), async (req, res, next) => {
  const { id } = req.params;
  const { approved, reason } = req.body || {};

  try {
    const { rows: existing } = await db.query(`SELECT * FROM capacity_surrenders WHERE id = $1`, [id]);
    if (!existing.length) return res.status(404).json({ error: 'Surrender not found' });
    if (existing[0].status !== 'PENDING') {
      return res.status(422).json({ error: `Surrender is ${existing[0].status}, only PENDING can be reviewed` });
    }

    const newStatus = approved !== false ? 'APPROVED' : 'REJECTED';
    const { rows } = await db.query(
      `UPDATE capacity_surrenders SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
              reason = COALESCE($3, reason)
       WHERE id = $4 RETURNING *`,
      [newStatus, req.user.id, reason || null, id]
    );

    res.json({ ...rows[0], ncRef: `NC Art.8.3 — surrender ${newStatus.toLowerCase()}` });
  } catch (err) { next(err); }
});

// GET /surrender/history — surrender history
router.get('/surrender/history', authorize('capacity:read'), async (req, res, next) => {
  const { shipper_id, status, limit = 100, offset = 0 } = req.query;
  const conds = []; const params = []; let i = 1;
  if (shipper_id) { conds.push(`cs.shipper_id = $${i++}`); params.push(shipper_id); }
  if (status) { conds.push(`cs.status = $${i++}`); params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT cs.*, s.code AS shipper_code, s.name AS shipper_name
       FROM capacity_surrenders cs
       JOIN shippers s ON s.id = cs.shipper_id
       ${where} ORDER BY cs.created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /uioli/check — TSO checks for underutilization (NC Art.10)
router.post('/uioli/check', authorize('capacity:create'), async (req, res, next) => {
  const { point, direction, thresholdPct = 80 } = req.body || {};

  try {
    const { rows } = await db.query(
      `SELECT cb.shipper_id, s.code AS shipper_code, s.name AS shipper_name,
              cb.capacity_kwh_h AS contracted,
              COALESCE(nom.avg_utilized, 0) AS avg_utilized_kwh_h,
              ROUND(COALESCE(nom.avg_utilized, 0) / NULLIF(cb.capacity_kwh_h, 0) * 100, 1) AS utilization_pct
       FROM capacity_bookings cb
       JOIN shippers s ON s.id = cb.shipper_id
       LEFT JOIN LATERAL (
         SELECT AVG(n.volume_kwh_h) AS avg_utilized
         FROM nominations n
         WHERE n.shipper_id = cb.shipper_id AND n.point = cb.point AND n.direction = cb.direction
           AND n.gas_day >= CURRENT_DATE - INTERVAL '90 days'
           AND n.status NOT IN ('REJECTED', 'CANCELLED')
       ) nom ON true
       WHERE cb.status = 'ACTIVE'
         ${point ? `AND cb.point = $1` : ''}
         ${direction ? `AND cb.direction = $${point ? 2 : 1}` : ''}
       ORDER BY utilization_pct ASC`,
      [point, direction].filter(Boolean)
    );

    const underutilized = rows.filter(r => Number(r.utilization_pct) < thresholdPct);

    res.json({
      ncRef: 'NC Art.10 — Use-It-Or-Lose-It check',
      threshold_pct: thresholdPct,
      total_bookings: rows.length,
      underutilized_count: underutilized.length,
      underutilized,
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════
// WITHIN-DAY CAPACITY (NC Art.6.3.1.4)
// ══════════════════════════════════════════════════════════════

// POST /within-day — book within-day capacity
router.post(
  '/within-day',
  authorize('capacity:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('point').trim().isLength({ min: 1 }),
    body('direction').isIn(['ENTRY', 'EXIT']),
    body('volumeKwhH').isFloat({ min: 0.01 }),
    body('hours').isInt({ min: 1, max: 24 }),
    body('pricePerHour').isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, point, direction, volumeKwhH, hours, pricePerHour } = req.body;

    try {
      // Fee = capacity_kwh_h × price_per_hour × hours (NOT / 365!)
      const fee = Number(volumeKwhH) * Number(pricePerHour) * Number(hours);

      const { rows } = await db.query(
        `INSERT INTO capacity_bookings
           (shipper_id, point, direction, capacity_kwh_h, product_type, status,
            period_from, period_to)
         VALUES ($1, $2, $3, $4, 'WITHIN_DAY', 'ACTIVE', CURRENT_DATE, CURRENT_DATE)
         RETURNING *`,
        [shipperId, point, direction, volumeKwhH]
      );

      res.status(201).json({
        booking: rows[0],
        fee_calculation: {
          capacity_kwh_h: Number(volumeKwhH),
          price_per_hour: Number(pricePerHour),
          hours: Number(hours),
          total_fee_eur: Number(fee.toFixed(2)),
          formula: 'capacity_kwh_h × price_per_hour × hours',
          ncRef: 'NC Art.6.3.1.4 — Within-Day fee (NOT / 365)',
        },
      });
    } catch (err) { next(err); }
  }
);

// GET /within-day/available — available WD capacity per IP
router.get('/within-day/available', authorize('capacity:read'), async (req, res, next) => {
  try {
    const technical = [
      { point: 'KIREVO-ENTRY', direction: 'ENTRY', technical_kwh_h: 15280488 },
      { point: 'HORGOS-EXIT',  direction: 'EXIT',  technical_kwh_h: 10240233 },
      { point: 'EXIT-SERBIA',  direction: 'EXIT',  technical_kwh_h: 5040256 },
    ];

    const { rows } = await db.query(
      `SELECT point, direction, SUM(capacity_kwh_h)::numeric AS contracted
       FROM capacity_bookings WHERE status = 'ACTIVE' AND period_to >= CURRENT_DATE
       GROUP BY point, direction`
    );

    const result = technical.map(t => {
      const c = rows.find(r => r.point === t.point && r.direction === t.direction);
      const contracted = c ? Number(c.contracted) : 0;
      return {
        ...t,
        contracted_kwh_h: contracted,
        available_kwh_h: Math.max(0, t.technical_kwh_h - contracted),
        gas_day: new Date().toISOString().slice(0, 10),
      };
    });

    res.json({
      ncRef: 'NC Art.6.3.1.4 — Within-Day available capacity',
      capacities: result,
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════
// INTERRUPTION (NC Art.14)
// ══════════════════════════════════════════════════════════════

// POST /interrupt — TSO interrupts interruptible capacity
router.post(
  '/interrupt',
  authorize('capacity:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('gasDay').isDate(),
    body('point').trim().isLength({ min: 1 }),
    body('hoursInterrupted').isInt({ min: 1, max: 24 }),
    body('interruptedKwhH').isFloat({ min: 0.01 }),
    body('reason').isString().isLength({ min: 1 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, gasDay, point, hoursInterrupted, interruptedKwhH, reason } = req.body;

    try {
      // AERS 05-145 item 3: interruption penalty = fee × 3
      // Daily interruptible tariff lookup
      const DAILY_TARIFFS = {
        'KIREVO-ENTRY': 0.0329,
        'HORGOS-EXIT': 0.0375,
        'EXIT-SERBIA': 0.0230,
      };
      const dailyTariff = DAILY_TARIFFS[point] || 0.0329;
      const baseFee = Number(interruptedKwhH) * dailyTariff;
      const penaltyEur = Number((baseFee * 3).toFixed(2)); // × 3 penalty

      const { rows } = await db.query(
        `INSERT INTO interruptions
           (shipper_id, gas_day, point, hours_interrupted, interrupted_kwh_h,
            reason, penalty_eur, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [shipperId, gasDay, point, hoursInterrupted, interruptedKwhH, reason, penaltyEur, req.user.id]
      );

      res.status(201).json({
        ...rows[0],
        penalty_calculation: {
          interrupted_kwh_h: Number(interruptedKwhH),
          daily_tariff: dailyTariff,
          base_fee_eur: Number(baseFee.toFixed(2)),
          penalty_multiplier: 3,
          penalty_eur: penaltyEur,
          ncRef: 'AERS 05-145 item 3: interruptible interruption fee = value × 3',
        },
      });
    } catch (err) { next(err); }
  }
);

// GET /interruptions — interruption history
router.get('/interruptions', authorize('capacity:read'), async (req, res, next) => {
  const { shipper_id, gas_day, status, limit = 100, offset = 0 } = req.query;
  const conds = []; const params = []; let i = 1;
  if (shipper_id) { conds.push(`it.shipper_id = $${i++}`); params.push(shipper_id); }
  if (gas_day)    { conds.push(`it.gas_day = $${i++}`);    params.push(gas_day); }
  if (status)     { conds.push(`it.status = $${i++}`);     params.push(status); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT it.*, s.code AS shipper_code, s.name AS shipper_name
       FROM interruptions it
       JOIN shippers s ON s.id = it.shipper_id
       ${where} ORDER BY it.gas_day DESC, it.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
