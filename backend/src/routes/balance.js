'use strict';

const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
router.use(authenticate);

// GET /balance — shipper balance view with VTP adjustment (NC Art.12.3 + Art.11)
// Entry = Nominations ENTRY + VTP BUY
// Exit  = Nominations EXIT  + VTP SELL
// Balance = Entry - Exit (should be 0 per NC Art.12.3)
router.get('/', authorize('billing:read'), async (req, res, next) => {
  const { gas_day, shipper_id } = req.query;
  const nomConds = []; const vtpConds = ["t.status = 'CONFIRMED'"];
  const nomParams = []; const vtpParams = [];
  let ni = 1; let vi = 1;
  if (gas_day) {
    nomConds.push(`n.gas_day = $${ni++}`); nomParams.push(gas_day);
    vtpConds.push(`t.gas_day = $${vi++}`); vtpParams.push(gas_day);
  }
  if (shipper_id) {
    nomConds.push(`n.shipper_id = $${ni++}`); nomParams.push(shipper_id);
    vtpConds.push(`t.shipper_id = $${vi++}`); vtpParams.push(shipper_id);
  }
  const nomWhere = nomConds.length ? `WHERE ${nomConds.join(' AND ')}` : '';
  const vtpWhere = `WHERE ${vtpConds.join(' AND ')}`;

  try {
    // Nomination balances
    const { rows: nomRows } = await db.query(
      `SELECT n.shipper_id, s.code AS shipper_code, s.name AS shipper_name, n.gas_day,
              SUM(CASE WHEN n.direction='ENTRY' THEN n.volume_kwh_h ELSE 0 END)::numeric AS nom_entry_kwh_h,
              SUM(CASE WHEN n.direction='EXIT'  THEN n.volume_kwh_h ELSE 0 END)::numeric AS nom_exit_kwh_h
       FROM nominations n JOIN shippers s ON s.id = n.shipper_id
       ${nomWhere} AND n.status NOT IN ('REJECTED','CANCELLED')
       GROUP BY n.shipper_id, s.code, s.name, n.gas_day
       ORDER BY n.gas_day DESC, s.code`,
      nomParams
    );

    // VTP balances (BUY = virtual entry, SELL = virtual exit)
    const { rows: vtpRows } = await db.query(
      `SELECT t.shipper_id, t.gas_day,
              SUM(CASE WHEN t.direction='BUY'  THEN t.volume_kwh_h ELSE 0 END)::numeric AS vtp_buy_kwh_h,
              SUM(CASE WHEN t.direction='SELL' THEN t.volume_kwh_h ELSE 0 END)::numeric AS vtp_sell_kwh_h
       FROM vtp_trades t
       ${vtpWhere}
       GROUP BY t.shipper_id, t.gas_day`,
      vtpParams
    );

    // Merge: combine nomination + VTP positions
    const vtpMap = {};
    for (const v of vtpRows) {
      vtpMap[`${v.shipper_id}_${v.gas_day}`] = v;
    }

    const balances = nomRows.map(n => {
      const vtp = vtpMap[`${n.shipper_id}_${n.gas_day}`] || { vtp_buy_kwh_h: 0, vtp_sell_kwh_h: 0 };
      const totalEntry = Number(n.nom_entry_kwh_h) + Number(vtp.vtp_buy_kwh_h);
      const totalExit  = Number(n.nom_exit_kwh_h)  + Number(vtp.vtp_sell_kwh_h);
      const diff = totalEntry - totalExit;
      return {
        shipper_id: n.shipper_id,
        shipper_code: n.shipper_code,
        shipper_name: n.shipper_name,
        gas_day: n.gas_day,
        nom_entry_kwh_h: Number(n.nom_entry_kwh_h),
        nom_exit_kwh_h: Number(n.nom_exit_kwh_h),
        vtp_buy_kwh_h: Number(vtp.vtp_buy_kwh_h),
        vtp_sell_kwh_h: Number(vtp.vtp_sell_kwh_h),
        total_entry_kwh_h: totalEntry,
        total_exit_kwh_h: totalExit,
        balance_kwh_h: diff,
        balanced: Math.abs(diff) < 1, // NC Art.12.3: entry = exit
      };
    });

    res.json({
      ncRef: 'NC Art.12.3 (Equal Nominations) + Art.11 (VTP = virtual entry/exit)',
      balances,
    });
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
