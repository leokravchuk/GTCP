'use strict';

/**
 * Bid Reporting API — Sprint 21 · US-2106
 *
 * Aggregates auction_bids + WD capacity_bookings into unified bid portfolio.
 *
 * GET  /bids/my      — all bids for current shipper (or all for admin)
 * GET  /bids/report  — KPI aggregation
 * GET  /bids/export  — CSV/XLSX export
 */

const express = require('express');
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { rowsToCsv, sendCsv } = require('../utils/csvExport');
const { rowsToXlsx, sendXlsx } = require('../utils/xlsxExport');

const router = express.Router();
router.use(authenticate);

// Common SQL for unified bid view (auction_bids + WD bookings)
function unifiedBidsSQL(where = '', extraParams = []) {
  return {
    sql: `
      SELECT 'GTCP' AS channel, b.id AS bid_id, 'BID-' || b.id AS ref,
             ac.product_type, ac.capacity_type, ac.point_code AS point,
             b.bid_capacity_kwh_h AS volume_kwh_h,
             b.offered_price_eur AS price_eur,
             (b.bid_capacity_kwh_h * COALESCE(b.offered_price_eur, 0))::numeric(18,2) AS fee_eur,
             b.status, b.shipper_id,
             s.code AS shipper_code, s.name AS shipper_name,
             ac.delivery_start, ac.delivery_end,
             b.created_at
        FROM auction_bids b
        JOIN auction_calendar ac ON ac.id = b.auction_calendar_id
        JOIN shippers s ON s.id = b.shipper_id
       ${where ? 'WHERE ' + where : ''}
      UNION ALL
      SELECT 'WD' AS channel, cb.id AS bid_id, 'WD-' || cb.id AS ref,
             'WITHIN_DAY' AS product_type, 'FIRM' AS capacity_type, cb.point,
             cb.capacity_kwh_h AS volume_kwh_h,
             NULL AS price_eur,
             NULL AS fee_eur,
             cb.status, cb.shipper_id,
             s.code AS shipper_code, s.name AS shipper_name,
             cb.period_from AS delivery_start, cb.period_to AS delivery_end,
             cb.created_at
        FROM capacity_bookings cb
        JOIN shippers s ON s.id = cb.shipper_id
       WHERE cb.product_type = 'WITHIN_DAY'
         ${where ? 'AND ' + where.replace(/b\./g, 'cb.').replace(/ac\./g, '') : ''}
      ORDER BY created_at DESC`,
    params: extraParams,
  };
}

// GET /bids/my — all bids (admin=all, other=own)
router.get('/my', authorize('capacity:read'), async (req, res, next) => {
  const { shipper_id, product_type, status, channel, limit = 100, offset = 0 } = req.query;
  const isAdmin = req.user.role === 'admin';

  const conds = []; const params = []; let i = 1;
  if (!isAdmin) { conds.push(`b.shipper_id = $${i++}`); params.push(req.user.id); }
  if (shipper_id && isAdmin) { conds.push(`b.shipper_id = $${i++}`); params.push(shipper_id); }
  if (status) { conds.push(`b.status = $${i++}`); params.push(status); }

  const where = conds.length ? conds.join(' AND ') : '';

  try {
    // Auction bids
    const { rows: auctionBids } = await db.query(
      `SELECT 'GTCP' AS channel, b.id AS bid_id, 'BID-' || b.id AS ref,
              ac.product_type, ac.capacity_type, ac.point_code AS point,
              b.bid_capacity_kwh_h AS volume_kwh_h,
              b.offered_price_eur AS price_eur,
              (b.bid_capacity_kwh_h * COALESCE(b.offered_price_eur, 0))::numeric(18,2) AS fee_eur,
              b.status, b.shipper_id, s.code AS shipper_code, s.name AS shipper_name,
              ac.delivery_start, ac.delivery_end, b.created_at
         FROM auction_bids b
         JOIN auction_calendar ac ON ac.id = b.auction_calendar_id
         JOIN shippers s ON s.id = b.shipper_id
         ${where ? 'WHERE ' + where : ''}
         ORDER BY b.created_at DESC
         LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );

    // WD bookings
    const wdConds = conds.map(c => c.replace(/b\./g, 'cb.'));
    const wdWhere = wdConds.length
      ? "WHERE cb.product_type = 'WITHIN_DAY' AND " + wdConds.join(' AND ')
      : "WHERE cb.product_type = 'WITHIN_DAY'";

    const { rows: wdBookings } = await db.query(
      `SELECT 'WD' AS channel, cb.id AS bid_id, 'WD-' || cb.id AS ref,
              'WITHIN_DAY' AS product_type, 'FIRM' AS capacity_type, cb.point,
              cb.capacity_kwh_h AS volume_kwh_h,
              NULL AS price_eur, NULL AS fee_eur,
              cb.status, cb.shipper_id, s.code AS shipper_code, s.name AS shipper_name,
              cb.period_from AS delivery_start, cb.period_to AS delivery_end,
              cb.created_at
         FROM capacity_bookings cb
         JOIN shippers s ON s.id = cb.shipper_id
         ${wdWhere}
         ORDER BY cb.created_at DESC
         LIMIT 50`,
      params.slice() // reuse shipper filter params
    );

    const all = [...auctionBids, ...wdBookings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply channel filter client-side if needed
    const filtered = channel ? all.filter(r => r.channel === channel) : all;

    res.json(filtered);
  } catch (err) { next(err); }
});

// GET /bids/report — KPI aggregation
router.get('/report', authorize('capacity:read'), async (req, res, next) => {
  const { from, to } = req.query;
  const conds = []; const params = []; let i = 1;
  if (from) { conds.push(`b.created_at >= $${i++}`); params.push(from); }
  if (to)   { conds.push(`b.created_at <= $${i++}`); params.push(to); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total_bids,
         COUNT(*) FILTER (WHERE b.status = 'DRAFT')::int AS draft,
         COUNT(*) FILTER (WHERE b.status = 'SUBMITTED')::int AS submitted,
         COUNT(*) FILTER (WHERE b.status IN ('WON','PARTIALLY_WON'))::int AS won,
         COUNT(*) FILTER (WHERE b.status = 'LOST')::int AS lost,
         COUNT(*) FILTER (WHERE b.status = 'CONTRACT_CREATED')::int AS contracted,
         COALESCE(SUM(b.bid_capacity_kwh_h) FILTER (WHERE b.status IN ('WON','PARTIALLY_WON','CONTRACT_CREATED')), 0)::numeric AS won_volume_kwh_h,
         COALESCE(SUM(b.bid_capacity_kwh_h * COALESCE(b.offered_price_eur, 0)) FILTER (WHERE b.status IN ('WON','PARTIALLY_WON','CONTRACT_CREATED')), 0)::numeric(18,2) AS won_fee_eur
       FROM auction_bids b ${where}`,
      params
    );

    // WD stats
    const { rows: wdRows } = await db.query(
      `SELECT COUNT(*)::int AS wd_count,
              COALESCE(SUM(capacity_kwh_h), 0)::numeric AS wd_total_kwh_h
       FROM capacity_bookings WHERE product_type = 'WITHIN_DAY'`
    );

    // Breakdown by product
    const { rows: breakdown } = await db.query(
      `SELECT ac.product_type,
              COUNT(*)::int AS bid_count,
              COALESCE(SUM(b.bid_capacity_kwh_h), 0)::numeric AS total_volume,
              COALESCE(AVG(b.offered_price_eur), 0)::numeric(10,4) AS avg_price,
              COUNT(*) FILTER (WHERE b.status IN ('WON','PARTIALLY_WON'))::int AS won_count,
              CASE WHEN COUNT(*) > 0
                THEN ROUND(COUNT(*) FILTER (WHERE b.status IN ('WON','PARTIALLY_WON'))::numeric / COUNT(*) * 100, 1)
                ELSE 0 END AS win_rate_pct
       FROM auction_bids b
       JOIN auction_calendar ac ON ac.id = b.auction_calendar_id
       ${where}
       GROUP BY ac.product_type
       ORDER BY ac.product_type`
    );

    res.json({
      summary: { ...rows[0], ...wdRows[0] },
      breakdown,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// GET /bids/export — CSV/XLSX
router.get('/export', authorize('capacity:read'), async (req, res, next) => {
  const { format, status, product_type } = req.query;
  const conds = []; const params = []; let i = 1;
  if (status) { conds.push(`b.status = $${i++}`); params.push(status); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  try {
    const { rows } = await db.query(
      `SELECT 'BID-' || b.id AS ref, ac.product_type, ac.capacity_type,
              ac.point_code AS point, b.bid_capacity_kwh_h AS volume_kwh_h,
              b.offered_price_eur AS price_eur,
              (b.bid_capacity_kwh_h * COALESCE(b.offered_price_eur, 0))::numeric(18,2) AS fee_eur,
              b.status, s.code AS shipper_code,
              ac.delivery_start, ac.delivery_end, b.created_at
         FROM auction_bids b
         JOIN auction_calendar ac ON ac.id = b.auction_calendar_id
         JOIN shippers s ON s.id = b.shipper_id
         ${where}
         ORDER BY b.created_at DESC`,
      params
    );

    const columns = [
      { key: 'ref',           header: 'Ref' },
      { key: 'product_type',  header: 'Product' },
      { key: 'capacity_type', header: 'Capacity Type' },
      { key: 'point',         header: 'IP' },
      { key: 'volume_kwh_h',  header: 'Volume kWh/h', type: 'number' },
      { key: 'price_eur',     header: 'Price EUR', type: 'eur' },
      { key: 'fee_eur',       header: 'Fee EUR', type: 'eur' },
      { key: 'status',        header: 'Status' },
      { key: 'shipper_code',  header: 'Shipper' },
      { key: 'delivery_start',header: 'Delivery From', type: 'date' },
      { key: 'delivery_end',  header: 'Delivery To', type: 'date' },
      { key: 'created_at',    header: 'Created' },
    ];

    if (format === 'xlsx') {
      const buffer = await rowsToXlsx(rows, columns, 'Bids');
      return sendXlsx(res, 'bids-report', buffer);
    }
    const csv = rowsToCsv(rows, columns);
    return sendCsv(res, 'bids-report', csv);
  } catch (err) { next(err); }
});

module.exports = router;
