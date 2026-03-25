'use strict';

/**
 * Credits API — NC Art. 5 (Credit Support)
 * =====================================================================
 * Gastrans Network Code:
 *   Art. 5.2  — формы: банковская гарантия (URDG 758, ≥BBB-) или эскроу
 *   Art. 5.3  — размер: 2/12 Annual, 2/3 Quarterly, 100% Monthly/Daily
 *   Art. 5.4  — рейтинговое освобождение: BBB-/Baa3/Creditreform≤235
 *   Art. 5.5  — Margin Call: 2 рабочих дня на доплнение
 *   Art. 20.3 — блокировка при незакрытых обязательствах
 *
 * Endpoints:
 *   GET  /credits                         — dashboard: все шипперы
 *   GET  /credits/summary                 — агрегированная статистика
 *   GET  /credits/expiring?days=30        — инструменты с истекающим сроком
 *   GET  /credits/margin-calls            — список Margin Calls
 *   PATCH /credits/margin-calls/:id       — обновить статус MC
 *   GET  /credits/:shipperId              — детальная позиция шиппера
 *   GET  /credits/:shipperId/instruments  — все инструменты КП шиппера
 *   GET  /credits/:shipperId/by-product   — минимум по типу продукта (NC 5.3.1)
 *   GET  /credits/:shipperId/rating       — история рейтинга
 *   POST /credits/:shipperId/instruments  — добавить инструмент КП
 *   PATCH /credits/:shipperId/instruments/:id — обновить инструмент
 *   POST /credits/:shipperId/instruments/:id/call — вызвать гарантию
 *   POST /credits/:shipperId/rating       — обновить рейтинг
 *   POST /credits/:shipperId/margin-call  — выдать Margin Call
 *   GET  /credits/:shipperId/eligibility  — проверить право на аукцион
 * =====================================================================
 */

const express   = require('express');
const { body, query: qv, param, validationResult } = require('express-validator');
const db        = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const { addAudit }  = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────
// Константы NC Art. 5
// ─────────────────────────────────────────────────────────────
const CREDIT_MULTIPLIERS = {
  ANNUAL:     2 / 12,        // 2/12 годовой суммы (≈16.67%)
  QUARTERLY:  (1 / 4) * (2 / 3), // 2/3 квартальной (≈22.22% годовой)
  MONTHLY:    1 / 12,        // 100% месяца (≈8.33%)
  DAILY:      1 / 365,       // 100% суток (≈0.27%)
  WITHIN_DAY: 1 / (365 * 24), // почасовой
};

const SUPPORT_TYPES  = ['BANK_GUARANTEE', 'ESCROW', 'PARENT_GUARANTEE'];
const MC_STATUSES    = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED'];
const CREDIT_STATUSES = ['NORMAL', 'WARNING', 'BLOCKED', 'MARGIN_CALL'];

// Рейтинги инвестиционного класса (NC Art. 5.4)
const SP_INVEST_GRADES    = ['BBB-','BBB','BBB+','A-','A','A+','AA-','AA','AA+','AAA'];
const MOODYS_INVEST_GRADES = ['Baa3','Baa2','Baa1','A3','A2','A1','Aa3','Aa2','Aa1','Aaa'];

// ─────────────────────────────────────────────────────────────
// Хелпер: проверка рейтингового освобождения
// ─────────────────────────────────────────────────────────────
function isRatingExempt({ spRating, moodysRating, creditreformScore }) {
  if (spRating    && SP_INVEST_GRADES.includes(spRating))    return true;
  if (moodysRating && MOODYS_INVEST_GRADES.includes(moodysRating)) return true;
  if (creditreformScore != null && creditreformScore <= 235) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// Хелпер: рассчитать минимальный размер гарантии
// ─────────────────────────────────────────────────────────────
function calcMinCreditRequired(contracts) {
  let total = 0;
  const byProduct = {};

  for (const c of contracts) {
    const annualFee =
      (parseFloat(c.cap_entry_kwh_h) || 0) * (parseFloat(c.tariff_entry_eur_kwh_h_yr) || 6.00) +
      (parseFloat(c.cap_exit_kwh_h)  || 0) * (parseFloat(c.tariff_exit_eur_kwh_h_yr)  || 6.85);

    const multiplier = CREDIT_MULTIPLIERS[c.product_type] || CREDIT_MULTIPLIERS.ANNUAL;
    const required   = parseFloat((annualFee * multiplier).toFixed(2));

    total += required;
    byProduct[c.product_type] = (byProduct[c.product_type] || 0) + required;
  }

  return {
    total:     parseFloat(total.toFixed(2)),
    byProduct: Object.fromEntries(
      Object.entries(byProduct).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
    ),
  };
}

// ─────────────────────────────────────────────────────────────
// Хелпер: валидация
// ─────────────────────────────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// GET /credits — dashboard всех шипперов
// ─────────────────────────────────────────────────────────────
router.get('/', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        ac.*,
        COUNT(mc.id) FILTER (WHERE mc.status = 'OPEN') AS open_margin_calls_count
      FROM v_available_credit ac
      LEFT JOIN margin_calls mc ON mc.shipper_id = ac.shipper_id
      GROUP BY
        ac.shipper_id, ac.shipper_code, ac.shipper_name,
        ac.rating_exempt, ac.sp_rating, ac.moodys_rating, ac.creditreform_score,
        ac.is_rating_exempt, ac.total_credit_eur, ac.active_instruments,
        ac.expiring_soon_count, ac.nearest_expiry, ac.open_invoices_eur,
        ac.overdue_eur, ac.min_required_eur, ac.available_credit_eur,
        ac.utilization_pct, ac.coverage_status, ac.shortfall_eur,
        ac.has_overdue, ac.has_expiring_soon, ac.risk_level
      ORDER BY ac.risk_level DESC, ac.utilization_pct DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/summary — агрегат по платформе
// ─────────────────────────────────────────────────────────────
router.get('/summary', authorize('credits:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)                                          AS total_shippers,
        SUM(total_credit_eur)                             AS total_credit_pool_eur,
        SUM(open_invoices_eur)                            AS total_exposure_eur,
        SUM(overdue_eur)                                  AS total_overdue_eur,
        SUM(min_required_eur)                             AS total_min_required_eur,
        SUM(available_credit_eur)                         AS total_available_eur,
        COUNT(*) FILTER (WHERE coverage_status = 'MISSING')       AS missing_count,
        COUNT(*) FILTER (WHERE coverage_status = 'INSUFFICIENT')  AS insufficient_count,
        COUNT(*) FILTER (WHERE coverage_status = 'SUFFICIENT')    AS sufficient_count,
        COUNT(*) FILTER (WHERE coverage_status = 'EXEMPT')        AS exempt_count,
        COUNT(*) FILTER (WHERE risk_level = 'CRITICAL')           AS critical_count,
        COUNT(*) FILTER (WHERE risk_level = 'WARNING')            AS warning_count,
        COUNT(*) FILTER (WHERE has_expiring_soon)                 AS expiring_soon_count
      FROM v_available_credit
    `);

    const { rows: mcRows } = await db.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'OPEN') AS open_margin_calls
      FROM margin_calls
    `);

    res.json({
      ...rows[0],
      open_margin_calls: parseInt(mcRows[0].open_margin_calls) || 0,
      as_of: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/expiring?days=30 — истекающие инструменты
// ─────────────────────────────────────────────────────────────
router.get(
  '/expiring',
  authorize('credits:read'),
  [qv('days').optional().isInt({ min: 1, max: 365 }).toInt()],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const days = req.query.days || 30;
    try {
      const { rows } = await db.query(`
        SELECT *
        FROM v_credit_support_detail
        WHERE status = 'ACTIVE'
          AND valid_to IS NOT NULL
          AND valid_to BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::INTEGER
        ORDER BY valid_to ASC
      `, [days]);
      res.json({ days_window: days, count: rows.length, instruments: rows });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /credits/margin-calls — список Margin Calls
// ─────────────────────────────────────────────────────────────
router.get('/margin-calls', authorize('credits:read'), async (req, res, next) => {
  const { status, shipper_id, limit = 100 } = req.query;
  try {
    let whereClause = '1=1';
    const params = [];
    if (status) {
      params.push(status);
      whereClause += ` AND mc.status = $${params.length}`;
    }
    if (shipper_id) {
      params.push(shipper_id);
      whereClause += ` AND mc.shipper_id = $${params.length}`;
    }
    params.push(Math.min(parseInt(limit) || 100, 500));
    const { rows } = await db.query(`
      SELECT
        mc.*,
        s.code  AS shipper_code,
        s.name  AS shipper_name,
        u.username AS issued_by_username
      FROM margin_calls mc
      JOIN shippers s ON s.id = mc.shipper_id
      LEFT JOIN users u ON u.id = mc.issued_by
      WHERE ${whereClause}
      ORDER BY mc.issued_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// PATCH /credits/margin-calls/:id — обновить статус MC
// ─────────────────────────────────────────────────────────────
router.patch(
  '/margin-calls/:id',
  authorize('credits:margin_call'),
  [
    param('id').isInt({ min: 1 }),
    body('status').isIn(MC_STATUSES).withMessage(`status must be one of: ${MC_STATUSES.join(', ')}`),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { status, notes } = req.body;
    try {
      const { rows } = await db.query(`
        UPDATE margin_calls
        SET status     = $1,
            notes      = COALESCE($2, notes),
            resolved_at = CASE WHEN $1 = 'RESOLVED' THEN NOW() ELSE resolved_at END
        WHERE id = $3
        RETURNING *
      `, [status, notes || null, req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Margin call not found' });

      await addAudit({
        actionType: 'UPDATE', entityType: 'margin_call', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Margin Call #${rows[0].id} → ${status}`,
      });
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// GET /credits/:shipperId — детальная позиция шиппера
// ─────────────────────────────────────────────────────────────
router.get('/:shipperId', authorize('credits:read'), async (req, res, next) => {
  const id = parseInt(req.params.shipperId);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: 'Invalid shipperId' });
  try {
    const [acResult, contractsResult, mcResult] = await Promise.all([
      db.query(`SELECT * FROM v_available_credit WHERE shipper_id = $1`, [id]),
      db.query(`
        SELECT * FROM v_credit_by_product WHERE shipper_id = $1
        ORDER BY product_type, contract_id
      `, [id]),
      db.query(`
        SELECT * FROM margin_calls WHERE shipper_id = $1 ORDER BY issued_at DESC LIMIT 5
      `, [id]),
    ]);
    if (!acResult.rows.length) return res.status(404).json({ error: 'Shipper not found' });

    res.json({
      ...acResult.rows[0],
      contracts_by_product: contractsResult.rows,
      recent_margin_calls:  mcResult.rows,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/:shipperId/instruments — инструменты КП
// ─────────────────────────────────────────────────────────────
router.get('/:shipperId/instruments', authorize('credits:read'), async (req, res, next) => {
  const id = parseInt(req.params.shipperId);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: 'Invalid shipperId' });
  try {
    const { rows } = await db.query(`
      SELECT * FROM v_credit_support_detail
      WHERE shipper_id = $1
      ORDER BY status ASC, valid_from DESC
    `, [id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/:shipperId/by-product — минимум по продукту NC 5.3.1
// ─────────────────────────────────────────────────────────────
router.get('/:shipperId/by-product', authorize('credits:read'), async (req, res, next) => {
  const id = parseInt(req.params.shipperId);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: 'Invalid shipperId' });
  try {
    const { rows: contracts } = await db.query(`
      SELECT *
      FROM contracts
      WHERE shipper_id = $1 AND status IN ('ACTIVE','PENDING')
      ORDER BY product_type, id
    `, [id]);

    const result = calcMinCreditRequired(contracts);
    const breakdown = contracts.map(c => {
      const annualFee =
        (parseFloat(c.cap_entry_kwh_h) || 0) * (parseFloat(c.tariff_entry_eur_kwh_h_yr) || 6.00) +
        (parseFloat(c.cap_exit_kwh_h)  || 0) * (parseFloat(c.tariff_exit_eur_kwh_h_yr)  || 6.85);
      const multiplier = CREDIT_MULTIPLIERS[c.product_type] || CREDIT_MULTIPLIERS.ANNUAL;
      return {
        contract_id:         c.id,
        contract_number:     c.contract_number,
        product_type:        c.product_type,
        flow_direction:      c.flow_direction,
        cap_entry_kwh_h:     parseFloat(c.cap_entry_kwh_h) || 0,
        cap_exit_kwh_h:      parseFloat(c.cap_exit_kwh_h)  || 0,
        annual_capacity_fee: parseFloat(annualFee.toFixed(2)),
        multiplier:          multiplier,
        multiplier_label:    {
          ANNUAL:    '2/12 годовой (16.7%)',
          QUARTERLY: '2/3 квартала (22.2%)',
          MONTHLY:   '100% месяца (8.3%)',
          DAILY:     '100% суток (0.27%)',
          WITHIN_DAY:'Почасовой',
        }[c.product_type] || '2/12 (по умолч.)',
        min_required_eur:    parseFloat((annualFee * multiplier).toFixed(2)),
      };
    });

    res.json({
      shipper_id:       id,
      total_min_required_eur: result.total,
      by_product_type:  result.byProduct,
      contracts:        breakdown,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/:shipperId/rating — история рейтингов
// ─────────────────────────────────────────────────────────────
router.get('/:shipperId/rating', authorize('credits:read'), async (req, res, next) => {
  const id = parseInt(req.params.shipperId);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: 'Invalid shipperId' });
  try {
    const { rows } = await db.query(`
      SELECT crh.*, u.username AS recorded_by_username
      FROM credit_rating_history crh
      LEFT JOIN users u ON u.id = crh.recorded_by
      WHERE crh.shipper_id = $1
      ORDER BY crh.record_date DESC
      LIMIT 50
    `, [id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// GET /credits/:shipperId/eligibility — право на аукцион RBP
// Проверяет наличие достаточной КП перед подачей заявки на аукцион
// ─────────────────────────────────────────────────────────────
router.get('/:shipperId/eligibility', authorize('credits:read'), async (req, res, next) => {
  const id = parseInt(req.params.shipperId);
  if (!Number.isInteger(id) || id < 1)
    return res.status(400).json({ error: 'Invalid shipperId' });

  const { product_type, cap_kwh_h, flow_direction } = req.query;

  try {
    const { rows: acRows } = await db.query(`
      SELECT * FROM v_available_credit WHERE shipper_id = $1
    `, [id]);
    if (!acRows.length) return res.status(404).json({ error: 'Shipper not found' });

    const ac = acRows[0];
    let additionalRequired = 0;
    let productCheck = null;

    // Если переданы параметры предполагаемой заявки — рассчитать дополнительный требуемый лимит
    if (product_type && cap_kwh_h) {
      // Тарифы по умолчанию для расчёта
      const tariffEntry = 6.00;
      const tariffExit  = 6.85;
      const capKwh = parseFloat(cap_kwh_h) || 0;
      const annualFee = capKwh * (tariffEntry + tariffExit); // упрощённо для проверки
      const multiplier = CREDIT_MULTIPLIERS[product_type?.toUpperCase()] || CREDIT_MULTIPLIERS.ANNUAL;
      additionalRequired = parseFloat((annualFee * multiplier).toFixed(2));

      productCheck = {
        product_type:      product_type?.toUpperCase(),
        cap_kwh_h:         capKwh,
        estimated_annual_fee_eur: parseFloat(annualFee.toFixed(2)),
        multiplier,
        additional_required_eur: additionalRequired,
        available_after_eur: parseFloat(
          (parseFloat(ac.available_credit_eur) - additionalRequired).toFixed(2)
        ),
        eligible_for_bid: parseFloat(ac.available_credit_eur) >= additionalRequired,
      };
    }

    // Итоговое решение
    const isExempt    = ac.is_rating_exempt;
    const hasSufficient = parseFloat(ac.available_credit_eur) > 0
      || parseFloat(ac.total_credit_eur) >= parseFloat(ac.min_required_eur || 0);
    const hasOpenMargCall = ac.open_margin_calls_count > 0;

    const eligible = (isExempt || hasSufficient) && !hasOpenMargCall;

    res.json({
      shipper_id:             id,
      shipper_code:           ac.shipper_code,
      shipper_name:           ac.shipper_name,
      eligible_for_auction:   eligible,
      blocking_reasons:       [
        !isExempt && !hasSufficient ? 'Insufficient credit support' : null,
        hasOpenMargCall             ? 'Open Margin Call outstanding' : null,
        ac.coverage_status === 'MISSING' ? 'No credit support instruments on file' : null,
      ].filter(Boolean),
      credit_summary: {
        total_credit_eur:     parseFloat(ac.total_credit_eur),
        available_credit_eur: parseFloat(ac.available_credit_eur),
        open_invoices_eur:    parseFloat(ac.open_invoices_eur),
        min_required_eur:     parseFloat(ac.min_required_eur || 0),
        coverage_status:      ac.coverage_status,
        risk_level:           ac.risk_level,
        is_rating_exempt:     isExempt,
      },
      ...(productCheck ? { bid_assessment: productCheck } : {}),
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────
// POST /credits/:shipperId/instruments — добавить инструмент КП
// ─────────────────────────────────────────────────────────────
router.post(
  '/:shipperId/instruments',
  authorize('credits:write'),
  [
    param('shipperId').isInt({ min: 1 }),
    body('support_type').isIn(SUPPORT_TYPES)
      .withMessage(`support_type must be one of: ${SUPPORT_TYPES.join(', ')}`),
    body('amount_eur').isFloat({ min: 0.01 }),
    body('valid_from').isISO8601().toDate(),
    body('valid_to').optional().isISO8601().toDate(),
    body('guarantee_number').optional().isString().isLength({ max: 100 }),
    body('bank_name').optional().isString().isLength({ max: 200 }),
    body('bank_swift').optional().isString().isLength({ min: 8, max: 11 }),
    body('bank_country').optional().isAlpha().isLength({ min: 2, max: 2 }),
    body('urdg_758_compliant').optional().isBoolean(),
    body('escrow_account').optional().isString().isLength({ max: 100 }),
    body('escrow_bank').optional().isString().isLength({ max: 200 }),
    body('sp_rating').optional().isString().isLength({ max: 10 }),
    body('moodys_rating').optional().isString().isLength({ max: 10 }),
    body('creditreform_score').optional().isInt({ min: 100, max: 999 }),
    body('rating_valid_until').optional().isISO8601().toDate(),
    body('rating_source').optional().isString().isLength({ max: 100 }),
    body('covers_annual').optional().isBoolean(),
    body('covers_quarterly').optional().isBoolean(),
    body('covers_monthly').optional().isBoolean(),
    body('covers_daily').optional().isBoolean(),
    body('auto_extend_days').optional().isInt({ min: 0, max: 365 }),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const shipperId = parseInt(req.params.shipperId);

    // Проверить шиппера
    const { rows: sRows } = await db.query(
      'SELECT id FROM shippers WHERE id = $1 AND is_active = true', [shipperId]
    );
    if (!sRows.length) return res.status(404).json({ error: 'Shipper not found' });

    const {
      support_type, amount_eur, valid_from, valid_to,
      guarantee_number, bank_name, bank_swift, bank_country,
      urdg_758_compliant = true, escrow_account, escrow_bank, escrow_swift,
      sp_rating, moodys_rating, creditreform_score,
      rating_valid_until, rating_source,
      covers_annual = true, covers_quarterly = true,
      covers_monthly = true, covers_daily = true, covers_within_day = true,
      auto_extend_days = 0, notes,
    } = req.body;

    // Рейтинговое освобождение для нового инструмента
    const ratingExempt = isRatingExempt({ spRating: sp_rating, moodysRating: moodys_rating,
                                          creditreformScore: creditreform_score });

    try {
      const { rows } = await db.query(`
        INSERT INTO credit_support (
          shipper_id, support_type,
          guarantee_number, bank_name, bank_swift, bank_country, urdg_758_compliant,
          escrow_account, escrow_bank, escrow_swift,
          amount_eur, valid_from, valid_to,
          rating_exempt, sp_rating, moodys_rating, creditreform_score,
          rating_valid_until, rating_source,
          covers_annual, covers_quarterly, covers_monthly, covers_daily, covers_within_day,
          auto_extend_days, notes,
          created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        RETURNING *
      `, [
        shipperId, support_type,
        guarantee_number || null, bank_name || null, bank_swift || null,
        bank_country || null, urdg_758_compliant,
        escrow_account || null, escrow_bank || null, escrow_swift || null,
        parseFloat(amount_eur), valid_from,
        valid_to || null,
        ratingExempt, sp_rating || null, moodys_rating || null,
        creditreform_score != null ? parseInt(creditreform_score) : null,
        rating_valid_until || null, rating_source || null,
        covers_annual, covers_quarterly, covers_monthly, covers_daily, covers_within_day,
        parseInt(auto_extend_days), notes || null,
        req.user.id,
      ]);

      // Записать событие
      await db.query(`
        INSERT INTO credit_support_events
          (credit_support_id, shipper_id, event_type, event_date, amount_after_eur, valid_to_after, notes, performed_by)
        VALUES ($1, $2, 'ISSUED', CURRENT_DATE, $3, $4, $5, $6)
      `, [rows[0].id, shipperId, parseFloat(amount_eur), valid_to || null,
          `New ${support_type} issued`, req.user.id]);

      await addAudit({
        actionType: 'CREATE', entityType: 'credit_support', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `New ${support_type} for shipper #${shipperId}: ${amount_eur} EUR`,
      });

      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// PATCH /credits/:shipperId/instruments/:id — обновить инструмент
// ─────────────────────────────────────────────────────────────
router.patch(
  '/:shipperId/instruments/:id',
  authorize('credits:write'),
  [
    param('shipperId').isInt({ min: 1 }),
    param('id').isInt({ min: 1 }),
    body('amount_eur').optional().isFloat({ min: 0.01 }),
    body('valid_to').optional().isISO8601().toDate(),
    body('auto_extend_days').optional().isInt({ min: 0, max: 365 }),
    body('status').optional().isIn(['ACTIVE','EXPIRED','CANCELLED','PENDING','CALLED']),
    body('notes').optional().isString().isLength({ max: 1000 }),
    body('sp_rating').optional().isString().isLength({ max: 10 }),
    body('moodys_rating').optional().isString().isLength({ max: 10 }),
    body('creditreform_score').optional().isInt({ min: 100, max: 999 }),
    body('rating_valid_until').optional().isISO8601().toDate(),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { shipperId, id } = req.params;

    const allowed = ['amount_eur','valid_to','auto_extend_days','status','notes',
                     'bank_name','bank_swift','sp_rating','moodys_rating',
                     'creditreform_score','rating_valid_until','rating_source',
                     'covers_annual','covers_quarterly','covers_monthly','covers_daily'];

    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    // Пересчитать рейтинговое освобождение при изменении рейтинга
    if (updates.sp_rating !== undefined || updates.moodys_rating !== undefined
        || updates.creditreform_score !== undefined) {
      const { rows: curr } = await db.query(
        'SELECT sp_rating, moodys_rating, creditreform_score FROM credit_support WHERE id=$1', [id]
      );
      if (curr.length) {
        updates.rating_exempt = isRatingExempt({
          spRating:          updates.sp_rating          || curr[0].sp_rating,
          moodysRating:      updates.moodys_rating      || curr[0].moodys_rating,
          creditreformScore: updates.creditreform_score ?? curr[0].creditreform_score,
        });
      }
    }

    if (!Object.keys(updates).length)
      return res.status(400).json({ error: 'No updatable fields provided' });

    try {
      const setClauses = Object.keys(updates).map((k, i) => `"${k}" = $${i + 1}`);
      const values     = [...Object.values(updates), id, shipperId];

      const { rows } = await db.query(`
        UPDATE credit_support
        SET ${setClauses.join(', ')}, updated_by = ${req.user.id}
        WHERE id = $${values.length - 1} AND shipper_id = $${values.length}
        RETURNING *
      `, values);
      if (!rows.length) return res.status(404).json({ error: 'Instrument not found' });

      await addAudit({
        actionType: 'UPDATE', entityType: 'credit_support', entityId: parseInt(id),
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Updated credit_support #${id}: ${Object.keys(updates).join(', ')}`,
      });

      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /credits/:shipperId/instruments/:id/call — вызов гарантии
// ─────────────────────────────────────────────────────────────
router.post(
  '/:shipperId/instruments/:id/call',
  authorize('credits:margin_call'),
  [
    param('shipperId').isInt({ min: 1 }),
    param('id').isInt({ min: 1 }),
    body('call_amount_eur').isFloat({ min: 0.01 }),
    body('call_reason').isString().isLength({ min: 5, max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const { shipperId, id } = req.params;
    const { call_amount_eur, call_reason } = req.body;

    try {
      const { rows: curr } = await db.query(
        `SELECT * FROM credit_support WHERE id=$1 AND shipper_id=$2 AND status='ACTIVE'`,
        [id, shipperId]
      );
      if (!curr.length) return res.status(404).json({ error: 'Active instrument not found' });

      const cs = curr[0];
      const callAmt = parseFloat(call_amount_eur);
      if (callAmt > parseFloat(cs.amount_eur))
        return res.status(422).json({ error: `Call amount ${callAmt} exceeds instrument amount ${cs.amount_eur}` });

      const { rows } = await db.query(`
        UPDATE credit_support
        SET status = 'CALLED', called_at = NOW(),
            called_amount_eur = $1, call_reason = $2,
            updated_by = $3
        WHERE id = $4 AND shipper_id = $5
        RETURNING *
      `, [callAmt, call_reason, req.user.id, id, shipperId]);

      await db.query(`
        INSERT INTO credit_support_events
          (credit_support_id, shipper_id, event_type, event_date,
           amount_before_eur, amount_after_eur, notes, performed_by)
        VALUES ($1, $2, 'CALLED', CURRENT_DATE, $3, $4, $5, $6)
      `, [id, shipperId, cs.amount_eur, cs.amount_eur - callAmt, call_reason, req.user.id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'credit_support', entityId: parseInt(id),
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Guarantee CALLED: ${callAmt} EUR. Reason: ${call_reason}`,
      });

      res.json({
        instrument:  rows[0],
        called_amount_eur: callAmt,
        remaining_eur:     parseFloat(cs.amount_eur) - callAmt,
        call_reason,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /credits/:shipperId/rating — обновить рейтинг шиппера
// ─────────────────────────────────────────────────────────────
router.post(
  '/:shipperId/rating',
  authorize('credits:write'),
  [
    param('shipperId').isInt({ min: 1 }),
    body('sp_rating').optional().isString().isLength({ max: 10 }),
    body('moodys_rating').optional().isString().isLength({ max: 10 }),
    body('creditreform_score').optional().isInt({ min: 100, max: 999 }),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const shipperId = parseInt(req.params.shipperId);
    const { sp_rating, moodys_rating, creditreform_score, notes } = req.body;

    const exempt = isRatingExempt({
      spRating:          sp_rating,
      moodysRating:      moodys_rating,
      creditreformScore: creditreform_score,
    });

    try {
      // Обновить шиппера
      await db.query(`
        UPDATE shippers
        SET sp_rating = COALESCE($1, sp_rating),
            moodys_rating = COALESCE($2, moodys_rating),
            creditreform_score = COALESCE($3, creditreform_score),
            rating_exempt = $4
        WHERE id = $5
      `, [sp_rating || null, moodys_rating || null,
          creditreform_score != null ? parseInt(creditreform_score) : null,
          exempt, shipperId]);

      // Сохранить историческую запись
      const { rows } = await db.query(`
        INSERT INTO credit_rating_history
          (shipper_id, sp_rating, moodys_rating, creditreform_score, rating_exempt, notes, recorded_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
      `, [shipperId, sp_rating || null, moodys_rating || null,
          creditreform_score != null ? parseInt(creditreform_score) : null,
          exempt, notes || null, req.user.id]);

      await addAudit({
        actionType: 'UPDATE', entityType: 'shipper_rating', entityId: shipperId,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Rating updated: SP=${sp_rating}, Moody's=${moodys_rating}, Creditreform=${creditreform_score}, exempt=${exempt}`,
      });

      res.status(201).json({
        ...rows[0],
        is_rating_exempt: exempt,
        exempt_reason: exempt
          ? (SP_INVEST_GRADES.includes(sp_rating) ? `S&P ${sp_rating} ≥ BBB-`
           : MOODYS_INVEST_GRADES.includes(moodys_rating) ? `Moody's ${moodys_rating} ≥ Baa3`
           : `Creditreform ${creditreform_score} ≤ 235`)
          : null,
      });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /credits/:shipperId/margin-call — выдать Margin Call
// NC Art. 5.5: 2 рабочих дня на доплнение
// ─────────────────────────────────────────────────────────────
router.post(
  '/:shipperId/margin-call',
  authorize('credits:margin_call'),
  [
    param('shipperId').isInt({ min: 1 }),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    const shipperId = parseInt(req.params.shipperId);

    try {
      const { rows: acRows } = await db.query(
        `SELECT * FROM v_available_credit WHERE shipper_id = $1`, [shipperId]
      );
      if (!acRows.length) return res.status(404).json({ error: 'Shipper not found' });

      const ac = acRows[0];

      // NC Art. 5.5: MC только при недостаточности
      if (ac.coverage_status === 'EXEMPT') {
        return res.status(422).json({
          error: 'Shipper has rating exemption (NC Art. 5.4) — Margin Call not applicable',
          coverage_status: ac.coverage_status,
        });
      }
      if (ac.coverage_status === 'SUFFICIENT') {
        return res.status(422).json({
          error: 'Credit support is sufficient — Margin Call not required',
          coverage_status: ac.coverage_status,
        });
      }

      const { rows } = await db.query(`
        INSERT INTO margin_calls (shipper_id, exposure_eur, limit_eur, issued_by, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [shipperId, ac.open_invoices_eur, ac.total_credit_eur,
          req.user.id, req.body.notes || null]);

      // Обновить credit_status шиппера
      await db.query(`UPDATE shippers SET credit_status = 'MARGIN_CALL' WHERE id = $1`, [shipperId]);

      // 2 рабочих дня по NC Art. 5.5 (приблизительно +2 к следующему рабочему дню)
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 2);
      if (deadline.getDay() === 0) deadline.setDate(deadline.getDate() + 1); // воскресенье
      if (deadline.getDay() === 6) deadline.setDate(deadline.getDate() + 2); // суббота

      await addAudit({
        actionType: 'MARGIN_CALL', entityType: 'margin_call', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `MC issued for ${ac.shipper_code}: exposure ${ac.open_invoices_eur} EUR, coverage ${ac.coverage_status}`,
      });

      res.status(201).json({
        margin_call:       rows[0],
        shipper_code:      ac.shipper_code,
        shipper_name:      ac.shipper_name,
        exposure_eur:      ac.open_invoices_eur,
        total_credit_eur:  ac.total_credit_eur,
        shortfall_eur:     ac.shortfall_eur,
        coverage_status:   ac.coverage_status,
        deadline_iso:      deadline.toISOString(),
        nc_reference:      'NC Art. 5.5 — 2 рабочих дня на доплнение кредитного обеспечения',
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
