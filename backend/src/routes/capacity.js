'use strict';

/**
 * Capacity Tracker API — RBP.EU Free Capacity Vitrine
 *
 * GET  /capacity/tracker               — main tracker: all IPs, contracted vs free
 * GET  /capacity/tracker/rbp-offerings — what can be offered on RBP.EU right now
 * GET  /capacity/tracker/products      — per-product-tier breakdown (UIOLI stacking)
 * GET  /capacity/tracker/uioli         — UIOLI daily pool (last N days)
 * GET  /capacity/tracker/:point_code   — single IP detail
 * POST /capacity/surrender             — initiate surrender (NC Art. 8.3)
 * GET  /capacity/surrender             — list surrender events
 * PATCH /capacity/surrender/:id/rbp    — update RBP.EU resale result
 *
 * Legacy endpoints (capacity_bookings table — backward compat):
 * GET  /capacity                       — legacy booking list
 * GET  /capacity/summary               — legacy summary
 * GET  /capacity/:id                   — legacy single booking
 * POST /capacity                       — legacy create booking
 *
 * Capacity model (migration 006 / Gastrans NC / CAM NC):
 *
 *   free_kwh_h = reserved_kwh_h − contracted_kwh_h + surrendered_kwh_h
 *
 *   Product tiers (UIOLI stacking, CAM NC Art. 13-16):
 *     Annual:     reserved − annual_contracted
 *     Quarterly:  reserved − (annual + quarterly contracted)
 *     Monthly:    reserved − (annual + quarterly + monthly contracted)
 *     Daily:      reserved − (annual + quarterly + monthly + daily contracted)
 *     Within-Day: reserved − all_contracted
 *
 *   UIOLI daily pool:
 *     contracted_kwh_day (annual holders) − actual_nominations_kwh = uioli_free
 */

const express   = require('express');
const { body, param, validationResult } = require('express-validator');
const db         = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const { addAudit }  = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtKwhH(v) {
  if (!v) return '0';
  if (v >= 1e9)  return `${(v / 1e9).toFixed(3)} TWh/h`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(3)} GWh/h`;
  if (v >= 1e3)  return `${(v / 1e3).toFixed(1)} MWh/h`;
  return `${v} kWh/h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracker endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /capacity/tracker
 * Main capacity vitrine — all IPs, contracted vs free, EUR value.
 */
router.get('/tracker', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        point_code, direction, point_name, gas_year,
        tech_kwh_h, reserved_kwh_h,
        contracted_kwh_h, surrendered_kwh_h, free_kwh_h,
        contracted_pct, free_pct, free_annual_value_eur,
        ROUND(
          free_kwh_h * CASE point_code
            WHEN 'KIREVO-ENTRY' THEN 6.00
            WHEN 'HORGOS-EXIT'  THEN 6.85
            WHEN 'EXIT-SERBIA'  THEN 4.19
            ELSE 0
          END / 365, 2
        ) AS free_daily_value_eur,
        free_kwh_h >= 1000 AS rbp_offerable,
        NOW() AS as_of
      FROM v_capacity_available
      ORDER BY direction, point_code
    `);

    const totalReserved   = rows.reduce((s, r) => s + Number(r.reserved_kwh_h   || 0), 0);
    const totalContracted = rows.reduce((s, r) => s + Number(r.contracted_kwh_h || 0), 0);
    const totalFree       = rows.reduce((s, r) => s + Number(r.free_kwh_h       || 0), 0);
    const totalFreeEur    = rows.reduce((s, r) => s + Number(r.free_annual_value_eur || 0), 0);

    res.json({
      summary: {
        total_reserved_kwh_h:   totalReserved,
        total_contracted_kwh_h: totalContracted,
        total_free_kwh_h:       totalFree,
        total_contracted_pct:   totalReserved > 0
          ? parseFloat((totalContracted / totalReserved * 100).toFixed(2)) : 0,
        free_annual_value_eur:  totalFreeEur,
        free_annual_value_fmt:  `€${(totalFreeEur / 1e6).toFixed(2)}M / year`,
        rbp_offerable_points:   rows.filter(r => r.rbp_offerable).map(r => r.point_code),
        as_of:                  new Date().toISOString(),
      },
      by_point: rows.map(r => ({
        ...r,
        tech_fmt:       fmtKwhH(Number(r.tech_kwh_h)),
        reserved_fmt:   fmtKwhH(Number(r.reserved_kwh_h)),
        contracted_fmt: fmtKwhH(Number(r.contracted_kwh_h)),
        free_fmt:       fmtKwhH(Number(r.free_kwh_h)),
      })),
    });
  } catch (err) { next(err); }
});

/**
 * GET /capacity/tracker/rbp-offerings
 * What Gastrans CAN publish on RBP.EU right now — per product tier × IP.
 */
router.get('/tracker/rbp-offerings', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        point_code, direction, point_name,
        product_tier, auction_window, allocation_mechanism,
        reserved_kwh_h, contracted_this_tier_kwh_h,
        contracted_all_higher_kwh_h, free_kwh_h, gas_year,
        ROUND(free_kwh_h * CASE point_code
          WHEN 'KIREVO-ENTRY' THEN 6.00
          WHEN 'HORGOS-EXIT'  THEN 6.85
          WHEN 'EXIT-SERBIA'  THEN 4.19
          ELSE 0
        END * CASE product_tier
          WHEN 'ANNUAL'     THEN 1.0
          WHEN 'QUARTERLY'  THEN 0.25
          WHEN 'MONTHLY'    THEN 1.0/12
          WHEN 'DAILY'      THEN 1.0/365
          WHEN 'WITHIN_DAY' THEN 1.0/365/24
        END, 2) AS offering_value_eur,
        free_kwh_h >= 1000 AS offerable
      FROM v_rbp_product_slots
      ORDER BY point_code,
        CASE product_tier
          WHEN 'ANNUAL' THEN 1 WHEN 'QUARTERLY' THEN 2 WHEN 'MONTHLY' THEN 3
          WHEN 'DAILY' THEN 4 WHEN 'WITHIN_DAY' THEN 5 END
    `);

    const byPoint = {};
    for (const r of rows) {
      if (!byPoint[r.point_code]) {
        byPoint[r.point_code] = {
          point_code: r.point_code, point_name: r.point_name,
          direction: r.direction, gas_year: r.gas_year, products: [],
        };
      }
      byPoint[r.point_code].products.push({
        tier:             r.product_tier,
        auction_window:   r.auction_window,
        mechanism:        r.allocation_mechanism,
        reserved_kwh_h:   Number(r.reserved_kwh_h),
        contracted_kwh_h: Number(r.contracted_all_higher_kwh_h),
        free_kwh_h:       Number(r.free_kwh_h),
        free_fmt:         fmtKwhH(Number(r.free_kwh_h)),
        offering_value_eur: Number(r.offering_value_eur),
        offerable:        r.offerable,
      });
    }

    const totalAnnualValue = rows
      .filter(r => r.product_tier === 'ANNUAL')
      .reduce((s, r) => s + Number(r.offering_value_eur || 0), 0);

    // Получить ближайшие аукционы из auction_calendar (migration 008)
    let nextAuctions = [];
    try {
      const { rows: acRows } = await db.query(`
        SELECT product_type, capacity_type, auction_round,
               auction_start_date, delivery_start, delivery_end,
               (auction_start_date - CURRENT_DATE)::INTEGER AS days_until_open,
               status
        FROM auction_calendar
        WHERE status IN ('UPCOMING','OPEN')
          AND delivery_end > NOW()
          AND product_type IN ('ANNUAL','QUARTERLY','MONTHLY')
        ORDER BY auction_start_date ASC
        LIMIT 6
      `);
      nextAuctions = acRows;
    } catch (_) { /* auction_calendar not yet migrated — graceful fallback */ }

    res.json({
      meta: {
        as_of:               new Date().toISOString(),
        annual_free_value_eur: totalAnnualValue,
        note_uioli:
          'Daily/Within-Day free includes UIOLI from unutilized annual contracts. ' +
          'See /capacity/tracker/uioli for day-level detail.',
        note_auction:
          'Use POST /auctions/bids to place bids on upcoming auctions. ' +
          'See /auctions/calendar for full CAM NC schedule (MAR0277-24).',
        cam_nc_source: 'MAR0277-24 Final, October 7th 2024 (ENTSOG)',
      },
      next_auctions: nextAuctions,
      by_point: Object.values(byPoint),
      flat:     rows,
    });
  } catch (err) { next(err); }
});

/**
 * GET /capacity/tracker/products?point_code=KIREVO-ENTRY
 */
router.get('/tracker/products', authorize('capacity:read'), async (req, res, next) => {
  const { point_code } = req.query;
  try {
    let query = `SELECT * FROM v_rbp_product_slots WHERE 1=1`;
    const params = [];
    if (point_code) { query += ` AND point_code = $1`; params.push(point_code); }
    query += ` ORDER BY point_code, CASE product_tier
      WHEN 'ANNUAL' THEN 1 WHEN 'QUARTERLY' THEN 2 WHEN 'MONTHLY' THEN 3
      WHEN 'DAILY' THEN 4 WHEN 'WITHIN_DAY' THEN 5 END`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * GET /capacity/tracker/uioli?days=30
 * UIOLI daily free pool — CAM NC Art. 13-16.
 */
router.get('/tracker/uioli', authorize('capacity:read'), async (req, res, next) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
  try {
    let rows = [];
    try {
      const result = await db.query(`
        SELECT gas_day, point_code, direction,
               contracted_kwh_day, nominated_kwh,
               uioli_free_kwh, uioli_pct, uioli_free_kwh_h
        FROM v_uioli_daily
        WHERE gas_day >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY gas_day DESC, point_code
      `);
      rows = result.rows;
    } catch (_) { rows = []; }

    // Fallback estimation if no MDAP data yet
    if (rows.length === 0) {
      const contracted = {
        'KIREVO-ENTRY': 13752230 * 24,
        'HORGOS-EXIT':   9216209 * 24,
        'EXIT-SERBIA':   4536021 * 24,
      };
      const utilPct = 0.72; // Gastrans April 2025 actual utilisation
      const today   = new Date();
      for (let d = 0; d < Math.min(days, 7); d++) {
        const day = new Date(today - d * 86400000).toISOString().slice(0, 10);
        for (const [pt, cDay] of Object.entries(contracted)) {
          rows.push({
            gas_day:            day,
            point_code:         pt,
            contracted_kwh_day: cDay,
            nominated_kwh:      cDay * utilPct,
            uioli_free_kwh:     cDay * (1 - utilPct),
            uioli_pct:          ((1 - utilPct) * 100).toFixed(1),
            uioli_free_kwh_h:   ((cDay * (1 - utilPct)) / 24).toFixed(0),
            estimated:          true,
            note:
              'MDAP nominations not yet loaded. ' +
              'Based on 72% utilisation (Gastrans Annex 3A April 2025 actuals: ' +
              '~220M kWh/d vs 330M kWh/d contracted).',
          });
        }
      }
    }

    const byPoint = {};
    for (const r of rows) {
      if (!byPoint[r.point_code]) {
        byPoint[r.point_code] = { point_code: r.point_code, days: [] };
      }
      byPoint[r.point_code].days.push(r);
    }
    for (const p of Object.values(byPoint)) {
      const n = p.days.length;
      p.avg_uioli_pct   = n ? parseFloat((p.days.reduce((s, r) => s + parseFloat(r.uioli_pct   || 0), 0) / n).toFixed(1)) : 0;
      p.avg_uioli_kwh_h = n ? parseFloat((p.days.reduce((s, r) => s + parseFloat(r.uioli_free_kwh_h || 0), 0) / n).toFixed(0)) : 0;
      p.total_uioli_kwh = p.days.reduce((s, r) => s + parseFloat(r.uioli_free_kwh || 0), 0);
    }

    res.json({
      meta: {
        period_days: days,
        as_of:       new Date().toISOString(),
        note_cam_nc:
          'UIOLI (CAM NC Art. 13-16): annual holders who do not nominate lose that day\'s '  +
          'capacity. TSO re-offers it at D-1 FCFS / within-day. '                           +
          'Shipper still pays full take-or-pay transmission fee (NC Art. 18.1.4).',
      },
      by_point: Object.values(byPoint),
      daily:    rows,
    });
  } catch (err) { next(err); }
});

/**
 * GET /capacity/tracker/:point_code
 */
router.get('/tracker/:point_code', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows: avail } = await db.query(
      `SELECT * FROM v_capacity_available WHERE point_code = $1`,
      [req.params.point_code]
    );
    if (!avail.length) {
      return res.status(404).json({ error: 'Point not found in capacity_technical' });
    }

    const [products, contracts, surrenders] = await Promise.all([
      db.query(
        `SELECT * FROM v_rbp_product_slots WHERE point_code = $1
         ORDER BY CASE product_tier
           WHEN 'ANNUAL' THEN 1 WHEN 'QUARTERLY' THEN 2 WHEN 'MONTHLY' THEN 3
           WHEN 'DAILY' THEN 4 WHEN 'WITHIN_DAY' THEN 5 END`,
        [req.params.point_code]
      ),
      db.query(
        `SELECT c.contract_no, c.contract_type, c.booking_period,
                c.cap_entry_kwh_h, c.cap_exit_kwh_h, c.capacity_kwh_h,
                c.tariff_entry_eur_kwh_h, c.tariff_exit_eur_kwh_h,
                c.start_date, c.end_date, c.flow_direction, c.status,
                s.name AS shipper_name, s.code AS shipper_code
         FROM contracts c
         JOIN shippers s ON s.id = c.shipper_id
         WHERE c.status = 'ACTIVE'
           AND (c.entry_point_code = $1 OR c.exit_point_code = $1)
           AND c.start_date <= CURRENT_DATE
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
         ORDER BY c.contract_type, c.start_date`,
        [req.params.point_code]
      ),
      db.query(
        `SELECT * FROM capacity_surrenders
         WHERE point_code = $1 ORDER BY surrendered_at DESC LIMIT 20`,
        [req.params.point_code]
      ),
    ]);

    const a = avail[0];
    res.json({
      point: { ...a, free_fmt: fmtKwhH(Number(a.free_kwh_h)), reserved_fmt: fmtKwhH(Number(a.reserved_kwh_h)) },
      products: products.rows,
      contracts: {
        count: contracts.rows.length,
        items: contracts.rows,
        total_contracted_kwh_h: contracts.rows.reduce(
          (s, c) => s + parseFloat(c.cap_entry_kwh_h || c.capacity_kwh_h || 0), 0),
      },
      surrenders: {
        count: surrenders.rows.length,
        items: surrenders.rows,
        total_surrendered_kwh_h: surrenders.rows
          .filter(s => ['OFFERED_RBP','SOLD','PARTIAL'].includes(s.status))
          .reduce((s, r) => s + parseFloat(r.surrendered_kwh_h || 0), 0),
      },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Surrender workflow (NC Art. 8.3)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/surrender',
  authorize('contracts:update'),
  [
    body('contractId').isInt({ min: 1 }),
    body('surrenderedKwhH').isFloat({ min: 1 }),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { contractId, surrenderedKwhH, periodFrom, periodTo } = req.body;

    try {
      const { rows: cRows } = await db.query(
        `SELECT c.*, s.name AS shipper_name FROM contracts c
         JOIN shippers s ON s.id = c.shipper_id
         WHERE c.id = $1 AND c.status = 'ACTIVE'`,
        [contractId]
      );
      if (!cRows.length) return res.status(404).json({ error: 'Active contract not found' });

      const contract   = cRows[0];
      const maxSurr    = parseFloat(contract.cap_entry_kwh_h || contract.capacity_kwh_h || 0);
      if (Number(surrenderedKwhH) > maxSurr) {
        return res.status(400).json({
          error: `Cannot surrender ${surrenderedKwhH} kWh/h — contract only has ${maxSurr} kWh/h`,
        });
      }

      const { rows: result } = await db.query(
        `SELECT * FROM fn_create_surrender($1, $2, $3, $4, $5)`,
        [contractId, surrenderedKwhH, periodFrom, periodTo, req.user.id]
      );

      const days    = Math.round((new Date(periodTo) - new Date(periodFrom)) / 86400000) + 1;
      const tariff  = parseFloat(contract.tariff_entry_eur_kwh_h || 4.19);
      const premium = parseFloat((surrenderedKwhH * tariff / 365 * days).toFixed(2));

      await addAudit({
        actionType: 'SURRENDER_CREATE', entityType: 'contract', entityId: contract.id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description:
          `Surrender ${result[0].surrender_ref} | GTA ${contract.contract_no} | ` +
          `${contract.shipper_name} | ${surrenderedKwhH} kWh/h | ` +
          `${periodFrom}→${periodTo} (${days}d) | Premium est. €${premium}`,
      });

      res.status(201).json({
        surrender_ref:     result[0].surrender_ref,
        status:            result[0].status,
        contract_no:       contract.contract_no,
        shipper:           contract.shipper_name,
        surrendered_kwh_h: Number(surrenderedKwhH),
        period_from:       periodFrom,
        period_to:         periodTo,
        billing_days:      days,
        nc_art_8_3: {
          reserve_price_eur_kwh_h: tariff,
          auction_premium_est_eur: premium,
          note:
            'If RBP.EU resale < reserve price → Uncovered Auction Premium '    +
            'charged to shipper per NC Art. 8.3, invoiced per Art. 20.3.2.4.',
        },
        next_steps: [
          'Surrender PENDING. List on RBP.EU and record ref.',
          'PATCH /capacity/surrender/:id/rbp with resale result.',
          'Uncovered premium auto-added to next billing cycle.',
        ],
      });
    } catch (err) { next(err); }
  }
);

router.get('/surrender', authorize('capacity:read'), async (req, res, next) => {
  const { status, point_code, contract_id } = req.query;
  const conds = ['1=1']; const params = []; let i = 1;
  if (status)      { conds.push(`cs.status = $${i++}`);       params.push(status); }
  if (point_code)  { conds.push(`cs.point_code = $${i++}`);   params.push(point_code); }
  if (contract_id) { conds.push(`cs.contract_id = $${i++}`);  params.push(contract_id); }

  try {
    const { rows } = await db.query(
      `SELECT cs.*, c.contract_no, c.flow_direction,
              s.name AS shipper_name, s.code AS shipper_code
       FROM capacity_surrenders cs
       LEFT JOIN contracts  c ON c.id  = cs.contract_id
       LEFT JOIN shippers   s ON s.id  = c.shipper_id
       WHERE ${conds.join(' AND ')}
       ORDER BY cs.surrendered_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch(
  '/surrender/:id/rbp',
  authorize('billing:update'),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(['OFFERED_RBP','SOLD','UNSOLD','PARTIAL']),
    body('rbpListingRef').optional().isString(),
    body('resalePriceEurKwhH').optional().isFloat({ min: 0 }),
    body('soldKwhH').optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { status, rbpListingRef, resalePriceEurKwhH, soldKwhH } = req.body;

    try {
      const { rows: srRows } = await db.query(
        `SELECT * FROM capacity_surrenders WHERE id = $1`, [req.params.id]
      );
      if (!srRows.length) return res.status(404).json({ error: 'Surrender not found' });

      const sr   = srRows[0];
      const days = Math.round((new Date(sr.period_to) - new Date(sr.period_from)) / 86400000) + 1;

      let auctionPremium = null, uncoveredPremium = null;
      if (resalePriceEurKwhH !== undefined) {
        const qty            = soldKwhH || sr.surrendered_kwh_h;
        const reserveRevenue = parseFloat(sr.reserve_price_eur_kwh_h) * qty / 365 * days;
        const resaleRevenue  = resalePriceEurKwhH * qty / 365 * days;
        auctionPremium   = parseFloat((reserveRevenue - resaleRevenue).toFixed(2));
        uncoveredPremium = auctionPremium > 0 ? auctionPremium : 0;
      }

      const updates = [`status = $1`]; const params = [status]; let i = 2;
      if (rbpListingRef)                { updates.push(`rbp_listing_ref = $${i++}`);          params.push(rbpListingRef); }
      if (resalePriceEurKwhH !== undefined) { updates.push(`resale_price_eur_kwh_h = $${i++}`); params.push(resalePriceEurKwhH); }
      if (auctionPremium   !== null)    { updates.push(`auction_premium_eur = $${i++}`);      params.push(auctionPremium); }
      if (uncoveredPremium !== null)    { updates.push(`uncovered_premium_eur = $${i++}`);    params.push(uncoveredPremium); }
      params.push(req.params.id);

      const { rows } = await db.query(
        `UPDATE capacity_surrenders SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
        params
      );

      await addAudit({
        actionType: 'SURRENDER_UPDATE', entityType: 'surrender', entityId: sr.id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description:
          `Surrender ${sr.surrender_ref} → ${status} | RBP: ${rbpListingRef || '—'} | ` +
          `Resale: €${resalePriceEurKwhH || '—'}/kWh/h | Uncovered Premium: €${uncoveredPremium || 0}`,
      });

      const qty = soldKwhH || sr.surrendered_kwh_h;
      res.json({
        ...rows[0],
        _premium_calc: auctionPremium !== null ? {
          reserve_revenue_eur:   parseFloat(sr.reserve_price_eur_kwh_h) * qty / 365 * days,
          resale_revenue_eur:    resalePriceEurKwhH * qty / 365 * days,
          auction_premium_eur:   auctionPremium,
          uncovered_premium_eur: uncoveredPremium,
          invoice_note:          uncoveredPremium > 0
            ? `€${uncoveredPremium} → next invoice per NC Art. 20.3.2.4`
            : 'No uncovered premium — resale ≥ reserve price',
        } : null,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Legacy endpoints — capacity_bookings table (backward compat)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cb.*, s.code AS shipper_code, s.name AS shipper_name,
              ROUND(cb.allocated_mwh_d / NULLIF(cb.capacity_mwh_d,0) * 100, 2) AS utilization_pct
       FROM capacity_bookings cb JOIN shippers s ON s.id = cb.shipper_id
       ORDER BY cb.point, cb.direction`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/summary', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT point, direction,
             SUM(capacity_mwh_d)  AS total_capacity,
             SUM(allocated_mwh_d) AS total_allocated,
             ROUND(SUM(allocated_mwh_d) / NULLIF(SUM(capacity_mwh_d),0) * 100, 2) AS utilization_pct
      FROM capacity_bookings WHERE status = 'ACTIVE'
      GROUP BY point, direction ORDER BY point, direction
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', authorize('capacity:read'), async (req, res, next) => {
  if (['tracker','surrender'].includes(req.params.id)) return next();
  try {
    const { rows } = await db.query(
      `SELECT cb.*, s.code AS shipper_code, s.name AS shipper_name
       FROM capacity_bookings cb JOIN shippers s ON s.id = cb.shipper_id WHERE cb.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post(
  '/',
  authorize('capacity:create'),
  [
    body('shipperId').isUUID(),
    body('point').trim().isLength({ min: 1 }),
    body('direction').isIn(['ENTRY','EXIT']),
    body('bookingType').isIn(['FIRM','INTERRUPTIBLE']),
    body('capacityMwhD').isFloat({ min: 0 }),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, point, direction, bookingType, capacityMwhD, periodFrom, periodTo } = req.body;
    const year = new Date().getFullYear();
    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) AS c FROM capacity_bookings WHERE EXTRACT(YEAR FROM created_at) = $1`, [year]
    );
    const bookingRef = `CAP-${year}-${String(Number(cnt[0].c) + 1).padStart(3, '0')}`;

    try {
      const { rows } = await db.query(
        `INSERT INTO capacity_bookings
           (booking_ref, shipper_id, point, direction, booking_type, capacity_mwh_d,
            period_from, period_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [bookingRef, shipperId, point, direction, bookingType, capacityMwhD,
         periodFrom, periodTo, req.user.id]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

module.exports = router;
