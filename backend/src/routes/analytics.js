'use strict';

/**
 * Analytics API — aggregated KPIs for dashboard.
 * Sprint 17 · US-1705 · 15.04.2026
 *
 * Endpoints:
 *   GET /analytics/volumes       — nominated / allocated flow per month by point
 *   GET /analytics/revenue       — billed capacity + fuel gas per month by shipper
 *   GET /analytics/utilization   — contracted vs technical capacity per IP
 */

const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// ── GET /analytics/volumes ───────────────────────────────────────────────────
// Monthly gas volumes (kWh) per IP, filterable by gas_year / shipper.
router.get('/volumes', authorize('billing:read'), async (req, res, next) => {
  const { from, to, shipper_id, point } = req.query;
  const conds = []; const params = []; let i = 1;
  if (from)       { conds.push(`n.gas_day >= $${i++}`);    params.push(from); }
  if (to)         { conds.push(`n.gas_day <= $${i++}`);    params.push(to); }
  if (shipper_id) { conds.push(`n.shipper_id = $${i++}`);  params.push(shipper_id); }
  if (point)      { conds.push(`n.point = $${i++}`);       params.push(point); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT TO_CHAR(n.gas_day, 'YYYY-MM')           AS month,
              n.point,
              COALESCE(SUM(n.volume_kwh_h * 24), 0)::bigint    AS nominated_kwh,
              COALESCE(SUM(n.matched_kwh_h * 24), 0)::bigint   AS matched_kwh,
              COALESCE(SUM(n.allocated_kwh_h * 24), 0)::bigint AS allocated_kwh,
              COUNT(*)::int                                     AS nominations_count
         FROM nominations n
         ${where}
        GROUP BY 1, 2
        ORDER BY 1, 2`,
      params
    );
    res.json({
      data: rows,
      ncRef: 'NC Art.12 Nominations — monthly aggregation',
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── GET /analytics/revenue ───────────────────────────────────────────────────
// Monthly billing revenue: capacity fees + fuel gas per shipper.
router.get('/revenue', authorize('billing:read'), async (req, res, next) => {
  const { from, to, shipper_id } = req.query;
  const conds = []; const params = []; let i = 1;
  if (from)       { conds.push(`i.period_from >= $${i++}`); params.push(from); }
  if (to)         { conds.push(`i.period_to <= $${i++}`);   params.push(to); }
  if (shipper_id) { conds.push(`i.shipper_id = $${i++}`);   params.push(shipper_id); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT TO_CHAR(i.period_from, 'YYYY-MM')     AS month,
              s.code                                  AS shipper_code,
              s.name                                  AS shipper_name,
              COALESCE(SUM(i.cap_entry_fee_eur), 0)::numeric(18,2) AS entry_fee_eur,
              COALESCE(SUM(i.cap_exit_fee_eur), 0)::numeric(18,2)  AS exit_fee_eur,
              COALESCE(SUM(i.fuel_gas_amount_eur), 0)::numeric(18,2) AS fuel_gas_eur,
              COALESCE(SUM(i.total_amount_eur), 0)::numeric(18,2)   AS total_eur,
              COUNT(*)::int                                          AS invoices_count
         FROM invoices i JOIN shippers s ON s.id = i.shipper_id
         ${where}
        GROUP BY 1, 2, 3
        ORDER BY 1, 2`,
      params
    );
    res.json({
      data: rows,
      ncRef: 'NC Art.20 Monthly Invoices — revenue aggregation',
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── GET /analytics/utilization ───────────────────────────────────────────────
// Contracted vs Technical capacity per IP (shows free ST pool availability).
router.get('/utilization', authorize('billing:read'), async (req, res, next) => {
  const { gas_year = '2025/2026' } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT ip.code                               AS point_code,
              ip.direction,
              COALESCE(tc.tech_kwh_h, 0)::numeric(18,2)     AS tech_kwh_h,
              COALESCE(tc.reserved_kwh_h, 0)::numeric(18,2) AS lt_reserved_kwh_h,
              COALESCE((
                SELECT SUM(cb.capacity_kwh_h)
                  FROM capacity_bookings cb
                 WHERE cb.point = ip.code
                   AND cb.status = 'ACTIVE'
                   AND cb.period_from <= CURRENT_DATE
                   AND cb.period_to   >= CURRENT_DATE
              ), 0)::numeric(18,2)                  AS contracted_kwh_h,
              CASE WHEN COALESCE(tc.tech_kwh_h, 0) = 0 THEN 0
                   ELSE ROUND(
                     COALESCE((
                       SELECT SUM(cb.capacity_kwh_h)
                         FROM capacity_bookings cb
                        WHERE cb.point = ip.code AND cb.status = 'ACTIVE'
                          AND cb.period_from <= CURRENT_DATE
                          AND cb.period_to   >= CURRENT_DATE
                     ), 0) / tc.tech_kwh_h * 100, 2)
              END AS utilization_pct
         FROM interconnection_points ip
    LEFT JOIN capacity_technical tc
           ON tc.point_code = ip.code AND tc.gas_year = $1
        WHERE ip.is_active = true
        ORDER BY ip.code`,
      [gas_year]
    );
    res.json({
      data: rows,
      gas_year,
      ncRef: 'NC Art.7 Available Capacity + AERS 05-145',
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
