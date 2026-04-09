'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// GET /capacity — bookings list
router.get('/', authorize('capacity:read'), async (req, res, next) => {
  const { point, shipper_id, product_type, limit = 100, offset = 0 } = req.query;
  const conds = [];
  const params = [];
  let i = 1;
  if (point)        { conds.push(`cb.point = $${i++}`);        params.push(point); }
  if (shipper_id)   { conds.push(`cb.shipper_id = $${i++}`);   params.push(shipper_id); }
  if (product_type) { conds.push(`cb.product_type = $${i++}`); params.push(product_type); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT cb.*, s.code AS shipper_code, s.name AS shipper_name
       FROM capacity_bookings cb
       JOIN shippers s ON s.id = cb.shipper_id
       ${where} ORDER BY s.code, cb.direction, cb.point LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /capacity/available — real-time available capacity per IP (NC Art.7.1.1 + 7.3)
// Option A: SQL on every request, always fresh
router.get('/available', authorize('capacity:read'), async (req, res, next) => {
  try {
    // Technical capacity (AERS)
    const TECH = {
      'KIREVO-ENTRY': { tech: 15280488, direction: 'ENTRY' },
      'HORGOS-EXIT':  { tech: 10240233, direction: 'EXIT' },
      'EXIT-SERBIA':  { tech: 5040256,  direction: 'EXIT' },
    };

    // Total contracted per IP (from active bookings)
    const { rows: bookings } = await db.query(`
      SELECT point, direction,
             ROUND(SUM(capacity_kwh_h))::bigint AS contracted_kwh_h,
             SUM(CASE WHEN capacity_category = 'LONG_TERM' THEN ROUND(capacity_kwh_h) ELSE 0 END)::bigint AS lt_kwh_h,
             SUM(CASE WHEN capacity_category = 'SHORT_TERM' THEN ROUND(capacity_kwh_h) ELSE 0 END)::bigint AS st_kwh_h
      FROM capacity_bookings
      WHERE status = 'ACTIVE'
        AND period_from <= CURRENT_DATE AND period_to >= CURRENT_DATE
      GROUP BY point, direction
    `);

    // Surrendered capacity (if any)
    let surrendered = {};
    try {
      const { rows: surr } = await db.query(`
        SELECT point_code AS point, SUM(capacity_kwh_h)::bigint AS surrendered
        FROM capacity_surrenders WHERE status = 'APPROVED' AND gas_year = 2025
        GROUP BY point_code
      `);
      surr.forEach(s => { surrendered[s.point] = parseInt(s.surrendered) || 0; });
    } catch { /* table may not exist */ }

    // Non-nominated capacity (for Daily/WD, NC Art.12.7.5)
    let nonNominated = {};
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { rows: noms } = await db.query(`
        SELECT point, direction, SUM(volume_kwh_h)::bigint AS nominated
        FROM nominations
        WHERE gas_day = $1 AND status NOT IN ('REJECTED', 'CANCELLED')
        GROUP BY point, direction
      `, [today]);
      // Non-nominated = contracted - nominated (per IP, per direction)
      bookings.forEach(b => {
        const nom = noms.find(n => n.point === b.point && n.direction === b.direction);
        const nominated = nom ? parseInt(nom.nominated) : 0;
        nonNominated[b.point] = Math.max(0, parseInt(b.contracted_kwh_h) - nominated);
      });
    } catch { /* nominations table issue */ }

    // CR contracted (for CR available calc)
    let crContracted = {};
    try {
      const { rows: cr } = await db.query(`
        SELECT point, ROUND(SUM(capacity_kwh_h))::bigint AS cr_kwh_h
        FROM capacity_bookings
        WHERE status = 'ACTIVE' AND booking_type = 'COMMERCIAL_REVERSE'
          AND period_from <= CURRENT_DATE AND period_to >= CURRENT_DATE
        GROUP BY point
      `);
      cr.forEach(c => { crContracted[c.point] = parseInt(c.cr_kwh_h) || 0; });
    } catch {}

    // Build result for physical IPs
    const physical = Object.entries(TECH).map(([ip, cfg]) => {
      const booking = bookings.find(b => b.point === ip) || { contracted_kwh_h: 0, lt_kwh_h: 0, st_kwh_h: 0 };
      const contracted = parseInt(booking.contracted_kwh_h) || 0;
      const lt = parseInt(booking.lt_kwh_h) || 0;
      const st = parseInt(booking.st_kwh_h) || 0;
      const surr = surrendered[ip] || 0;
      const nonNom = nonNominated[ip] || 0;

      // NC Art.7.1.1: Available = Tech - Contracted + Surrendered
      const availableQuarterly = cfg.tech - contracted + surr;
      // NC Art.7.1.1.3: Daily Available += non-nominated
      const availableDaily = cfg.tech - contracted + surr + nonNom;

      return {
        ip, direction: cfg.direction, tech: cfg.tech,
        contracted, lt, st, surrendered: surr, nonNominated: nonNom,
        availableQuarterly: Math.max(0, availableQuarterly),
        availableDaily: Math.max(0, availableDaily),
        utilizationPct: parseFloat((contracted / cfg.tech * 100).toFixed(1)),
      };
    });

    // CR available (NC Art.7.3.2-7.3.5)
    // CR Available = Total Contracted in Physical Direction - CR already contracted
    const CR_MAP = {
      'HORGOS-ENTRY':     { physicalIP: 'HORGOS-EXIT',  direction: 'ENTRY' },
      'EXIT-SERBIA-ENTRY':{ physicalIP: 'EXIT-SERBIA',   direction: 'ENTRY' },
      'KIREVO-EXIT':      { physicalIP: 'KIREVO-ENTRY',  direction: 'EXIT' },
    };

    const cr = Object.entries(CR_MAP).map(([ip, cfg]) => {
      const physBooking = bookings.find(b => b.point === cfg.physicalIP) || { contracted_kwh_h: 0 };
      const totalPhysical = parseInt(physBooking.contracted_kwh_h) || 0;
      const crAlready = crContracted[ip] || 0;
      return {
        ip, direction: cfg.direction,
        tech: 0, // CR has no "technical" capacity
        totalPhysicalContracted: totalPhysical,
        crContracted: crAlready,
        available: Math.max(0, totalPhysical - crAlready),
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      method: 'REAL_TIME_SQL',
      ncRef: 'Art.7.1.1 (Firm ST), Art.7.3 (CR), Art.5.3.4 (hourly update)',
      physical,
      commercialReverse: cr,
    });
  } catch (err) { next(err); }
});

// POST /capacity — create booking
router.post(
  '/',
  authorize('capacity:create'),
  [
    body('shipperId').isInt(),
    body('contractId').isInt(),
    body('point').isString(),
    body('capacityKwhH').isNumeric(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, contractId, point, capacityKwhH, startDate, endDate, productType } = req.body;
    try {
      const { rows } = await db.query(
        `INSERT INTO capacity_bookings (shipper_id, contract_id, point, capacity_kwh_h, period_from, period_to, product_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [shipperId, contractId, point, capacityKwhH, startDate, endDate, productType || 'FIRM_YEARLY']
      );
      await addAudit({
        actionType: 'CREATE', entityType: 'capacity_booking', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Capacity booking ${point} ${capacityKwhH} kWh/h`,
        newValue: rows[0],
      });
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
