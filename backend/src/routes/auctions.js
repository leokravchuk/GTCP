'use strict';

/**
 * Auctions API — Full Lifecycle Management
 * CAM NC EU 2017/459 + MAR0277-24
 * =====================================================================
 * Lifecycle: Free Capacity → Bid → Won → Contract → Billing
 *
 * GET  /auctions/calendar                 — расписание (с фильтрами)
 * GET  /auctions/calendar/upcoming        — ближайшие по каждому IP
 * GET  /auctions/calendar/next            — следующий по product_type
 * GET  /auctions/calendar/:id             — один аукцион с деталями
 * PATCH /auctions/calendar/:id/status     — обновить статус (OPEN/CLOSED/CANCELLED)
 *
 * GET  /auctions/bids                     — все заявки (с фильтрами)
 * POST /auctions/bids                     — создать заявку (DRAFT)
 * GET  /auctions/bids/:id                 — одна заявка полный lifecycle
 * PATCH /auctions/bids/:id                — обновить параметры заявки
 * POST /auctions/bids/:id/submit          — отправить на RBP.EU (DRAFT→SUBMITTED)
 * POST /auctions/bids/:id/result          — записать результат (WON/LOST/PARTIAL)
 * POST /auctions/bids/:id/create-contract — создать контракт из победы
 * DELETE /auctions/bids/:id               — отозвать заявку (DRAFT→CANCELLED)
 *
 * GET  /auctions/summary                  — дашборд: статистика по всем аукционам
 * GET  /auctions/timeline?days=90         — timeline предстоящих событий
 * =====================================================================
 */

const express = require('express');
const { body, query: qv, param, validationResult } = require('express-validator');
const db          = require('../db');
const authenticate   = require('../middleware/authenticate');
const authorize      = require('../middleware/authorize');
const { addAudit }   = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────
// Константы CAM NC
// ─────────────────────────────────────────────────────────────
const PRODUCT_TYPES   = ['ANNUAL','QUARTERLY','MONTHLY','DAILY','WITHIN_DAY'];
const CAPACITY_TYPES  = ['FIRM','INTERRUPTIBLE'];
const BID_STATUSES    = ['DRAFT','SUBMITTED','UNDER_REVIEW','WON','PARTIALLY_WON',
                         'LOST','CANCELLED','CONTRACT_CREATED'];
const AUCTION_STATUSES = ['UPCOMING','OPEN','CLOSED','RESULTS_PUBLISHED','CANCELLED'];
const FLOW_DIRECTIONS = ['GOSPODJINCI_HORGOS','HORGOS_GOSPODJINCI','KIREVO_EXIT_SERBIA'];

// Тарифы АЕРС 05-145 (для оценки выручки в заявках)
const TARIFFS = {
  GOSPODJINCI_HORGOS:  { entry: 4.19, exit: 6.85, label: 'Transit Firm' },
  HORGOS_GOSPODJINCI:  { entry: 0.00, exit: 3.25, label: 'Commercial Reverse' },
  KIREVO_EXIT_SERBIA:  { entry: 6.00, exit: 4.19, label: 'Domestic Delivery' },
};

// Мультипликаторы Credit Support (NC Art.5.3.1) для предварительного расчёта блокировки
const CREDIT_MULT = {
  ANNUAL: 2/12, QUARTERLY: (1/4)*(2/3), MONTHLY: 1/12, DAILY: 1/365, WITHIN_DAY: 1/(365*24),
};

// ─────────────────────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────────────────────
function validate(req, res) {
  const e = validationResult(req);
  if (!e.isEmpty()) { res.status(400).json({ errors: e.array() }); return false; }
  return true;
}

function calcBidRevenue(flowDirection, capacityKwhH, deliveryDays) {
  const t = TARIFFS[flowDirection] || TARIFFS.GOSPODJINCI_HORGOS;
  const annualFee = capacityKwhH * (t.entry + t.exit);
  const periodFee = parseFloat((annualFee / 365 * deliveryDays).toFixed(2));
  return { annualFeeEur: parseFloat(annualFee.toFixed(2)), periodFeeEur: periodFee };
}

function calcCreditBlock(flowDirection, capacityKwhH, productType) {
  const t = TARIFFS[flowDirection] || TARIFFS.GOSPODJINCI_HORGOS;
  const annualFee = capacityKwhH * (t.entry + t.exit);
  const mult = CREDIT_MULT[productType] || CREDIT_MULT.ANNUAL;
  return parseFloat((annualFee * mult).toFixed(2));
}

// ─────────────────────────────────────────────────────────────
// GET /auctions/calendar — список аукционов
// ─────────────────────────────────────────────────────────────
router.get(
  '/calendar',
  authorize('capacity:read'),
  [
    qv('product_type').optional().isIn(PRODUCT_TYPES),
    qv('capacity_type').optional().isIn(CAPACITY_TYPES),
    qv('status').optional().isIn(AUCTION_STATUSES),
    qv('gas_year').optional().isInt({ min: 2025, max: 2030 }).toInt(),
    qv('upcoming_only').optional().isBoolean().toBoolean(),
    qv('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { product_type, capacity_type, status, gas_year,
            upcoming_only, limit = 50 } = req.query;
    try {
      let where = ['1=1'];
      const params = [];
      if (product_type)  { params.push(product_type);  where.push(`product_type = $${params.length}`); }
      if (capacity_type) { params.push(capacity_type); where.push(`capacity_type = $${params.length}`); }
      if (status)        { params.push(status);         where.push(`status = $${params.length}`); }
      if (gas_year)      { params.push(gas_year);       where.push(`gas_year = $${params.length}`); }
      if (upcoming_only) {
        where.push(`delivery_end > NOW()`);
        where.push(`status NOT IN ('CANCELLED')`);
      }
      params.push(limit);
      const { rows } = await db.query(`
        SELECT ao.*
        FROM v_auction_overview ao
        WHERE ${where.join(' AND ')}
        ORDER BY auction_start_date ASC, product_type ASC
        LIMIT $${params.length}
      `, params);
      res.json({ count: rows.length, auctions: rows });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /auctions/calendar/upcoming — ближайшие по каждому IP
// ─────────────────────────────────────────────────────────────
router.get('/calendar/upcoming', authorize('capacity:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM v_upcoming_auctions ORDER BY days_until_open ASC`);

    // Группировать по типу продукта для удобного отображения
    const byType = {};
    for (const r of rows) {
      if (!byType[r.product_type]) byType[r.product_type] = [];
      byType[r.product_type].push(r);
    }

    res.json({
      as_of: new Date().toISOString(),
      next_auction: rows[0] || null,
      by_product_type: byType,
      all: rows,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /auctions/calendar/next?product_type=&capacity_type=
// ─────────────────────────────────────────────────────────────
router.get(
  '/calendar/next',
  authorize('capacity:read'),
  [
    qv('product_type').optional().isIn(PRODUCT_TYPES),
    qv('capacity_type').optional().isIn(CAPACITY_TYPES),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { product_type = 'MONTHLY', capacity_type = 'FIRM' } = req.query;
    try {
      const { rows } = await db.query(`
        SELECT ao.*
        FROM v_auction_overview ao
        WHERE ao.product_type = $1
          AND ao.capacity_type = $2
          AND ao.delivery_end > NOW()
          AND ao.status NOT IN ('CANCELLED')
        ORDER BY ao.auction_start_date ASC
        LIMIT 1
      `, [product_type, capacity_type]);
      if (!rows.length) return res.status(404).json({ error: 'No upcoming auction found' });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /auctions/calendar/:id — детальная карточка аукциона
// ─────────────────────────────────────────────────────────────
router.get('/calendar/:id', authorize('capacity:read'), async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [aResult, bResult] = await Promise.all([
      db.query(`SELECT * FROM v_auction_overview WHERE id = $1`, [id]),
      db.query(`SELECT * FROM v_bid_lifecycle WHERE auction_id = $1 ORDER BY created_at DESC`, [id]),
    ]);
    if (!aResult.rows.length) return res.status(404).json({ error: 'Auction not found' });

    // Для этого аукциона: рассчитать доступную мощность по IP из v_capacity_available
    const { rows: capRows } = await db.query(`
      SELECT point_code, free_kwh_h, contracted_kwh_h, reserved_kwh_h
      FROM v_capacity_available
    `);

    res.json({
      auction:         aResult.rows[0],
      bids:            bResult.rows,
      capacity_available: capRows,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PATCH /auctions/calendar/:id/status
// ─────────────────────────────────────────────────────────────
router.patch(
  '/calendar/:id/status',
  authorize('capacity:write'),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(AUCTION_STATUSES),
    body('rbp_auction_id').optional().isString().isLength({ max: 100 }),
    body('reserve_price_eur_kwh_h').optional().isFloat({ min: 0 }),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { status, rbp_auction_id, reserve_price_eur_kwh_h, notes } = req.body;
    try {
      const { rows } = await db.query(`
        UPDATE auction_calendar
        SET status = $1,
            rbp_auction_id = COALESCE($2, rbp_auction_id),
            reserve_price_eur_kwh_h = COALESCE($3, reserve_price_eur_kwh_h),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [status, rbp_auction_id || null, reserve_price_eur_kwh_h || null,
          notes || null, req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Auction not found' });

      await addAudit({
        actionType: 'UPDATE', entityType: 'auction_calendar', entityId: parseInt(req.params.id),
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Auction #${req.params.id} status → ${status}`,
      });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /auctions/bids — список заявок
// ─────────────────────────────────────────────────────────────
router.get(
  '/bids',
  authorize('capacity:read'),
  [
    qv('status').optional().isIn(BID_STATUSES),
    qv('shipper_id').optional().isInt({ min: 1 }).toInt(),
    qv('product_type').optional().isIn(PRODUCT_TYPES),
    qv('point_code').optional().isString(),
    qv('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { status, shipper_id, product_type, point_code, limit = 50 } = req.query;
    try {
      let where = ['1=1'];
      const params = [];
      if (status)       { params.push(status);      where.push(`ab.status = $${params.length}`); }
      if (shipper_id)   { params.push(shipper_id);  where.push(`ab.shipper_id = $${params.length}`); }
      if (product_type) { params.push(product_type);where.push(`ac.product_type = $${params.length}`); }
      if (point_code)   { params.push(point_code);  where.push(`ab.point_code = $${params.length}`); }
      params.push(limit);
      const { rows } = await db.query(`
        SELECT bl.*
        FROM v_bid_lifecycle bl
        JOIN auction_bids ab ON ab.id = bl.bid_id
        JOIN auction_calendar ac ON ac.id = ab.auction_id
        WHERE ${where.join(' AND ')}
        ORDER BY bl.created_at DESC
        LIMIT $${params.length}
      `, params);
      res.json({ count: rows.length, bids: rows });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /auctions/bids — создать заявку (DRAFT)
// ─────────────────────────────────────────────────────────────
router.post(
  '/bids',
  authorize('capacity:write'),
  [
    body('auction_id').isInt({ min: 1 }),
    body('shipper_id').isInt({ min: 1 }),
    body('point_code').isString().notEmpty(),
    body('flow_direction').isIn(FLOW_DIRECTIONS),
    body('bid_capacity_kwh_h').isFloat({ min: 1 }),
    body('bid_price_eur_kwh_h_yr').optional().isFloat({ min: 0 }),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const {
      auction_id, shipper_id, point_code, flow_direction,
      bid_capacity_kwh_h, bid_price_eur_kwh_h_yr, notes,
    } = req.body;

    try {
      // 1. Проверить аукцион — должен быть UPCOMING или OPEN
      const { rows: aRows } = await db.query(
        `SELECT * FROM auction_calendar WHERE id = $1`, [auction_id]
      );
      if (!aRows.length) return res.status(404).json({ error: 'Auction not found' });
      const auction = aRows[0];
      if (!['UPCOMING','OPEN'].includes(auction.status)) {
        return res.status(422).json({
          error: `Auction is ${auction.status} — bids only accepted for UPCOMING/OPEN`,
          auction_status: auction.status,
        });
      }

      // 2. Проверить Credit Support (NC Art.5)
      const { rows: acRows } = await db.query(
        `SELECT * FROM v_available_credit WHERE shipper_id = $1`, [shipper_id]
      );
      const creditOk = acRows.length && (
        acRows[0].is_rating_exempt ||
        parseFloat(acRows[0].available_credit_eur) > 0
      );
      const creditBlock = calcCreditBlock(
        flow_direction, parseFloat(bid_capacity_kwh_h), auction.product_type
      );

      // 3. Предупреждение если мощность превышает доступную
      const deliveryDays = auction.delivery_end && auction.delivery_start
        ? Math.round((new Date(auction.delivery_end) - new Date(auction.delivery_start)) / 86400000)
        : 365;
      const revenue = calcBidRevenue(flow_direction, parseFloat(bid_capacity_kwh_h), deliveryDays);

      // 4. Создать заявку
      const { rows } = await db.query(`
        INSERT INTO auction_bids (
          auction_id, shipper_id, point_code, flow_direction,
          bid_capacity_kwh_h, bid_price_eur_kwh_h_yr,
          credit_checked, credit_sufficient, credit_blocked_eur,
          notes, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [
        auction_id, shipper_id, point_code, flow_direction,
        parseFloat(bid_capacity_kwh_h),
        bid_price_eur_kwh_h_yr ? parseFloat(bid_price_eur_kwh_h_yr) : null,
        true, creditOk, creditBlock,
        notes || null, req.user.id,
      ]);

      await addAudit({
        actionType: 'CREATE', entityType: 'auction_bid', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Bid DRAFT: shipper #${shipper_id}, auction #${auction_id}, `
          + `${bid_capacity_kwh_h} kWh/h ${flow_direction}`,
      });

      res.status(201).json({
        bid: rows[0],
        auction_info: {
          product_type: auction.product_type,
          capacity_type: auction.capacity_type,
          auction_round: auction.auction_round,
          auction_start_date: auction.auction_start_date,
          delivery_start: auction.delivery_start,
          delivery_end: auction.delivery_end,
        },
        financial_estimate: {
          delivery_days: deliveryDays,
          est_period_revenue_eur: revenue.periodFeeEur,
          est_annual_revenue_eur: revenue.annualFeeEur,
          tariff_ref: TARIFFS[flow_direction],
        },
        credit_assessment: {
          credit_checked: true,
          credit_sufficient: creditOk,
          credit_blocked_eur: creditBlock,
          nc_reference: `NC Art.5.3.1: ${auction.product_type} multiplier = ${
            (CREDIT_MULT[auction.product_type] * 100).toFixed(2)}%`,
          ...(acRows.length ? {
            available_credit_eur: acRows[0].available_credit_eur,
            coverage_status: acRows[0].coverage_status,
          } : { warning: 'No credit support data found' }),
        },
        next_step: creditOk
          ? 'POST /auctions/bids/' + rows[0].id + '/submit — when ready to submit to RBP.EU'
          : '⚠️ Credit insufficient — resolve before submitting (POST /credits/' + shipper_id + '/instruments)',
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /auctions/bids/:id — полный lifecycle одной заявки
// ─────────────────────────────────────────────────────────────
router.get('/bids/:id', authorize('capacity:read'), async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const { rows } = await db.query(
      `SELECT * FROM v_bid_lifecycle WHERE bid_id = $1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Bid not found' });

    // Прикрепить credit check
    const { rows: creditRows } = await db.query(
      `SELECT * FROM v_available_credit WHERE shipper_id = $1`,
      [rows[0].shipper_id]
    );

    res.json({
      ...rows[0],
      credit_position: creditRows[0] || null,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PATCH /auctions/bids/:id — обновить параметры (только DRAFT)
// ─────────────────────────────────────────────────────────────
router.patch(
  '/bids/:id',
  authorize('capacity:write'),
  [
    param('id').isInt({ min: 1 }),
    body('bid_capacity_kwh_h').optional().isFloat({ min: 1 }),
    body('bid_price_eur_kwh_h_yr').optional().isFloat({ min: 0 }),
    body('flow_direction').optional().isIn(FLOW_DIRECTIONS),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;

    try {
      // Только DRAFT можно редактировать
      const { rows: curr } = await db.query(
        `SELECT ab.*, ac.product_type FROM auction_bids ab
         JOIN auction_calendar ac ON ac.id = ab.auction_id WHERE ab.id = $1`, [req.params.id]
      );
      if (!curr.length) return res.status(404).json({ error: 'Bid not found' });
      if (curr[0].status !== 'DRAFT')
        return res.status(422).json({ error: `Cannot edit bid in status ${curr[0].status} — only DRAFT` });

      const allowed = ['bid_capacity_kwh_h','bid_price_eur_kwh_h_yr','flow_direction','notes'];
      const updates = {};
      for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

      // Пересчитать credit block при изменении мощности или направления
      if (updates.bid_capacity_kwh_h || updates.flow_direction) {
        const cap = parseFloat(updates.bid_capacity_kwh_h || curr[0].bid_capacity_kwh_h);
        const dir = updates.flow_direction || curr[0].flow_direction;
        updates.credit_blocked_eur = calcCreditBlock(dir, cap, curr[0].product_type);
      }

      if (!Object.keys(updates).length)
        return res.status(400).json({ error: 'No updatable fields' });

      const setClauses = Object.keys(updates).map((k, i) => `"${k}" = $${i + 1}`);
      const values = [...Object.values(updates), req.params.id];
      const { rows } = await db.query(`
        UPDATE auction_bids
        SET ${setClauses.join(', ')}, updated_by = ${req.user.id}
        WHERE id = $${values.length} RETURNING *
      `, values);

      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /auctions/bids/:id/submit — DRAFT → SUBMITTED
// ─────────────────────────────────────────────────────────────
router.post(
  '/bids/:id/submit',
  authorize('capacity:write'),
  [
    param('id').isInt({ min: 1 }),
    body('rbp_bid_ref').optional().isString().isLength({ max: 100 }),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const id = parseInt(req.params.id);
    try {
      const { rows: curr } = await db.query(
        `SELECT ab.*, ac.product_type, ac.status AS auction_status,
                ac.auction_start_date, ac.delivery_start, ac.delivery_end
         FROM auction_bids ab
         JOIN auction_calendar ac ON ac.id = ab.auction_id
         WHERE ab.id = $1`, [id]
      );
      if (!curr.length) return res.status(404).json({ error: 'Bid not found' });
      const bid = curr[0];

      if (bid.status !== 'DRAFT')
        return res.status(422).json({ error: `Bid is ${bid.status} — can only submit DRAFT` });
      if (!['UPCOMING','OPEN'].includes(bid.auction_status))
        return res.status(422).json({ error: `Auction is ${bid.auction_status} — submission window closed` });

      // Финальная проверка Credit Support перед отправкой
      const { rows: acRows } = await db.query(
        `SELECT * FROM v_available_credit WHERE shipper_id = $1`, [bid.shipper_id]
      );
      const creditOk = acRows.length && (
        acRows[0].is_rating_exempt ||
        parseFloat(acRows[0].available_credit_eur) >= parseFloat(bid.credit_blocked_eur || 0)
      );

      if (!creditOk) {
        return res.status(422).json({
          error: 'Cannot submit: insufficient credit support (NC Art.5)',
          credit_summary: acRows[0] || null,
          required_eur: bid.credit_blocked_eur,
          nc_reference: 'NC Art.5.3.1 — minimum credit support must be in place before bid submission',
        });
      }

      const { rows } = await db.query(`
        UPDATE auction_bids
        SET status = 'SUBMITTED',
            submitted_at = NOW(),
            rbp_bid_ref = COALESCE($1, rbp_bid_ref),
            notes = COALESCE($2, notes),
            updated_by = $3
        WHERE id = $4 RETURNING *
      `, [req.body.rbp_bid_ref || null, req.body.notes || null, req.user.id, id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'auction_bid', entityId: id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Bid #${id} SUBMITTED to RBP.EU | ref: ${req.body.rbp_bid_ref || '—'}`,
      });

      res.json({
        bid: rows[0],
        message: 'Bid submitted. Await auction results.',
        next_step: `POST /auctions/bids/${id}/result — когда получены результаты аукциона`,
        auction_start: bid.auction_start_date,
        delivery: `${bid.delivery_start} → ${bid.delivery_end}`,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /auctions/bids/:id/result — записать результат аукциона
// ─────────────────────────────────────────────────────────────
router.post(
  '/bids/:id/result',
  authorize('capacity:write'),
  [
    param('id').isInt({ min: 1 }),
    body('outcome').isIn(['WON','PARTIALLY_WON','LOST']),
    body('allocated_capacity_kwh_h').optional().isFloat({ min: 0 }),
    body('clearing_price_eur_kwh_h_yr').optional().isFloat({ min: 0 }),
    body('auction_premium_eur').optional().isFloat({ min: 0 }),
    body('result_notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const id = parseInt(req.params.id);
    const {
      outcome, allocated_capacity_kwh_h, clearing_price_eur_kwh_h_yr,
      auction_premium_eur, result_notes,
    } = req.body;

    try {
      const { rows: curr } = await db.query(
        `SELECT ab.*, ac.product_type, ac.delivery_start, ac.delivery_end,
                ac.auction_round, ac.capacity_type
         FROM auction_bids ab
         JOIN auction_calendar ac ON ac.id = ab.auction_id
         WHERE ab.id = $1`, [id]
      );
      if (!curr.length) return res.status(404).json({ error: 'Bid not found' });
      const bid = curr[0];

      if (!['SUBMITTED','UNDER_REVIEW'].includes(bid.status))
        return res.status(422).json({ error: `Bid is ${bid.status} — result only for SUBMITTED/UNDER_REVIEW` });

      // Для PARTIALLY_WON должен быть allocated_capacity_kwh_h
      if (outcome === 'PARTIALLY_WON' && !allocated_capacity_kwh_h)
        return res.status(400).json({ error: 'allocated_capacity_kwh_h required for PARTIALLY_WON' });

      const allocCap = outcome === 'WON'
        ? parseFloat(bid.bid_capacity_kwh_h)
        : outcome === 'PARTIALLY_WON'
          ? parseFloat(allocated_capacity_kwh_h)
          : 0;

      const { rows } = await db.query(`
        UPDATE auction_bids
        SET status = $1,
            result_received_at = NOW(),
            allocated_capacity_kwh_h = $2,
            clearing_price_eur_kwh_h_yr = $3,
            auction_premium_eur = $4,
            result_notes = $5,
            updated_by = $6
        WHERE id = $7 RETURNING *
      `, [
        outcome, allocCap || null,
        clearing_price_eur_kwh_h_yr ? parseFloat(clearing_price_eur_kwh_h_yr) : null,
        auction_premium_eur ? parseFloat(auction_premium_eur) : null,
        result_notes || null,
        req.user.id, id,
      ]);

      // Обновить статус аукциона → RESULTS_PUBLISHED (если ещё не)
      await db.query(`
        UPDATE auction_calendar SET status = 'RESULTS_PUBLISHED', updated_at = NOW()
        WHERE id = $1 AND status NOT IN ('RESULTS_PUBLISHED','CANCELLED')
      `, [bid.auction_id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'auction_bid', entityId: id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Bid #${id} result: ${outcome} | allocated ${allocCap} kWh/h | clearing ${clearing_price_eur_kwh_h_yr || 'N/A'}`,
      });

      const response = {
        bid:    rows[0],
        outcome,
        message: outcome === 'LOST'
          ? 'Bid not allocated. No further action needed.'
          : `Capacity allocated: ${allocCap} kWh/h. Ready to create contract.`,
      };

      if (['WON','PARTIALLY_WON'].includes(outcome)) {
        const deliveryDays = Math.round(
          (new Date(bid.delivery_end) - new Date(bid.delivery_start)) / 86400000
        );
        const rev = calcBidRevenue(bid.flow_direction, allocCap, deliveryDays);
        response.financial_outcome = {
          allocated_capacity_kwh_h: allocCap,
          clearing_price_eur_kwh_h_yr: clearing_price_eur_kwh_h_yr || null,
          auction_premium_eur: auction_premium_eur || null,
          est_period_revenue_eur: rev.periodFeeEur,
          est_annual_revenue_eur: rev.annualFeeEur,
          delivery_days: deliveryDays,
        };
        response.next_step = `POST /auctions/bids/${id}/create-contract`;
      }

      res.json(response);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /auctions/bids/:id/create-contract — создать контракт из победы
// ─────────────────────────────────────────────────────────────
router.post(
  '/bids/:id/create-contract',
  authorize('contracts:write'),
  [param('id').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const id = parseInt(req.params.id);
    try {
      // Вызвать DB функцию fn_create_contract_from_bid()
      const { rows } = await db.query(
        `SELECT fn_create_contract_from_bid($1, $2) AS contract_id`,
        [id, req.user.id]
      );
      const contractId = rows[0].contract_id;

      // Получить созданный контракт
      const { rows: cRows } = await db.query(
        `SELECT * FROM contracts WHERE id = $1`, [contractId]
      );

      await addAudit({
        actionType: 'CREATE', entityType: 'contract', entityId: contractId,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Contract ${cRows[0].contract_number} auto-created from auction bid #${id}`,
      });

      res.status(201).json({
        message:         'Contract created successfully from auction bid',
        contract:        cRows[0],
        bid_id:          id,
        contract_id:     contractId,
        contract_number: cRows[0].contract_number,
        next_steps: [
          `GET /contracts/${contractId} — view full contract`,
          `POST /billing — create first invoice`,
          `View in capacity tracker: capacity now contracted`,
        ],
      });
    } catch (err) {
      // Ошибка из fn_create_contract_from_bid — парсим сообщение
      if (err.message?.includes('not found or not eligible')) {
        return res.status(422).json({
          error: err.message,
          hint: 'Bid must be in WON or PARTIALLY_WON status and not have a contract yet',
        });
      }
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// DELETE /auctions/bids/:id — отозвать заявку (только DRAFT)
// ─────────────────────────────────────────────────────────────
router.delete(
  '/bids/:id',
  authorize('capacity:write'),
  [param('id').isInt({ min: 1 })],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const id = parseInt(req.params.id);
    try {
      const { rows: curr } = await db.query(
        `SELECT * FROM auction_bids WHERE id = $1`, [id]
      );
      if (!curr.length) return res.status(404).json({ error: 'Bid not found' });
      if (!['DRAFT','SUBMITTED'].includes(curr[0].status))
        return res.status(422).json({
          error: `Cannot cancel bid in status ${curr[0].status}`,
          hint: 'Only DRAFT or SUBMITTED bids can be cancelled before results',
        });

      const { rows } = await db.query(`
        UPDATE auction_bids
        SET status = 'CANCELLED', updated_by = $1
        WHERE id = $2 RETURNING *
      `, [req.user.id, id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'auction_bid', entityId: id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Bid #${id} CANCELLED`,
      });
      res.json({ cancelled: true, bid: rows[0] });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /auctions/summary — дашборд
// ─────────────────────────────────────────────────────────────
router.get('/summary', authorize('capacity:read'), async (req, res, next) => {
  try {
    const [calResult, bidResult, wonResult] = await Promise.all([
      // Статистика по аукционам
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'UPCOMING')           AS upcoming_count,
          COUNT(*) FILTER (WHERE status = 'OPEN')               AS open_count,
          COUNT(*) FILTER (WHERE status = 'RESULTS_PUBLISHED')  AS results_published,
          MIN(auction_start_date) FILTER (WHERE status IN ('UPCOMING','OPEN')
            AND delivery_end > NOW())                           AS next_auction_date
        FROM auction_calendar
      `),
      // Статистика по заявкам
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'DRAFT')              AS draft_count,
          COUNT(*) FILTER (WHERE status = 'SUBMITTED')          AS submitted_count,
          COUNT(*) FILTER (WHERE status IN ('WON','PARTIALLY_WON')) AS won_count,
          COUNT(*) FILTER (WHERE status = 'LOST')               AS lost_count,
          COUNT(*) FILTER (WHERE status = 'CONTRACT_CREATED')   AS contract_created_count,
          COUNT(*) FILTER (WHERE status IN ('WON','PARTIALLY_WON')
            AND contract_id IS NULL)                            AS won_pending_contract
        FROM auction_bids
      `),
      // Топ выигранных заявок
      db.query(`
        SELECT *
        FROM v_bid_lifecycle
        WHERE status IN ('WON','PARTIALLY_WON','CONTRACT_CREATED')
        ORDER BY created_at DESC
        LIMIT 5
      `),
    ]);

    res.json({
      as_of: new Date().toISOString(),
      auction_calendar: calResult.rows[0],
      bids: bidResult.rows[0],
      recent_wins: wonResult.rows,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /auctions/timeline?days=90 — timeline предстоящих событий
// ─────────────────────────────────────────────────────────────
router.get(
  '/timeline',
  authorize('capacity:read'),
  [qv('days').optional().isInt({ min: 7, max: 365 }).toInt()],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const days = req.query.days || 90;
    try {
      const { rows } = await db.query(`
        SELECT
          auction_start_date                            AS event_date,
          'AUCTION_OPEN'                                AS event_type,
          product_type || ' ' || capacity_type || ': ' || COALESCE(auction_round, 'Auction') AS title,
          product_type,
          capacity_type,
          auction_round,
          id                                            AS auction_id,
          NULL::INTEGER                                 AS bid_id,
          (auction_start_date - CURRENT_DATE)::INTEGER  AS days_away
        FROM auction_calendar
        WHERE auction_start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::INTEGER
          AND status NOT IN ('CANCELLED')

        UNION ALL

        SELECT
          delivery_start::DATE                          AS event_date,
          'DELIVERY_START'                              AS event_type,
          product_type || ' delivery starts: ' || COALESCE(auction_round,'') AS title,
          product_type, capacity_type, auction_round,
          id AS auction_id, NULL::INTEGER AS bid_id,
          (delivery_start::DATE - CURRENT_DATE)::INTEGER AS days_away
        FROM auction_calendar
        WHERE delivery_start::DATE BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::INTEGER
          AND status NOT IN ('CANCELLED')
          AND product_type IN ('ANNUAL','QUARTERLY','MONTHLY')

        ORDER BY event_date ASC, event_type ASC
      `, [days]);

      // Сгруппировать по неделям
      const byWeek = {};
      for (const r of rows) {
        const weekNum = Math.floor(r.days_away / 7);
        const key = `W+${weekNum}`;
        if (!byWeek[key]) byWeek[key] = [];
        byWeek[key].push(r);
      }

      res.json({
        horizon_days: days,
        total_events:  rows.length,
        timeline:      rows,
        by_week:       byWeek,
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
