'use strict';

const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /balance — imbalance charges by gas day (NC Art. 15)
router.get('/', authorize('billing:read'), async (req, res, next) => {
  const { gas_day, shipper_id, limit = 100, offset = 0 } = req.query;
  const conds = [];
  const params = [];
  let i = 1;
  if (gas_day)    { conds.push(`b.gas_day = $${i++}`);    params.push(gas_day); }
  if (shipper_id) { conds.push(`b.shipper_id = $${i++}`); params.push(shipper_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT b.*, s.code AS shipper_code
       FROM balance_charges b
       JOIN shippers s ON s.id = b.shipper_id
       ${where} ORDER BY b.gas_day DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
