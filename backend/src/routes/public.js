'use strict';

/**
 * Transparency Portal — NC Art.24
 * Sprint 19 · US-1902
 *
 * Public endpoints — NO JWT required.
 * Data is anonymized (no shipper names/IDs in responses).
 * Rate-limited to 30 req/min per IP.
 *
 * Endpoints:
 *   GET /public/capacity      — Technical vs contracted capacity per IP
 *   GET /public/auctions      — Upcoming auction calendar + past results
 *   GET /public/gas-quality   — Latest gas quality data per IP (Art.17)
 *   GET /public/fuel-gas-price — Current FG tender price (Art.18.5.1.4)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

// Rate limiter: 30 req/min per IP
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Max 30 requests per minute.', ncRef: 'NC Art.24' },
});
router.use(publicLimiter);

// ── GET /public/capacity ─────────────────────────────────────────────────────
// Technical capacity, contracted total, and available per IP (anonymized)
router.get('/capacity', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT point, direction,
              SUM(capacity_kwh_h)::numeric AS total_contracted_kwh_h,
              COUNT(*)::int AS bookings_count
       FROM capacity_bookings
       WHERE status = 'ACTIVE'
       GROUP BY point, direction
       ORDER BY point, direction`
    );

    // Technical capacity from AERS
    const technical = [
      { point: 'KIREVO-ENTRY', direction: 'ENTRY', technical_kwh_h: 15280488 },
      { point: 'HORGOS-EXIT',  direction: 'EXIT',  technical_kwh_h: 10240233 },
      { point: 'EXIT-SERBIA',  direction: 'EXIT',  technical_kwh_h: 5040256 },
    ];

    const result = technical.map(t => {
      const contracted = rows.find(r => r.point === t.point && r.direction === t.direction);
      const contractedKwhH = contracted ? Number(contracted.total_contracted_kwh_h) : 0;
      const available = t.technical_kwh_h - contractedKwhH;
      return {
        point: t.point,
        direction: t.direction,
        technical_kwh_h: t.technical_kwh_h,
        contracted_kwh_h: contractedKwhH,
        available_kwh_h: Math.max(0, available),
        utilization_pct: Number((contractedKwhH / t.technical_kwh_h * 100).toFixed(1)),
      };
    });

    res.json({
      ncRef: 'NC Art.24 — Transparency: capacity publication',
      updated_at: new Date().toISOString(),
      capacities: result,
    });
  } catch (err) { next(err); }
});

// ── GET /public/auctions ─────────────────────────────────────────────────────
// Upcoming + recent auctions (anonymized: no bidder info)
router.get('/auctions', async (req, res, next) => {
  try {
    const { rows: upcoming } = await db.query(
      `SELECT id, product_type, auction_start_date, auction_end_date,
              delivery_start, delivery_end, status, reserve_price_eur
       FROM auction_calendar
       WHERE status IN ('OPEN', 'SCHEDULED') AND auction_start_date >= CURRENT_DATE
       ORDER BY auction_start_date
       LIMIT 20`
    );

    const { rows: recent } = await db.query(
      `SELECT id, product_type, auction_start_date, status,
              delivery_start, delivery_end, reserve_price_eur
       FROM auction_calendar
       WHERE status IN ('CLOSED', 'AWARDED') AND auction_end_date < CURRENT_DATE
       ORDER BY auction_end_date DESC
       LIMIT 10`
    );

    res.json({
      ncRef: 'NC Art.24 — Transparency: auction publication',
      upcoming,
      recent,
    });
  } catch (err) { next(err); }
});

// ── GET /public/gas-quality ──────────────────────────────────────────────────
// Latest gas quality measurements per IP (NC Art.17)
router.get('/gas-quality', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (point_code) point_code,
              gas_day, gcv_kwh_nm3, wobbe_kwh_nm3,
              methane_pct, co2_pct, h2s_mg_nm3,
              density_kg_nm3, temperature_c, pressure_bar
       FROM gas_quality_daily
       ORDER BY point_code, gas_day DESC`
    );

    res.json({
      ncRef: 'NC Art.17 / Art.24 — Gas quality transparency',
      measurements: rows,
    });
  } catch (err) { next(err); }
});

// ── GET /public/fuel-gas-price ───────────────────────────────────────────────
// Current FG tender price (Art.18.5.1.4: published daily on TSO website)
router.get('/fuel-gas-price', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT value FROM system_params WHERE key = 'fuel_gas_price_eur_mwh'`
    );
    const price = rows.length ? parseFloat(rows[0].value) : null;

    res.json({
      ncRef: 'NC Art.18.5.1.4 — Fuel gas price published daily',
      fuel_gas_price_eur_mwh: price,
      currency: 'EUR',
      unit: 'EUR/MWh',
      updated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
