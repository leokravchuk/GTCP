'use strict';

/**
 * Balance API
 * GET /balance?gas_day=YYYY-MM-DD — daily balance (ENTRY vs EXIT per shipper)
 * GET /balance/summary             — total corridor balance
 */

const express    = require('express');
const db         = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /balance?gas_day=YYYY-MM-DD
router.get('/', authorize('balance:read'), async (req, res, next) => {
  const gasDay = req.query.gas_day || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await db.query(`
      SELECT
        s.id AS shipper_id, s.code, s.name,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'ENTRY'), 0) AS entry_mwh,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'EXIT'),  0) AS exit_mwh,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'ENTRY'), 0) -
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'EXIT'),  0) AS imbalance_mwh
      FROM shippers s
      LEFT JOIN nominations n ON n.shipper_id = s.id
        AND n.gas_day = $1
        AND n.status IN ('MATCHED','PARTIALLY_MATCHED')
      WHERE s.is_active = true
      GROUP BY s.id, s.code, s.name
      ORDER BY s.code
    `, [gasDay]);

    const total = rows.reduce((acc, r) => ({
      entry:     acc.entry     + Number(r.entry_mwh),
      exit:      acc.exit      + Number(r.exit_mwh),
      imbalance: acc.imbalance + Number(r.imbalance_mwh),
    }), { entry: 0, exit: 0, imbalance: 0 });

    res.json({ gasDay, shippers: rows, totals: total });
  } catch (err) { next(err); }
});

// GET /balance/summary — last 7 gas days
router.get('/summary', authorize('balance:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        n.gas_day,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'ENTRY'), 0) AS total_entry_mwh,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'EXIT'),  0) AS total_exit_mwh,
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'ENTRY'), 0) -
        COALESCE(SUM(n.matched_volume) FILTER (WHERE n.direction = 'EXIT'),  0) AS corridor_imbalance
      FROM nominations n
      WHERE n.gas_day >= CURRENT_DATE - INTERVAL '7 days'
        AND n.status IN ('MATCHED','PARTIALLY_MATCHED')
      GROUP BY n.gas_day
      ORDER BY n.gas_day DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
