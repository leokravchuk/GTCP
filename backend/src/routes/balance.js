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

// ═══════════════════════════════════════════════════════════════
// OBA Settlement (NC Art.15) — TSO-to-TSO Operational Balancing
// Read-only informational endpoints. Shippers are NOT charged.
// ═══════════════════════════════════════════════════════════════

// GET /balance/oba/daily — Daily OBA imbalances (last 12 months rolling window)
router.get('/oba/daily', authorize('billing:read'), async (req, res, next) => {
  const { gas_day_from, gas_day_to, point_code, adjacent_tso, limit = 100, offset = 0 } = req.query;
  const conds = ["gas_day >= (CURRENT_DATE - INTERVAL '12 months')"];
  const params = [];
  let i = 1;
  if (gas_day_from) { conds.push(`gas_day >= $${i++}`); params.push(gas_day_from); }
  if (gas_day_to)   { conds.push(`gas_day <= $${i++}`); params.push(gas_day_to); }
  if (point_code)   { conds.push(`point_code = $${i++}`); params.push(point_code); }
  if (adjacent_tso) { conds.push(`adjacent_tso = $${i++}`); params.push(adjacent_tso); }
  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const { rows } = await db.query(
      `SELECT id, gas_day, point_code, adjacent_tso, direction,
              nominated_kwh::bigint, allocated_kwh::bigint, measured_kwh::bigint,
              metering_diff_kwh::bigint, linepack_diff_kwh::bigint, gcv_correction_kwh::bigint,
              total_imbalance_kwh::bigint, oba_status, notes
       FROM oba_daily_imbalances
       ${where} ORDER BY gas_day DESC, point_code
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json({
      data: rows,
      ncRef: 'NC Art.15 — Operational Balancing Agreement (TSO-to-TSO)',
      note: 'Read-only. Shippers are always balanced per NC Art.12.3 (nominated = allocated).',
    });
  } catch (err) { next(err); }
});

// GET /balance/oba/monthly/:month — Monthly aggregation per point/TSO
router.get('/oba/monthly/:month', authorize('billing:read'), async (req, res, next) => {
  const { month } = req.params;  // YYYY-MM
  try {
    const { rows } = await db.query(
      `SELECT point_code, adjacent_tso, direction,
              COUNT(*)::int AS days,
              SUM(nominated_kwh)::bigint AS total_nominated,
              SUM(measured_kwh)::bigint AS total_measured,
              SUM(total_imbalance_kwh)::bigint AS total_imbalance,
              SUM(metering_diff_kwh)::bigint AS sum_metering,
              SUM(linepack_diff_kwh)::bigint AS sum_linepack,
              SUM(gcv_correction_kwh)::bigint AS sum_gcv,
              ROUND(AVG(ABS(total_imbalance_kwh)/NULLIF(nominated_kwh,0))*100,4) AS avg_imbalance_pct
       FROM oba_daily_imbalances
       WHERE TO_CHAR(gas_day, 'YYYY-MM') = $1
       GROUP BY point_code, adjacent_tso, direction
       ORDER BY point_code`,
      [month]
    );
    res.json({
      month,
      data: rows,
      ncRef: 'NC Art.15 OBA monthly settlement',
    });
  } catch (err) { next(err); }
});

// GET /balance/oba/summary — 12-month KPI summary
router.get('/oba/summary', authorize('billing:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT point_code, adjacent_tso,
              COUNT(*)::int AS days_count,
              SUM(nominated_kwh)::bigint AS total_nominated_kwh,
              SUM(measured_kwh)::bigint AS total_measured_kwh,
              SUM(total_imbalance_kwh)::bigint AS total_imbalance_kwh,
              ROUND(AVG(ABS(total_imbalance_kwh)/NULLIF(nominated_kwh,0))*100,4) AS avg_imbalance_pct,
              MIN(gas_day) AS period_from,
              MAX(gas_day) AS period_to
       FROM oba_daily_imbalances
       WHERE gas_day >= (CURRENT_DATE - INTERVAL '12 months')
       GROUP BY point_code, adjacent_tso
       ORDER BY point_code`
    );
    res.json({
      data: rows,
      ncRef: 'NC Art.15 — 12-month OBA rolling window',
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
