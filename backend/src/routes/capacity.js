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
      `SELECT cb.*, s.code AS shipper_code
       FROM capacity_bookings cb
       JOIN shippers s ON s.id = cb.shipper_id
       ${where} ORDER BY cb.start_date DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
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
        `INSERT INTO capacity_bookings (shipper_id, contract_id, point, capacity_kwh_h, start_date, end_date, product_type)
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
