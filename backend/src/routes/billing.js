'use strict';

/**
 * Billing API — Gastrans GTCP
 *
 * GET    /billing                   — list invoices
 * GET    /billing/:id               — single invoice
 * GET    /billing/:id/statement     — monthly statement (NC Art. 20.1)
 * POST   /billing                   — create invoice (auto-calculate)
 * PATCH  /billing/:id/status        — change status (ISSUED → PAID etc.)
 * POST   /billing/:id/erp-sync      — simulate 1С ERP sync
 * GET    /billing/gas-quality       — gas quality data (Annex 3A)
 *
 * Billing model (Gastrans NC / AERS Decision 05-145):
 *   capacity_fee = cap_entry_kwh_h × tariff_entry / 365 × days
 *               + cap_exit_kwh_h  × tariff_exit  / 365 × days
 *
 * Fuel gas (NC Art. 18):
 *   FG = X1 × Q_horgos + X2 × Q_serbia − KN
 *   X1 = compressor rate (% of Horgoš nominations)
 *   X2 = preheating rate (% of Serbia domestic nominations)
 *   KN = quality compensation kWh
 *
 * Late payment (NC Art. 20.4.2):
 *   interest = overdue × (EURIBOR_6M + 3%) / 360 × days_overdue
 */

const express   = require('express');
const { body, validationResult } = require('express-validator');
const db        = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const { addAudit }  = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate next invoice number: INV-YYYY-NNNN */
async function nextInvoiceNo() {
  const year = new Date().getFullYear();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM invoices WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(4, '0');
  return `INV-${year}-${seq}`;
}

/** Load all billing-relevant system params */
async function getSystemParams() {
  const keys = [
    // Tariffs (AERS Decision 05-145, GY2025/2026)
    'tariff_entry_gospodjinci_eur_kwh_h_yr',
    'tariff_exit_horgos_eur_kwh_h_yr',
    'tariff_commercial_reverse_eur_kwh_h_yr',
    'tariff_bundled_annual_eur_kwh_h_yr',
    'tariff_daily_entry_eur_kwh_h',
    'tariff_daily_exit_horgos_eur_kwh_h',
    // Fuel gas (NC Art. 18)
    'fuel_gas_x1_compressor_pct',
    'fuel_gas_x2_preheating_pct',
    'fuel_gas_kn_quality_kwh',
    'fuel_gas_rate_pct',               // legacy flat % (fallback)
    'fuel_gas_price_eur_mwh',
    // Gas quality reference
    'gcv_horgos_kwh_nm3',
    'gcv_reference_kwh_nm3',           // fallback
    // Balancing
    'balancing_gas_rate_eur_mwh',
    // Late payment (NC Art. 20.4.2)
    'euribor_6m_pct',
    'late_payment_spread_pct',
    'late_payment_day_basis',
  ];

  const { rows } = await db.query(
    `SELECT key, value FROM system_params WHERE key = ANY($1)`,
    [keys]
  );

  const p = {};
  for (const r of rows) {
    // value may be JSONB {value: X} or a plain scalar string
    p[r.key] = (r.value && typeof r.value === 'object' && 'value' in r.value)
      ? Number(r.value.value)
      : Number(r.value);
  }

  return {
    // Tariffs EUR/(kWh/h)/year — AERS 05-145 GY2025/2026 (corrected Sprint 9)
    tariffEntryEurKwhHYr:        p['tariff_entry_gospodjinci_eur_kwh_h_yr'] ?? 6.00,  // Entry Kirevo (was 4.19 = domestic exit!)
    tariffExitHorgosEurKwhHYr:   p['tariff_exit_horgos_eur_kwh_h_yr']       ?? 6.85,
    tariffExitDomesticEurKwhHYr: 4.19,  // Domestic exit zone (Paraćin+Pančevo+Gospođinci)
    tariffCommRevEntryEurKwhHYr: 2.85,  // CR Entry Kirevo
    tariffCommRevDomEurKwhHYr:   1.99,  // CR Domestic exit
    tariffCommRevEurKwhHYr:      p['tariff_commercial_reverse_eur_kwh_h_yr']?? 3.25,  // CR Horgoš
    tariffBundledEurKwhHYr:      p['tariff_bundled_annual_eur_kwh_h_yr']    ?? 12.85, // 6.00 + 6.85 (corrected)
    tariffDailyEntryEurKwhH:     p['tariff_daily_entry_eur_kwh_h']          ?? 0.0329, // Entry Kirevo daily (was 0.0230!)
    tariffDailyExitDomEurKwhH:   0.0230,  // Domestic exit daily
    tariffDailyExitEurKwhH:      p['tariff_daily_exit_horgos_eur_kwh_h']    ?? 0.0375,
    // Within-Day (EUR/kWh/h/hour)
    withinDayEntryEurKwhH:       0.0021,
    withinDayDomEurKwhH:         0.0014,
    withinDayHorgosEurKwhH:      0.0023,
    // Fuel gas NC Art.18
    x1CompressorPct:             p['fuel_gas_x1_compressor_pct']            ?? 0.42,
    x2PreheatingPct:             p['fuel_gas_x2_preheating_pct']            ?? 0.08,
    knQualityKwh:                p['fuel_gas_kn_quality_kwh']               ?? 0,
    fuelGasRatePct:              p['fuel_gas_rate_pct']                     ?? 0.50, // legacy
    fuelGasPriceEurMwh:          p['fuel_gas_price_eur_mwh']                ?? 32.50,
    // Gas quality
    gcvHorgosKwhNm3:             p['gcv_horgos_kwh_nm3'] || p['gcv_reference_kwh_nm3'] || 11.523,
    // Balancing
    balancingRateEurMwh:         p['balancing_gas_rate_eur_mwh']            ?? 5.00,
    // Late payment
    euribor6mPct:                p['euribor_6m_pct']                        ?? 2.64,
    latePaymentSpreadPct:        p['late_payment_spread_pct']               ?? 3.0,
    latePaymentDayBasis:         p['late_payment_day_basis']                ?? 360,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core billing functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capacity-based billing — CORRECTED formula (migration 005)
 *
 *   fee = cap_entry × t_entry / 365 × days
 *       + cap_exit  × t_exit  / 365 × days
 *
 * For Commercial Reverse:
 *   fee = cap_exit × t_commrev / 365 × days   (single tariff, exit side only)
 *
 * @param {Object} opts
 * @param {number} opts.capEntryKwhH       — contracted entry capacity (kWh/h)
 * @param {number} opts.capExitKwhH        — contracted exit capacity (kWh/h)
 * @param {number} opts.tariffEntryEurKwhHYr — entry tariff EUR/(kWh/h)/year
 * @param {number} opts.tariffExitEurKwhHYr  — exit tariff EUR/(kWh/h)/year
 * @param {number} opts.billingDays        — calendar days in billing period
 * @param {string} [opts.flowDirection]    — any of 7 NC routes or 2 legacy codes
 * @param {string} [opts.productType]      — FIRM_YEARLY, FIRM_WITHIN_DAY, etc.
 * @param {number} [opts.hours]            — hours for Within-Day products
 * @returns {{ entryFeeEur: number, exitFeeEur: number, totalFeeEur: number }}
 */

// NC route type lookup for billing
const REVERSE_ROUTES = [
  'HORGOS_KIREVO', 'EXIT_SERBIA_KIREVO',           // Full Reverse
  'HORGOS_EXIT_SERBIA', 'EXIT_SERBIA_HORGOS',       // Half Reverse
  'HORGOS_GOSPODJINCI',                              // Legacy reverse
];

function calcCapacityFee({
  capEntryKwhH,
  capExitKwhH,
  tariffEntryEurKwhHYr,
  tariffExitEurKwhHYr,
  billingDays,
  flowDirection = 'KIREVO_HORGOS',
  tariffCommRevEurKwhHYr = 3.25,
  // Within-Day support (NC Art.6.3.1.4)
  productType = 'FIRM_YEARLY',
  hours = 0,
  withinDayPriceEntry = 0.0021,
  withinDayPriceExit  = 0.0023,
  // Legacy backward-compat
  capacityKwhH = 0,
  tariffBundledEurKwhHYr = 12.85,
}) {
  const days = Math.max(1, billingDays || 1);

  // ── Within-Day: hourly fee, NOT / 365 ─────────────────────────────────────
  // NOTE: all line items rounded to 2 decimal places (EUR cents) before summing.
  // This matches standard TSO billing practice (each invoice line = EUR.cc).

  if (productType === 'FIRM_WITHIN_DAY' || productType === 'INTERRUPTIBLE_WITHIN_DAY') {
    const h = Math.max(1, hours || 1);
    const entry = capEntryKwhH || capacityKwhH || 0;
    const exit  = capExitKwhH  || capacityKwhH || 0;
    const entryFeeEur = parseFloat((entry * withinDayPriceEntry * h).toFixed(2));
    const exitFeeEur  = parseFloat((exit  * withinDayPriceExit  * h).toFixed(2));
    const totalFeeEur = parseFloat((entryFeeEur + exitFeeEur).toFixed(2));
    return { entryFeeEur, exitFeeEur, totalFeeEur, mode: 'WITHIN_DAY', hours: h };
  }

  // ── Commercial Reverse: entry+exit both have CR tariffs ───────────────────
  if (REVERSE_ROUTES.includes(flowDirection)) {
    const entry = capEntryKwhH || capacityKwhH || 0;
    const exit  = capExitKwhH  || capacityKwhH || 0;
    const entryFeeEur = parseFloat((entry * (tariffEntryEurKwhHYr || tariffCommRevEurKwhHYr) / 365 * days).toFixed(2));
    const exitFeeEur  = parseFloat((exit  * (tariffExitEurKwhHYr  || tariffCommRevEurKwhHYr) / 365 * days).toFixed(2));
    const totalFeeEur = parseFloat((entryFeeEur + exitFeeEur).toFixed(2));
    return { entryFeeEur, exitFeeEur, totalFeeEur, mode: 'COMMERCIAL_REVERSE' };
  }

  // ── Firm / Interruptible: separate entry + exit ───────────────────────────
  const entry = capEntryKwhH || capacityKwhH || 0;
  const exit  = capExitKwhH  || capacityKwhH || 0;

  // Legacy single-capacity backward compat
  if (!capEntryKwhH && !capExitKwhH && capacityKwhH > 0) {
    const totalFee = parseFloat((capacityKwhH * tariffBundledEurKwhHYr / 365 * days).toFixed(2));
    const entryFee = parseFloat((totalFee * tariffEntryEurKwhHYr / tariffBundledEurKwhHYr).toFixed(2));
    const exitFee  = parseFloat((totalFee - entryFee).toFixed(2));
    return { entryFeeEur: entryFee, exitFeeEur: exitFee, totalFeeEur: totalFee, mode: 'LEGACY_BUNDLED' };
  }

  const entryFeeEur = parseFloat((entry * tariffEntryEurKwhHYr / 365 * days).toFixed(2));
  const exitFeeEur  = parseFloat((exit  * tariffExitEurKwhHYr  / 365 * days).toFixed(2));
  const totalFeeEur = parseFloat((entryFeeEur + exitFeeEur).toFixed(2));

  return { entryFeeEur, exitFeeEur, totalFeeEur, mode: 'SEPARATE_ENTRY_EXIT' };
}

/**
 * Fuel Gas — NC Art. 18 formula
 *
 *   FG = X1 × Q_horgos + X2 × Q_serbia − KN
 *
 * @param {Object} opts
 * @param {number} opts.qHorgosKwh   — Horgoš nominations/allocations (kWh) for the period
 * @param {number} opts.qSerbiaKwh   — Serbia (domestic) nominations for the period
 * @param {number} opts.x1Pct        — X1 compressor rate (%)
 * @param {number} opts.x2Pct        — X2 preheating rate (%)
 * @param {number} [opts.knKwh]      — KN quality compensation (kWh), default 0
 * @param {number} opts.gcvKwhNm3    — GCV kWh/Nm³ for volume conversion
 * @param {number} opts.fuelGasPriceEurMwh — market price EUR/MWh
 * @returns {{ fuelGasKwh: number, fuelGasNm3: number, fuelGasAmountEur: number }}
 */
function calcFuelGas({
  qHorgosKwh  = 0,
  qSerbiaKwh  = 0,
  x1Pct       = 0.42,
  x2Pct       = 0.08,
  knKwh       = 0,
  gcvKwhNm3   = 11.523,
  fuelGasPriceEurMwh = 32.50,
}) {
  // FG in kWh
  const fuelGasKwh = Math.max(
    0,
    parseFloat(((x1Pct / 100) * qHorgosKwh + (x2Pct / 100) * qSerbiaKwh - knKwh).toFixed(2))
  );
  // Convert to Nm³ and MWh
  const fuelGasNm3  = gcvKwhNm3 > 0 ? parseFloat((fuelGasKwh / gcvKwhNm3).toFixed(2)) : 0;
  const fuelGasMwh  = parseFloat((fuelGasKwh / 1000).toFixed(2));
  const fuelGasAmountEur = parseFloat((fuelGasMwh * fuelGasPriceEurMwh).toFixed(2));

  return { fuelGasKwh, fuelGasNm3, fuelGasMwh, fuelGasAmountEur };
}

/**
 * Late payment interest — NC Art. 20.4.2
 *
 *   interest = overdue_eur × (EURIBOR_6M + spread) / 100 / day_basis × days_overdue
 *
 * @param {number} overdueEur    — unpaid invoice amount EUR
 * @param {number} daysOverdue   — calendar days since due date
 * @param {number} euribor6mPct  — current 6M EURIBOR (%)
 * @param {number} spreadPct     — fixed spread 3.0% (NC Art. 20.4.2)
 * @param {number} dayBasis      — 360 (NC Art. 20.4.2)
 * @returns {number} interest EUR
 */
function calcLatePaymentInterest({
  overdueEur,
  daysOverdue,
  euribor6mPct = 2.64,
  spreadPct    = 3.0,
  dayBasis     = 360,
}) {
  if (!overdueEur || overdueEur <= 0 || !daysOverdue || daysOverdue <= 0) return 0;
  const rate = (euribor6mPct + spreadPct) / 100;
  return parseFloat((overdueEur * rate / dayBasis * daysOverdue).toFixed(2));
}

/**
 * Interruption penalty — AERS Decision 05-145 item 3
 *
 * When interruptible daily or within-day capacity is interrupted,
 * the user is charged a fee = capacity product value × 3.
 *
 * @param {number} capacityFeeEur — original fee for the interrupted product
 * @param {string} productType    — must be INTERRUPTIBLE_DAILY or *_WITHIN_DAY
 * @returns {number} penalty amount EUR (0 if not applicable)
 */
function calcInterruptionPenalty(capacityFeeEur, productType) {
  const interruptibleTypes = [
    'INTERRUPTIBLE', 'INTERRUPTIBLE_DAILY', 'INTERRUPTIBLE_WITHIN_DAY',
    'FIRM_WITHIN_DAY', // Within-Day can be interrupted per NC Art.14.2.1.1
  ];
  if (!interruptibleTypes.includes(productType)) return 0;
  return parseFloat((capacityFeeEur * 3).toFixed(2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /billing
router.get('/', authorize('billing:read'), async (req, res, next) => {
  const { status, shipper_id, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params     = [];
  let i = 1;
  if (status)     { conditions.push(`i.status = $${i++}`);     params.push(status); }
  if (shipper_id) { conditions.push(`i.shipper_id = $${i++}`); params.push(shipper_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.code AS shipper_code, s.name AS shipper_name
       FROM invoices i JOIN shippers s ON s.id = i.shipper_id
       ${where} ORDER BY i.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    const { rows: cRows } = await db.query(
      `SELECT COUNT(*) AS count FROM invoices i ${where}`,
      params
    );
    const total = parseInt((cRows[0] || {}).count || '0', 10);
    res.json({ data: rows, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) { next(err); }
});

// GET /billing/gas-quality?point_code=HORGOS-EXIT&month=2025-04
router.get('/gas-quality', authorize('billing:read'), async (req, res, next) => {
  const { point_code = 'HORGOS-EXIT', month } = req.query;
  try {
    let query = `SELECT * FROM gas_quality_daily WHERE point_code = $1`;
    const params = [point_code];
    if (month) {
      query += ` AND TO_CHAR(gas_day, 'YYYY-MM') = $2`;
      params.push(month);
    }
    query += ` ORDER BY gas_day`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /billing/:id
router.get('/:id', authorize('billing:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.code AS shipper_code, s.name AS shipper_name
       FROM invoices i JOIN shippers s ON s.id = i.shipper_id WHERE i.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const { rows: items } = await db.query(
      `SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY line_no, id`,
      [req.params.id]
    );
    // Subtotals by line_type group
    const subtotals = {
      capacity: items.filter(i => ['CAPACITY','CAPACITY_WITHIN_DAY','TRANSFER'].includes(i.line_type)).reduce((s,i) => s + parseFloat(i.amount_eur), 0),
      fuelGas: items.filter(i => i.line_type === 'FUEL_GAS').reduce((s,i) => s + parseFloat(i.amount_eur), 0),
      penalties: items.filter(i => ['LATE_PAYMENT','IMBALANCE','INTERRUPTION_PENALTY'].includes(i.line_type)).reduce((s,i) => s + parseFloat(i.amount_eur), 0),
      premium: items.filter(i => ['AUCTION_PREMIUM','SURRENDER_PREMIUM'].includes(i.line_type)).reduce((s,i) => s + parseFloat(i.amount_eur), 0),
    };
    res.json({ ...rows[0], line_items: items, line_count: items.length, subtotals });
  } catch (err) { next(err); }
});

// GET /billing/:id/statement — Monthly Statement (NC Art. 20.1)
router.get('/:id/statement', authorize('billing:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ms.*, s.iban, s.vat_number
       FROM v_monthly_statement ms
       JOIN shippers s ON s.code = ms.shipper_code
       WHERE ms.invoice_no = (
         SELECT invoice_no FROM invoices WHERE id = $1
       )`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });

    // Fetch daily MDAP data for the period
    const inv = rows[0];
    const { rows: mdap } = await db.query(
      `SELECT * FROM mdap_daily
       WHERE contract_id IN (
         SELECT id FROM contracts WHERE shipper_id = $1
       )
       AND gas_day BETWEEN $2 AND $3
       ORDER BY gas_day, point_code`,
      [inv.shipper_id, inv.period_from, inv.period_to]
    );

    res.json({
      statement: inv,
      daily_data: mdap,
      // NC Art. 20.1 required fields checklist
      nc_fields: {
        contracted_capacity: !!(inv.cap_entry_kwh_h || inv.cap_exit_kwh_h || inv.capacity_kwh_h),
        allocated_quantities: mdap.length > 0,
        fuel_gas: !!(inv.fuel_gas_kwh || inv.fuel_gas_volume_mwh),
        transmission_imbalance: inv.balancing_gas_mwh != null,
        interruption_data: false, // Sprint 6
        gas_quality: mdap.some(r => r.gcv_kwh_nm3),
      },
    });
  } catch (err) { next(err); }
});

// POST /billing — create invoice
router.post(
  '/',
  authorize('billing:create'),
  [
    body('shipperId').isUUID(),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
    body('flowDirection').optional().isIn([
      'GOSPODJINCI_HORGOS', 'HORGOS_GOSPODJINCI', 'KIREVO_EXIT_SERBIA',
    ]),
    // Capacity-based (preferred, NC model)
    body('capEntryKwhH').optional().isFloat({ min: 0 }),
    body('capExitKwhH').optional().isFloat({ min: 0 }),
    body('capacityKwhH').optional().isFloat({ min: 0 }),  // legacy single
    body('contractId').optional().isInt(),
    // Fuel gas NC Art.18 actuals
    body('qHorgosKwh').optional().isFloat({ min: 0 }),
    body('qSerbiaKwh').optional().isFloat({ min: 0 }),
    // Legacy volume-based
    body('volumeMwh').optional().isFloat({ min: 0 }),
    body('tariffEurMwh').optional().isFloat({ min: 0 }),
    body('balancingGasMwh').optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const {
      shipperId, periodFrom, periodTo, dueDate,
      flowDirection = 'GOSPODJINCI_HORGOS',
      capEntryKwhH, capExitKwhH, capacityKwhH,
      contractId,
      qHorgosKwh  = 0,
      qSerbiaKwh  = 0,
      volumeMwh   = 0, tariffEurMwh = 0,
      balancingGasMwh = 0,
    } = req.body;

    try {
      const sp = await getSystemParams();

      // ── Billing period (days) ───────────────────────────────────────────
      let billingDays = 1;
      if (periodFrom && periodTo) {
        const d1 = new Date(periodFrom), d2 = new Date(periodTo);
        billingDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
      }

      // ── Resolve capacity + tariffs from contract (if given) ─────────────
      let resolvedCapEntry  = capEntryKwhH  ? Number(capEntryKwhH)  : 0;
      let resolvedCapExit   = capExitKwhH   ? Number(capExitKwhH)   : 0;
      let resolvedCapLegacy = capacityKwhH  ? Number(capacityKwhH)  : 0;
      let tariffEntryYr     = sp.tariffEntryEurKwhHYr;
      let tariffExitYr      = sp.tariffExitHorgosEurKwhHYr;
      let resolvedDirection = flowDirection;
      let billingModel      = 'VOLUME';

      if (contractId) {
        const { rows: cRows } = await db.query(
          `SELECT * FROM contracts WHERE id = $1`, [contractId]
        );
        if (cRows.length) {
          const c = cRows[0];
          if (c.cap_entry_kwh_h  && !resolvedCapEntry)  resolvedCapEntry  = parseFloat(c.cap_entry_kwh_h);
          if (c.cap_exit_kwh_h   && !resolvedCapExit)   resolvedCapExit   = parseFloat(c.cap_exit_kwh_h);
          if (c.capacity_kwh_h   && !resolvedCapLegacy) resolvedCapLegacy = parseFloat(c.capacity_kwh_h);
          if (c.tariff_entry_eur_kwh_h) tariffEntryYr = parseFloat(c.tariff_entry_eur_kwh_h);
          if (c.tariff_exit_eur_kwh_h)  tariffExitYr  = parseFloat(c.tariff_exit_eur_kwh_h);
          if (c.flow_direction)         resolvedDirection = c.flow_direction;
          if (c.billing_model)          billingModel = c.billing_model;
        }
      }

      const hasCapacity = (resolvedCapEntry > 0 || resolvedCapExit > 0 || resolvedCapLegacy > 0);
      if (hasCapacity) billingModel = 'CAPACITY';

      // ── Line 1: Capacity fee (take-or-pay, NC ship-or-pay) ──────────────
      let capacityFees  = { entryFeeEur: 0, exitFeeEur: 0, totalFeeEur: 0 };
      let transitAmount = 0;

      if (billingModel === 'CAPACITY') {
        capacityFees = calcCapacityFee({
          capEntryKwhH:          resolvedCapEntry,
          capExitKwhH:           resolvedCapExit,
          capacityKwhH:          resolvedCapLegacy,
          tariffEntryEurKwhHYr:  tariffEntryYr,
          tariffExitEurKwhHYr:   tariffExitYr,
          tariffCommRevEurKwhHYr: sp.tariffCommRevEurKwhHYr,
          tariffBundledEurKwhHYr: sp.tariffBundledEurKwhHYr,
          billingDays,
          flowDirection: resolvedDirection,
        });
        transitAmount = capacityFees.totalFeeEur;
      } else {
        transitAmount = parseFloat((Number(volumeMwh) * Number(tariffEurMwh)).toFixed(2));
      }

      // ── Line 2: Fuel gas — NC Art.18 ─────────────────────────────────────
      // If actual nominations provided → use NC formula
      // Otherwise estimate from capacity × utilisation × days (billing fallback)
      let fuelGasResult;
      const hasActualFlow = qHorgosKwh > 0 || qSerbiaKwh > 0;

      if (hasActualFlow) {
        fuelGasResult = calcFuelGas({
          qHorgosKwh:         Number(qHorgosKwh),
          qSerbiaKwh:         Number(qSerbiaKwh),
          x1Pct:              sp.x1CompressorPct,
          x2Pct:              sp.x2PreheatingPct,
          knKwh:              sp.knQualityKwh,
          gcvKwhNm3:          sp.gcvHorgosKwhNm3,
          fuelGasPriceEurMwh: sp.fuelGasPriceEurMwh,
        });
      } else {
        // Fallback: legacy flat-rate estimate from effective capacity
        const capForFuel = resolvedCapEntry || resolvedCapLegacy || 0;
        // Estimate: cap × 24h × days × 85% utilisation = estimated kWh flow
        const estFlowKwh = capForFuel * 24 * billingDays * 0.85;
        const estFlowQ = resolvedDirection === 'HORGOS_GOSPODJINCI'
          ? { qHorgosKwh: 0, qSerbiaKwh: estFlowKwh }
          : { qHorgosKwh: estFlowKwh, qSerbiaKwh: 0 };

        fuelGasResult = calcFuelGas({
          ...estFlowQ,
          x1Pct:              sp.x1CompressorPct,
          x2Pct:              sp.x2PreheatingPct,
          knKwh:              sp.knQualityKwh,
          gcvKwhNm3:          sp.gcvHorgosKwhNm3,
          fuelGasPriceEurMwh: sp.fuelGasPriceEurMwh,
        });
      }

      // ── Line 3: Balancing gas ─────────────────────────────────────────────
      const balancingGasEur = parseFloat(
        (Number(balancingGasMwh) * sp.balancingRateEurMwh).toFixed(2)
      );

      // ── Total ─────────────────────────────────────────────────────────────
      const totalAmountEur = parseFloat(
        (transitAmount + fuelGasResult.fuelGasAmountEur + balancingGasEur).toFixed(2)
      );

      // ── Due date: NC Art. 20.4.1 — User shall make payment no later than 20th
      // of the month in which it receives the Monthly Invoice.
      // Invoice issued by 5th of month following Gas Month (Art. 20.3.1).
      // So due date = 20th of month after period_to.
      const computedDueDate = dueDate || (() => {
        const pTo = new Date(periodTo || periodFrom);
        return new Date(pTo.getFullYear(), pTo.getMonth() + 1, 20)
          .toISOString().slice(0, 10);
      })();

      const invoiceNo = await nextInvoiceNo();

      const { rows } = await db.query(
        `INSERT INTO invoices (
           invoice_no, shipper_id, period_from, period_to,
           volume_mwh, tariff_eur_mwh, amount_eur,
           transit_amount_eur,
           fuel_gas_rate_pct, fuel_gas_volume_mwh, fuel_gas_price_eur_mwh,
           fuel_gas_amount_eur, fuel_gas_kwh, fuel_gas_volume_nm3,
           balancing_gas_mwh, balancing_gas_eur,
           total_amount_eur,
           capacity_kwh_h, capacity_fee_eur,
           cap_entry_kwh_h, cap_exit_kwh_h,
           cap_entry_fee_eur, cap_exit_fee_eur,
           billing_days, flow_direction,
           due_date, created_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
           $18,$19,$20,$21,$22,$23,$24,$25,$26,$27
         ) RETURNING *`,
        [
          invoiceNo,
          shipperId,
          periodFrom,
          periodTo,
          // volume (estimated MWh for display / legacy)
          volumeMwh || ((resolvedCapEntry || resolvedCapLegacy) * billingDays * 24 / 1000),
          tariffEurMwh || ((tariffEntryYr + tariffExitYr) / 365),
          transitAmount,          // amount_eur (legacy compat)
          transitAmount,          // transit_amount_eur
          sp.x1CompressorPct,     // stored as "fuel_gas_rate_pct" field
          fuelGasResult.fuelGasMwh,
          sp.fuelGasPriceEurMwh,
          fuelGasResult.fuelGasAmountEur,
          fuelGasResult.fuelGasKwh,
          fuelGasResult.fuelGasNm3,
          balancingGasMwh,
          balancingGasEur,
          totalAmountEur,
          // capacity columns
          resolvedCapLegacy || resolvedCapEntry || null,
          capacityFees.totalFeeEur || null,
          resolvedCapEntry  || null,
          resolvedCapExit   || null,
          capacityFees.entryFeeEur || null,
          capacityFees.exitFeeEur  || null,
          billingDays,
          resolvedDirection,
          computedDueDate,
          req.user.id,
        ]
      );

      await addAudit({
        actionType: 'INVOICE_CREATE',
        entityType: 'invoice',
        entityId:   rows[0].id,
        userId:     req.user.id,
        username:   req.user.username,
        ipAddress:  req.ip,
        description:
          `Invoice ${invoiceNo} [${billingModel}] dir:${resolvedDirection} | ` +
          (billingModel === 'CAPACITY'
            ? `Entry: ${resolvedCapEntry} kWh/h ×€${tariffEntryYr}=${capacityFees.entryFeeEur} | ` +
              `Exit: ${resolvedCapExit} kWh/h ×€${tariffExitYr}=${capacityFees.exitFeeEur} | `
            : `Transit: €${transitAmount} | `) +
          `FuelGas: ${fuelGasResult.fuelGasKwh} kWh (X1=${sp.x1CompressorPct}% X2=${sp.x2PreheatingPct}%)=€${fuelGasResult.fuelGasAmountEur} | ` +
          `Balancing: €${balancingGasEur} | TOTAL: €${totalAmountEur}`,
      });

      res.status(201).json({
        ...rows[0],
        billing_model: billingModel,
        // breakdown for UI
        _breakdown: {
          capacity: {
            entryFeeEur:   capacityFees.entryFeeEur,
            exitFeeEur:    capacityFees.exitFeeEur,
            totalFeeEur:   capacityFees.totalFeeEur,
            capEntryKwhH:  resolvedCapEntry,
            capExitKwhH:   resolvedCapExit,
          },
          fuelGas: {
            kwh:           fuelGasResult.fuelGasKwh,
            nm3:           fuelGasResult.fuelGasNm3,
            mwh:           fuelGasResult.fuelGasMwh,
            amountEur:     fuelGasResult.fuelGasAmountEur,
            x1Pct:         sp.x1CompressorPct,
            x2Pct:         sp.x2PreheatingPct,
            qHorgosKwh:    Number(qHorgosKwh),
            qSerbiaKwh:    Number(qSerbiaKwh),
            estimated:     !hasActualFlow,
          },
          balancing:  { mwh: Number(balancingGasMwh), amountEur: balancingGasEur },
          total:      totalAmountEur,
          billingDays,
          dueDate:    computedDueDate,
        },
      });
    } catch (err) { next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /billing/with-lines — Variant C: one invoice, multiple line items
// NC Art.20.3 compliant: separate lines per Capacity Product, Fuel Gas, etc.
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  '/with-lines',
  authorize('billing:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
    body('lines').isArray({ min: 1 }).withMessage('At least one line item required'),
    body('lines.*.lineType').isIn([
      'CAPACITY','CAPACITY_WITHIN_DAY','FUEL_GAS','TRANSFER',
      'SURRENDER_PREMIUM','LATE_PAYMENT','IMBALANCE',
      'INTERRUPTION_PENALTY','AUCTION_PREMIUM'
    ]),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, periodFrom, periodTo, dueDate, lines } = req.body;

    try {
      const sp = await getSystemParams();
      const invoiceNo = await nextInvoiceNo();

      // Calculate billing period
      const d1 = new Date(periodFrom), d2 = new Date(periodTo);
      const defaultDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);

      // ── Quarter day counts for GY2025/2026 ────────────────────────────────
      const QUARTER_DAYS = { Q1: 92, Q2: 90, Q3: 91, Q4: 92 };
      function getQuarterDays(pt) {
        if (!pt) return 91;
        const m = pt.match(/Q([1-4])/);
        return m ? QUARTER_DAYS['Q' + m[1]] : 91;
      }

      // ── Calculate each line (two-pass: CAPACITY first, then others can reference) ─
      const preparedLines = lines.map((line, idx) => ({ ...line, line_no: idx + 1 }));

      // Pass 1: calculate CAPACITY + CAPACITY_WITHIN_DAY lines
      for (const l of preparedLines) {
        if (l.lineType !== 'CAPACITY' && l.lineType !== 'CAPACITY_WITHIN_DAY') continue;

        const cap = Number(l.capacityKwhH) || 0;
        let tariff = Number(l.tariffEur) || 0;
        const days = l.periodDays || defaultDays;
        const pt = l.productType || 'FIRM_YEARLY';

        // Auto-lookup tariff from reserve_prices if not provided
        if (tariff === 0 && l.pointCode) {
          try {
            const { rows: rp } = await db.query(
              `SELECT tariff_eur FROM reserve_prices
               WHERE product_type = $1 AND point_code = $2 AND gas_year = '2025/2026' LIMIT 1`,
              [pt, l.pointCode]
            );
            if (rp.length) {
              tariff = parseFloat(rp[0].tariff_eur);
              l.tariffEur = tariff;
              l.tariffSource = 'AERS_05_145';  // auto-looked up
            }
          } catch (e) { /* reserve_prices may not exist in test */ }
        }
        if (!l.tariffSource) l.tariffSource = 'USER_INPUT';

        // Period-aware formula — tariff unit depends on product type
        let fee = 0;
        let formula = '';

        if (l.lineType === 'CAPACITY_WITHIN_DAY' || pt.includes('WITHIN_DAY')) {
          // Within-Day: EUR/kWh/h/hour × hours
          const hours = Number(l.hours) || 1;
          fee = cap * tariff * hours;
          formula = `${cap} × ${tariff}/h × ${hours}h`;
          l.nc_ref = 'Art.6.3.1.4';

        } else if (pt.includes('YEARLY') || pt.includes('ANNUAL')) {
          // Annual: EUR/kWh/h/year → / 365 × days
          fee = cap * tariff / 365 * days;
          formula = `${cap} × ${tariff}/365 × ${days}d`;

        } else if (pt.includes('QUARTERLY')) {
          // Quarterly: EUR/kWh/h/quarter → / days_in_quarter × days
          const qDays = getQuarterDays(pt);
          fee = cap * tariff / qDays * days;
          formula = `${cap} × ${tariff}/${qDays}qd × ${days}d`;

        } else if (pt.includes('MONTHLY')) {
          // Monthly: EUR/kWh/h/month → tariff is already for the month
          fee = cap * tariff;
          formula = `${cap} × ${tariff}/month`;

        } else if (pt.includes('DAILY') || pt.includes('INTERRUPTIBLE')) {
          // Daily: EUR/kWh/h/day × days
          fee = cap * tariff * days;
          formula = `${cap} × ${tariff}/d × ${days}d`;

        } else {
          // Fallback: assume annual
          fee = cap * tariff / 365 * days;
          formula = `${cap} × ${tariff}/365 × ${days}d (fallback)`;
        }

        l.amount_eur = parseFloat(fee.toFixed(2));
        l.formula = formula;
        l.description = l.description || `${l.lineType} ${pt} at ${l.pointCode || '?'} (${l.direction || '?'}): ${formula} = €${l.amount_eur}`;
        l.nc_ref = l.nc_ref || l.ncRef || 'Art.20.3.2.1';
      }

      // Pass 2: calculate remaining lines (can reference capacity lines)
      const calculatedLines = preparedLines;
      for (const l of calculatedLines) {
        if (l.amount_eur !== undefined) continue; // already calculated in pass 1
        const days = l.periodDays || defaultDays;

        switch (l.lineType) {
          case 'CAPACITY':
          case 'CAPACITY_WITHIN_DAY':
            break; // already calculated in pass 1
          case 'FUEL_GAS': {
            let qty = Number(l.quantityKwh) || 0;
            const price = Number(l.unitPriceEur) || sp.fuelGasPriceEurMwh / 1000;

            // Auto-calculate FG volume from capacity lines if not provided
            // NC Art.18: FG is calculated based on EXIT nominations (Horgoš = compressor, Serbia = preheating)
            // Fuel Gas is charged to shippers using the physical flow direction (transit through pipeline)
            if (qty === 0) {
              const capLines = preparedLines.filter(cl => cl.lineType === 'CAPACITY' || cl.lineType === 'CAPACITY_WITHIN_DAY');
              let qHorgos = 0, qSerbia = 0;
              // NC Art.18: FG is based on EXIT volumes only
              // X1 = compressor (for gas exiting at Horgoš — transit to Hungary)
              // X2 = preheating (for gas exiting at Serbia domestic points)
              for (const cl of capLines) {
                const cap = Number(cl.capacityKwhH) || 0;
                const d = Number(cl.periodDays) || days;
                const h = Number(cl.hours) || d * 24;
                const flowKwh = cap * h;
                const dir = (cl.direction || '').toUpperCase();
                const point = (cl.pointCode || '').toUpperCase();
                // Only EXIT lines contribute to FG calculation
                if (dir === 'EXIT' && point.includes('HORGOS')) qHorgos += flowKwh;
                else if (dir === 'EXIT' && (point.includes('SERBIA') || point.includes('EXIT-SERBIA'))) qSerbia += flowKwh;
                // ENTRY lines do NOT contribute — FG is on exit side only
              }
              // NC Art.18: FG = X1 × Q_horgos + X2 × Q_serbia − KN
              qty = sp.x1CompressorPct / 100 * qHorgos + sp.x2PreheatingPct / 100 * qSerbia - sp.knQualityKwh;
              qty = Math.max(0, qty);
              l.quantityKwh = parseFloat(qty.toFixed(2));
            }
            l.amount_eur = parseFloat((qty * price).toFixed(2));
            l.description = l.description || `Fuel Gas NC Art.18: FG=${qty.toFixed(0)} kWh (X1=${sp.x1CompressorPct}% × Q_horgos + X2=${sp.x2PreheatingPct}% × Q_serbia) × ${price} EUR/kWh = €${l.amount_eur}`;
            l.nc_ref = 'Art.18';
            break;
          }
          case 'TRANSFER': {
            const cap = Number(l.capacityKwhH) || 0;
            const tariff = Number(l.tariffEur) || 0;
            l.amount_eur = parseFloat((cap * tariff / 365 * days).toFixed(2));
            l.description = l.description || `Transfer from ${l.transferRef || '?'}: ${cap} kWh/h × ${tariff}/365 × ${days}d`;
            l.nc_ref = 'Art.10.3';
            break;
          }
          case 'AUCTION_PREMIUM': {
            // NC Art.8.3: AP = (P_old − P_new) × RC × P
            // P_old/P_new = EUR/kWh/h premium, RC = capacity, P = hours in period
            const cap = Number(l.capacityKwhH) || 0;
            const auctionPrice = Number(l.auctionPriceEur) || 0;
            const reservePrice = Number(l.reservePriceEur) || 0;
            const premium = Math.max(0, auctionPrice - reservePrice);
            const periodHours = Number(l.hours) || days * 24;
            l.premium_eur = premium;
            l.amount_eur = parseFloat((premium * cap * periodHours).toFixed(2));
            l.formula = `(${auctionPrice} − ${reservePrice}) × ${cap} × ${periodHours}h`;
            l.description = l.description || `Auction Premium: ${l.formula} = €${l.amount_eur}`;
            l.nc_ref = 'Art.7.6.11';
            break;
          }
          case 'SURRENDER_PREMIUM': {
            const rc = Number(l.capacityKwhH) || 0;
            const pOld = Number(l.auctionPriceEur) || 0;
            const pNew = Number(l.reservePriceEur) || 0;
            const hours = Number(l.hours) || days * 24;
            l.amount_eur = parseFloat((Math.max(0, pOld - pNew) * rc * hours).toFixed(2));
            l.nc_ref = 'Art.8.3';
            break;
          }
          case 'LATE_PAYMENT': {
            const overdue = Number(l.overdueAmountEur) || 0;
            const overdueDays = Number(l.overdueDays) || 0;
            const rate = (sp.euribor6mPct + sp.latePaymentSpreadPct) / 100;
            l.interest_rate_pct = sp.euribor6mPct + sp.latePaymentSpreadPct;
            l.amount_eur = parseFloat((overdue * rate / 360 * overdueDays).toFixed(2));
            l.nc_ref = 'Art.20.4.2';
            break;
          }
          case 'IMBALANCE': {
            const ti = Math.abs(Number(l.quantityKwh) || 0);
            const gpp = Number(l.unitPriceEur) || 0;
            l.amount_eur = parseFloat((ti * gpp).toFixed(2));
            l.nc_ref = 'Art.15.4';
            break;
          }
          case 'INTERRUPTION_PENALTY': {
            // AERS 05-145 item 3: "fee for interruption = value of capacity products × 3"
            // baseFee should be the capacity fee for the interrupted period
            const cap = Number(l.capacityKwhH) || 0;
            const tariff = Number(l.tariffEur) || 0;
            const intDays = Number(l.periodDays) || 1;
            const intHours = Number(l.hours) || intDays * 24;
            // Calculate base capacity fee for the interrupted period
            const baseFee = cap * tariff * intDays;  // daily tariff × days
            l.amount_eur = parseFloat((baseFee * 3).toFixed(2));
            l.formula = `(${cap} × ${tariff} × ${intDays}d) × 3`;
            l.description = l.description || `Interruption penalty ×3: ${l.formula} = €${l.amount_eur}`;
            l.nc_ref = 'AERS 05-145 item 3';
            break;
          }
          default:
            if (l.amount_eur === undefined) l.amount_eur = 0;
        }
      }

      // ── Subtotals ──────────────────────────────────────────────────────
      const subtotalCapacity = calculatedLines
        .filter(l => ['CAPACITY','CAPACITY_WITHIN_DAY','TRANSFER'].includes(l.lineType))
        .reduce((s, l) => s + l.amount_eur, 0);
      const subtotalFuelGas = calculatedLines
        .filter(l => l.lineType === 'FUEL_GAS')
        .reduce((s, l) => s + l.amount_eur, 0);
      const subtotalPenalties = calculatedLines
        .filter(l => ['LATE_PAYMENT','IMBALANCE','INTERRUPTION_PENALTY'].includes(l.lineType))
        .reduce((s, l) => s + l.amount_eur, 0);
      const subtotalPremium = calculatedLines
        .filter(l => ['AUCTION_PREMIUM','SURRENDER_PREMIUM'].includes(l.lineType))
        .reduce((s, l) => s + l.amount_eur, 0);
      const totalAmountEur = parseFloat((subtotalCapacity + subtotalFuelGas + subtotalPenalties + subtotalPremium).toFixed(2));

      // ── Due date (NC Art.20.4.1) ───────────────────────────────────────
      const computedDueDate = dueDate || (() => {
        const pTo = new Date(periodTo);
        return new Date(pTo.getFullYear(), pTo.getMonth() + 1, 20).toISOString().slice(0, 10);
      })();

      // ── INSERT invoice ─────────────────────────────────────────────────
      const { rows } = await db.query(
        `INSERT INTO invoices (
           invoice_no, shipper_id, period_from, period_to,
           amount_eur, total_amount_eur,
           subtotal_capacity_eur, subtotal_fuel_gas_eur,
           subtotal_penalties_eur, subtotal_premium_eur,
           line_items_count, due_date, created_by, status
         ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT') RETURNING *`,
        [invoiceNo, shipperId, periodFrom, periodTo,
         totalAmountEur,
         subtotalCapacity, subtotalFuelGas, subtotalPenalties, subtotalPremium,
         calculatedLines.length, computedDueDate, req.user.id]
      );
      const invoice = rows[0];

      // ── INSERT line items ──────────────────────────────────────────────
      for (const l of calculatedLines) {
        await db.query(
          `INSERT INTO invoice_line_items (
             invoice_id, line_no, line_type, product_type, point_code, direction,
             capacity_kwh_h, tariff_eur, period_days, hours,
             quantity_kwh, unit_price_eur,
             auction_price_eur, reserve_price_eur, premium_eur,
             overdue_amount_eur, overdue_days, interest_rate_pct,
             amount_eur, description, nc_ref, contract_id,
             auction_bid_id, source_invoice_id, transfer_ref
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
          [
            invoice.id, l.line_no, l.lineType,
            l.productType || null, l.pointCode || null, l.direction || null,
            l.capacityKwhH || null, l.tariffEur || null, l.periodDays || null, l.hours || null,
            l.quantityKwh || null, l.unitPriceEur || null,
            l.auctionPriceEur || null, l.reservePriceEur || null, l.premium_eur || null,
            l.overdueAmountEur || null, l.overdueDays || null, l.interest_rate_pct || null,
            l.amount_eur, l.description || null, l.nc_ref || null, l.contractId || null,
            l.auctionBidId || null, l.sourceInvoiceId || null, l.transferRef || null,
          ]
        );
      }

      await addAudit({
        actionType: 'INVOICE_CREATE_LINES', entityType: 'invoice', entityId: invoice.id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Invoice ${invoiceNo} with ${calculatedLines.length} lines: ` +
          `Cap €${subtotalCapacity.toFixed(2)} + FG €${subtotalFuelGas.toFixed(2)} + Pen €${subtotalPenalties.toFixed(2)} + Prem €${subtotalPremium.toFixed(2)} = TOTAL €${totalAmountEur}`,
      });

      res.status(201).json({
        ...invoice,
        lines: calculatedLines,
        subtotals: { capacity: subtotalCapacity, fuelGas: subtotalFuelGas, penalties: subtotalPenalties, premium: subtotalPremium },
      });
    } catch (err) { next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /billing/generate — Auto-generate invoice from shipper's contracts
// Finds all active contracts for period, creates CAPACITY + FUEL_GAS lines
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  '/generate',
  authorize('billing:create'),
  [
    body('shipperId').isString().isLength({ min: 36, max: 36 }),
    body('periodFrom').isDate(),
    body('periodTo').isDate(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, periodFrom, periodTo } = req.body;

    try {
      // 1. Find all active contracts for this shipper in the billing period
      const { rows: contracts } = await db.query(
        `SELECT c.*, fd.label AS flow_label
         FROM contracts c
         LEFT JOIN LATERAL (SELECT 'NC' AS label) fd ON true
         WHERE c.shipper_id = $1 AND c.status = 'ACTIVE'
           AND c.start_date <= $3 AND c.end_date >= $2
         ORDER BY c.start_date`,
        [shipperId, periodFrom, periodTo]
      );

      if (!contracts.length) {
        return res.status(404).json({ error: 'No active contracts found for this shipper in the billing period' });
      }

      // 2. Build lines from contracts
      const lines = [];
      const sp = await getSystemParams();
      const d1 = new Date(periodFrom), d2 = new Date(periodTo);
      const defaultDays = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);

      for (const c of contracts) {
        let capEntry = parseFloat(c.cap_entry_kwh_h || c.capacity_kwh_h || 0);
        let capExit  = parseFloat(c.cap_exit_kwh_h  || c.capacity_kwh_h || 0);

        // Fallback: if contract has no capacity, try capacity_bookings for this shipper
        if (capEntry === 0 && capExit === 0) {
          const { rows: bk } = await db.query(
            `SELECT point, direction, capacity_mwh_d FROM capacity_bookings
             WHERE shipper_id = $1 AND status = 'ACTIVE'
               AND period_from <= $3 AND period_to >= $2
             ORDER BY direction`,
            [shipperId, periodFrom, periodTo]
          );
          for (const b of bk) {
            // Convert MWh/day → kWh/h: MWh/d × 1000 / 24
            const kwhH = parseFloat(b.capacity_mwh_d) * 1000 / 24;
            if (b.direction === 'ENTRY') capEntry = Math.max(capEntry, kwhH);
            else capExit = Math.max(capExit, kwhH);
          }
        }
        let tariffEntry = parseFloat(c.tariff_entry_eur_kwh_h || 0);
        let tariffExit  = parseFloat(c.tariff_exit_eur_kwh_h  || 0);
        let tariffSourceEntry = 'CONTRACT';
        let tariffSourceExit  = 'CONTRACT';

        // Auto-lookup from reserve_prices if contract has no tariff
        const productType = c.contract_type || 'FIRM_YEARLY';
        if (tariffEntry === 0 && pts.entry) {
          try {
            const { rows: rp } = await db.query(
              `SELECT tariff_eur FROM reserve_prices WHERE product_type = $1 AND point_code = $2 AND gas_year = '2025/2026' LIMIT 1`,
              [productType, pts.entry]
            );
            if (rp.length) { tariffEntry = parseFloat(rp[0].tariff_eur); tariffSourceEntry = 'AERS_05_145'; }
          } catch(e) {}
        }
        if (tariffExit === 0 && pts.exit) {
          try {
            const { rows: rp } = await db.query(
              `SELECT tariff_eur FROM reserve_prices WHERE product_type = $1 AND point_code = $2 AND gas_year = '2025/2026' LIMIT 1`,
              [productType, pts.exit]
            );
            if (rp.length) { tariffExit = parseFloat(rp[0].tariff_eur); tariffSourceExit = 'AERS_05_145'; }
          } catch(e) {}
        }
        // Final fallback to system params
        if (tariffEntry === 0) { tariffEntry = sp.tariffEntryEurKwhHYr; tariffSourceEntry = 'SYSTEM_PARAMS'; }
        if (tariffExit === 0)  { tariffExit = sp.tariffExitHorgosEurKwhHYr; tariffSourceExit = 'SYSTEM_PARAMS'; }
        const flowDir = c.flow_direction || 'KIREVO_HORGOS';

        // Determine entry/exit points from flow direction
        const FLOW_POINTS = {
          KIREVO_HORGOS:            { entry: 'KIREVO-ENTRY', exit: 'HORGOS-EXIT' },
          KIREVO_EXIT_SERBIA:       { entry: 'KIREVO-ENTRY', exit: 'EXIT-SERBIA' },
          KIREVO_HORGOS_AND_SERBIA: { entry: 'KIREVO-ENTRY', exit: 'HORGOS-EXIT' },
          HORGOS_KIREVO:            { entry: 'HORGOS-ENTRY', exit: 'KIREVO-EXIT' },
          EXIT_SERBIA_KIREVO:       { entry: 'EXIT-SERBIA-ENTRY', exit: 'KIREVO-EXIT' },
          HORGOS_EXIT_SERBIA:       { entry: 'HORGOS-ENTRY', exit: 'EXIT-SERBIA' },
          EXIT_SERBIA_HORGOS:       { entry: 'EXIT-SERBIA-ENTRY', exit: 'HORGOS-EXIT' },
          GOSPODJINCI_HORGOS:       { entry: 'KIREVO-ENTRY', exit: 'HORGOS-EXIT' },
          HORGOS_GOSPODJINCI:       { entry: 'HORGOS-ENTRY', exit: 'EXIT-SERBIA' },
        };
        const pts = FLOW_POINTS[flowDir] || { entry: 'KIREVO-ENTRY', exit: 'HORGOS-EXIT' };

        // Entry line
        if (capEntry > 0) {
          lines.push({
            lineType: 'CAPACITY',
            productType: productType,
            pointCode: pts.entry,
            direction: 'ENTRY',
            capacityKwhH: capEntry,
            tariffEur: tariffEntry,
            tariffSource: tariffSourceEntry,
            periodDays: defaultDays,
            contractId: c.id,
          });
        }

        // Exit line
        if (capExit > 0) {
          lines.push({
            lineType: 'CAPACITY',
            productType: productType,
            pointCode: pts.exit,
            direction: 'EXIT',
            capacityKwhH: capExit,
            tariffEur: tariffExit,
            tariffSource: tariffSourceExit,
            periodDays: defaultDays,
            contractId: c.id,
          });
        }
      }

      // 3. Add Fuel Gas line (auto-calculated from EXIT lines)
      lines.push({ lineType: 'FUEL_GAS' });

      // 4. Check for overdue invoices → LATE_PAYMENT lines
      const { rows: overdue } = await db.query(
        `SELECT id, invoice_no, total_amount_eur, due_date
         FROM invoices WHERE shipper_id = $1 AND status = 'OVERDUE'`,
        [shipperId]
      );
      for (const inv of overdue) {
        const daysOverdue = Math.max(1, Math.floor((Date.now() - new Date(inv.due_date)) / 86400000));
        lines.push({
          lineType: 'LATE_PAYMENT',
          overdueAmountEur: parseFloat(inv.total_amount_eur),
          overdueDays: daysOverdue,
          sourceInvoiceId: inv.id,
          description: `Late payment on ${inv.invoice_no}: €${inv.total_amount_eur} × ${daysOverdue} days`,
        });
      }

      // 5. Return preview (not saved yet) — caller can POST /billing/with-lines to save
      res.json({
        preview: true,
        shipperId,
        periodFrom,
        periodTo,
        contractsFound: contracts.length,
        overdueInvoices: overdue.length,
        lines,
        instruction: 'Review lines and POST to /billing/with-lines to create invoice',
      });
    } catch (err) { next(err); }
  }
);

// PATCH /billing/:id/status
// Valid transitions per NC business rules
const ALLOWED_TRANSITIONS = {
  DRAFT:     ['ISSUED', 'CANCELLED'],
  ISSUED:    ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE:   ['PAID', 'CANCELLED'],
  PAID:      [],           // terminal
  CANCELLED: [],           // terminal
};

router.patch('/:id/status', authorize('billing:update'), async (req, res, next) => {
  const { status } = req.body;
  const valid = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    // Fetch invoice first — determines current status for transition check
    const { rows: inv } = await db.query(
      `SELECT id, status, total_amount_eur, due_date FROM invoices WHERE id = $1`,
      [req.params.id]
    );
    if (!inv.length) return res.status(404).json({ error: 'Invoice not found' });

    const current = inv[0].status;
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition: ${current} → ${status}`,
      });
    }

    let lateInterest = 0;
    let daysOverdue  = 0;

    // On OVERDUE: calculate interest (NC Art. 20.4.2)
    if (status === 'OVERDUE') {
      const sp = await getSystemParams();
      if (inv[0].due_date) {
        daysOverdue = Math.max(
          0,
          Math.floor((Date.now() - new Date(inv[0].due_date)) / 86400000)
        );
        lateInterest = calcLatePaymentInterest({
          overdueEur:   parseFloat(inv[0].total_amount_eur),
          daysOverdue,
          euribor6mPct: sp.euribor6mPct,
          spreadPct:    sp.latePaymentSpreadPct,
          dayBasis:     sp.latePaymentDayBasis,
        });
      }
    }

    const paidAt     = status === 'PAID' ? ', paid_at = NOW()' : '';
    const interestSql = status === 'OVERDUE'
      ? `, late_payment_days = ${daysOverdue}, late_payment_eur = ${lateInterest}`
      : '';

    const { rows } = await db.query(
      `UPDATE invoices SET status = $1 ${paidAt} ${interestSql} WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /billing/:id/erp-sync
router.post('/:id/erp-sync', authorize('billing:erp_sync'), async (req, res, next) => {
  try {
    const { rows: inv } = await db.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!inv.length) return res.status(404).json({ error: 'Invoice not found' });

    const erpRef = `1C-${inv[0].invoice_no}-${Date.now()}`;
    const { rows } = await db.query(
      `UPDATE invoices SET erp_synced_at = NOW(), erp_ref = $1 WHERE id = $2 RETURNING *`,
      [erpRef, req.params.id]
    );

    await addAudit({
      actionType: 'ERP_SYNC',
      entityType: 'invoice',
      entityId:   inv[0].id,
      userId:     req.user.id,
      username:   req.user.username,
      ipAddress:  req.ip,
      description: `Invoice ${inv[0].invoice_no} synced to ERP, ref: ${erpRef}`,
    });

    res.json({ message: 'ERP sync successful (mock)', erpRef, invoice: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
