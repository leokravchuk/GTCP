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
    // Tariffs EUR/(kWh/h)/year
    tariffEntryEurKwhHYr:        p['tariff_entry_gospodjinci_eur_kwh_h_yr'] ?? 4.19,
    tariffExitHorgosEurKwhHYr:   p['tariff_exit_horgos_eur_kwh_h_yr']       ?? 6.85,
    tariffCommRevEurKwhHYr:      p['tariff_commercial_reverse_eur_kwh_h_yr']?? 3.25,
    tariffBundledEurKwhHYr:      p['tariff_bundled_annual_eur_kwh_h_yr']    ?? 11.04,
    tariffDailyEntryEurKwhH:     p['tariff_daily_entry_eur_kwh_h']          ?? 0.0230,
    tariffDailyExitEurKwhH:      p['tariff_daily_exit_horgos_eur_kwh_h']    ?? 0.0375,
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
 * @param {string} [opts.flowDirection]    — GOSPODJINCI_HORGOS | HORGOS_GOSPODJINCI | KIREVO_EXIT_SERBIA
 * @param {number} [opts.tariffCommRevEurKwhHYr] — commercial reverse tariff
 * @returns {{ entryFeeEur: number, exitFeeEur: number, totalFeeEur: number }}
 */
function calcCapacityFee({
  capEntryKwhH,
  capExitKwhH,
  tariffEntryEurKwhHYr,
  tariffExitEurKwhHYr,
  billingDays,
  flowDirection = 'GOSPODJINCI_HORGOS',
  tariffCommRevEurKwhHYr = 3.25,
  // Legacy backward-compat: single capacity + bundled tariff
  capacityKwhH = 0,
  tariffBundledEurKwhHYr = 11.04,
}) {
  const days = Math.max(1, billingDays || 1);

  // ── Commercial Reverse: single tariff on exit capacity ───────────────────
  if (flowDirection === 'HORGOS_GOSPODJINCI') {
    const cap = capExitKwhH || capEntryKwhH || capacityKwhH || 0;
    const fee = parseFloat((cap * tariffCommRevEurKwhHYr / 365 * days).toFixed(4));
    return { entryFeeEur: 0, exitFeeEur: fee, totalFeeEur: fee };
  }

  // ── Firm transit or domestic: separate entry + exit ───────────────────────
  const entry = capEntryKwhH || capacityKwhH || 0;
  const exit  = capExitKwhH  || capacityKwhH || 0;

  // If only legacy single capacity given with bundled tariff → back-compat split
  if (!capEntryKwhH && !capExitKwhH && capacityKwhH > 0) {
    const totalFee = parseFloat((capacityKwhH * tariffBundledEurKwhHYr / 365 * days).toFixed(4));
    const entryFee = parseFloat((totalFee * tariffEntryEurKwhHYr / tariffBundledEurKwhHYr).toFixed(4));
    const exitFee  = parseFloat((totalFee - entryFee).toFixed(4));
    return { entryFeeEur: entryFee, exitFeeEur: exitFee, totalFeeEur: totalFee };
  }

  const entryFeeEur = parseFloat((entry * tariffEntryEurKwhHYr / 365 * days).toFixed(4));
  const exitFeeEur  = parseFloat((exit  * tariffExitEurKwhHYr  / 365 * days).toFixed(4));
  const totalFeeEur = parseFloat((entryFeeEur + exitFeeEur).toFixed(2));

  return { entryFeeEur, exitFeeEur, totalFeeEur };
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
  const fuelGasMwh  = parseFloat((fuelGasKwh / 1000).toFixed(4));
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
    res.json(rows);
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
    res.json(rows[0]);
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

      // ── Due date: NC Art. 20.4.1 — payment by 20th of delivery month + 1 ─
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

// PATCH /billing/:id/status
router.patch('/:id/status', authorize('billing:update'), async (req, res, next) => {
  const { status } = req.body;
  const valid = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    const sp = await getSystemParams();
    let lateInterest = 0;
    let daysOverdue  = 0;

    // On OVERDUE: calculate interest (NC Art. 20.4.2)
    if (status === 'OVERDUE') {
      const { rows: inv } = await db.query(
        `SELECT total_amount_eur, due_date FROM invoices WHERE id = $1`, [req.params.id]
      );
      if (inv.length && inv[0].due_date) {
        daysOverdue = Math.max(
          0,
          Math.floor((Date.now() - new Date(inv[0].due_date)) / 86400000)
        );
        lateInterest = calcLatePaymentInterest({
          overdueEur:         parseFloat(inv[0].total_amount_eur),
          daysOverdue,
          euribor6mPct:       sp.euribor6mPct,
          spreadPct:          sp.latePaymentSpreadPct,
          dayBasis:           sp.latePaymentDayBasis,
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
