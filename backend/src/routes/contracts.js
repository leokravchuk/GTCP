'use strict';

/**
 * Contracts REST API — CAM NC / Gastrans Network Code
 *
 * Contract types (GTA = Gas Transportation Agreement):
 *   TSA_FIRM_ANNUAL        — Firm annual (primary product, auctioned via RBP.EU)
 *   TSA_FIRM_QUARTERLY     — Firm quarterly
 *   TSA_FIRM_MONTHLY       — Firm monthly
 *   TSA_FIRM_DAILY         — Firm daily / day-ahead
 *   TSA_FIRM_WITHIN_DAY    — Firm within-day
 *   TSA_INTERRUPTIBLE      — Interruptible
 *   TSA_COMMERCIAL_REVERSE — Commercial reverse flow (interruptible, Horgoš ENTRY → Kirevo EXIT)
 *
 * Flow directions (migration 005 — NC-correct):
 *   GOSPODJINCI_HORGOS  — Firm transit: Entry Kirevo → Exit Horgoš (TurkStream → Hungary)
 *   HORGOS_GOSPODJINCI  — Commercial Reverse: Entry Horgoš → Exit Kirevo (virtual, interruptible)
 *   KIREVO_EXIT_SERBIA  — Domestic delivery: Entry Kirevo → Exit Serbia (GMS-2/3/4, integrated IP)
 *
 * Interconnection points (NC Art. 6.3.1):
 *   KIREVO-ENTRY   — Physical entry from Bulgaria, GMS-1 Kirevo/Zaječar
 *   EXIT-SERBIA    — Integrated domestic exit: GMS-2 Paraćin + GMS-3 Pančevo + GMS-4 Gospođinci
 *   HORGOS-EXIT    — Transit exit to Hungary, GMS Kiskundorozsma 2 (Horgoš IP 1200)
 *   HORGOS-ENTRY   — Commercial reverse entry (from Hungary)
 *
 * Capacity billing (migration 005 — CORRECTED):
 *   fee = cap_entry_kwh_h × tariff_entry / 365 × days
 *       + cap_exit_kwh_h  × tariff_exit  / 365 × days
 *   Entry (Kirevo): 4.19 EUR/(kWh/h)/year  [AERS Decision 05-145]
 *   Exit (Horgoš):  6.85 EUR/(kWh/h)/year  [AERS Decision 05-145]
 *   Exit (Serbia):  4.19 EUR/(kWh/h)/year  [same as domestic exit tariff]
 *   Comm. Reverse:  3.25 EUR/(kWh/h)/year  [exit-side only]
 */

const express    = require('express');
const { body, validationResult } = require('express-validator');
const db         = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const { addAudit }  = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// ── Contract type metadata (for UI / validation) ──────────────────────────────
const CONTRACT_TYPES = {
  TSA_FIRM_ANNUAL:        { label: 'Firm Annual (GTA)',        capacity: 'FIRM',          booking: 'ANNUAL'    },
  TSA_FIRM_QUARTERLY:     { label: 'Firm Quarterly',           capacity: 'FIRM',          booking: 'QUARTERLY' },
  TSA_FIRM_MONTHLY:       { label: 'Firm Monthly',             capacity: 'FIRM',          booking: 'MONTHLY'   },
  TSA_FIRM_DAILY:         { label: 'Firm Daily',               capacity: 'FIRM',          booking: 'DAILY'     },
  TSA_FIRM_WITHIN_DAY:    { label: 'Firm Within-Day',          capacity: 'FIRM',          booking: 'WITHIN_DAY'},
  TSA_INTERRUPTIBLE:      { label: 'Interruptible',            capacity: 'INTERRUPTIBLE', booking: 'ANNUAL'    },
  TSA_COMMERCIAL_REVERSE: { label: 'Commercial Reverse Flow',  capacity: 'INTERRUPTIBLE', booking: 'ANNUAL'    },
};

// ── Flow directions (migration 005 — NC Art. 6.3 corrected) ──────────────────
// Key: flow_direction column value stored in contracts table
const FLOW_DIRECTIONS = {
  GOSPODJINCI_HORGOS: {
    label:           'Firm Transit: Kirevo ENTRY → Horgoš EXIT',
    entryPoint:      'KIREVO-ENTRY',
    exitPoint:       'HORGOS-EXIT',
    tariffEntry:     4.19,   // EUR/(kWh/h)/year [AERS 05-145]
    tariffExit:      6.85,   // EUR/(kWh/h)/year [AERS 05-145]
    description:
      'Main physical flow direction: Entry Bulgaria (GMS-1 Kirevo/Zaječar) → Exit Hungary ' +
      '(GMS Kiskundorozsma 2, IP Horgoš 1200). Cap reserved: Entry 13,752,230 / Exit 9,216,209 kWh/h. ' +
      'Bundled annual tariff: 11.04 EUR/(kWh/h)/year.',
    shipOrPay:       true,
    bundlable:       true,
  },
  HORGOS_GOSPODJINCI: {
    label:           'Commercial Reverse: Horgoš ENTRY → Kirevo EXIT',
    entryPoint:      'HORGOS-ENTRY',
    exitPoint:       'KIREVO-ENTRY',  // NC: virtual exit back to Bulgarian border
    tariffEntry:     0,
    tariffExit:      3.25,            // EUR/(kWh/h)/year [AERS 05-145, exit-side only]
    description:
      'VIRTUAL commercial reverse flow (NC Art. 7.3). Gas does not physically reverse. ' +
      'Offered at: Entry Horgoš + Entry Serbia / Exit Kirevo. ' +
      'Volume ≤ contracted Physical Flow Direction capacity. Interruptible by definition.',
    shipOrPay:       true,   // NC ship-or-pay applies to reverse too
    bundlable:       false,  // CAM NC: reverse not bundled
    interruptible:   true,
  },
  KIREVO_EXIT_SERBIA: {
    label:           'Domestic Delivery: Kirevo ENTRY → Exit Serbia',
    entryPoint:      'KIREVO-ENTRY',
    exitPoint:       'EXIT-SERBIA',
    tariffEntry:     6.00,   // EUR/(kWh/h)/year [AERS 05-145, Kirevo entry]
    tariffExit:      4.19,   // EUR/(kWh/h)/year [AERS 05-145, domestic exit zone]
    description:
      'Domestic gas delivery: Entry Bulgaria (GMS-1 Kirevo) → Exit Serbia integrated point ' +
      '(GMS-2 Paraćin + GMS-3 Pančevo + GMS-4 Gospođinci). ' +
      'NC Art. 6.3.1: Exit Serbia treated as ONE integrated IP for billing. ' +
      'Reserved domestic capacity: 4,536,021 kWh/h (= Entry 13.75M − Horgoš 9.22M).',
    shipOrPay:       true,
    bundlable:       true,
  },
};

// ── GET /meta — return enums for UI ───────────────────────────────────────────
router.get('/meta', authorize('contracts:read'), (_req, res) => {
  res.json({ contractTypes: CONTRACT_TYPES, flowDirections: FLOW_DIRECTIONS });
});

// ── GET / ────────────────────────────────────────────────────────────────────
router.get('/', authorize('contracts:read'), async (req, res, next) => {
  const { status, shipper_id, flow_direction, contract_type } = req.query;
  const conds = []; const params = []; let i = 1;
  if (status)         { conds.push(`c.status = $${i++}`);          params.push(status); }
  if (shipper_id)     { conds.push(`c.shipper_id = $${i++}`);      params.push(shipper_id); }
  if (flow_direction) { conds.push(`c.flow_direction = $${i++}`);  params.push(flow_direction); }
  if (contract_type)  { conds.push(`c.contract_type = $${i++}`);   params.push(contract_type); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  try {
    const { rows } = await db.query(
      `SELECT c.*, s.code AS shipper_code, s.name AS shipper_name
       FROM contracts c JOIN shippers s ON s.id = c.shipper_id
       ${where} ORDER BY c.start_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get('/:id', authorize('contracts:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, s.code AS shipper_code, s.name AS shipper_name,
              ep.name AS entry_point_name, ep.eic_code AS entry_eic,
              xp.name AS exit_point_name,  xp.eic_code AS exit_eic
       FROM contracts c
       JOIN shippers s ON s.id = c.shipper_id
       LEFT JOIN interconnection_points ep ON ep.code = c.entry_point_code
       LEFT JOIN interconnection_points xp ON xp.code = c.exit_point_code
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Contract not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST / — create GTA ───────────────────────────────────────────────────────
router.post(
  '/',
  authorize('contracts:create'),
  [
    body('shipperId').isUUID(),
    body('contractType').isIn(Object.keys(CONTRACT_TYPES)),
    body('flowDirection').isIn(Object.keys(FLOW_DIRECTIONS)),
    body('startDate').isDate(),
    body('endDate').isDate(),
    body('capacityKwhDay').optional().isFloat({ min: 0 }),
    // Preferred: separate entry/exit capacity (migration 005)
    body('capEntryKwhH').optional().isFloat({ min: 0 })
      .withMessage('capEntryKwhH: entry capacity kWh/h (e.g. 13752230)'),
    body('capExitKwhH').optional().isFloat({ min: 0 })
      .withMessage('capExitKwhH: exit capacity kWh/h (e.g. 9216209 for Horgoš)'),
    // Tariff per kWh/h/year (AERS 05-145 units)
    body('tariffEntryEurKwhHYr').optional().isFloat({ min: 0 }),
    body('tariffExitEurKwhHYr').optional().isFloat({ min: 0 }),
    // Legacy kWh/day tariff fields kept for backward compat
    body('tariffEntryEurKwhDay').optional().isFloat({ min: 0 }),
    body('tariffExitEurKwhDay').optional().isFloat({ min: 0 }),
    body('maxDailyMwh').optional().isFloat({ min: 0 }),
    body('tariffEurMwh').optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const {
      shipperId, contractType, flowDirection,
      startDate, endDate,
      capacityKwhDay,
      // Preferred: separate entry/exit capacity (migration 005)
      capEntryKwhH, capExitKwhH,
      tariffEntryEurKwhHYr, tariffExitEurKwhHYr,
      // Legacy
      tariffEntryEurKwhDay, tariffExitEurKwhDay,
      maxDailyMwh, tariffEurMwh,
      notes, signedDate, auctionRef, gtaNumber,
    } = req.body;

    const dir  = FLOW_DIRECTIONS[flowDirection];
    const meta = CONTRACT_TYPES[contractType];

    // Resolve tariffs: prefer explicit kWh/h/year, fallback to dir defaults, then legacy
    const resolvedTariffEntryYr = tariffEntryEurKwhHYr
      ? Number(tariffEntryEurKwhHYr)
      : dir.tariffEntry;
    const resolvedTariffExitYr  = tariffExitEurKwhHYr
      ? Number(tariffExitEurKwhHYr)
      : dir.tariffExit;

    // Resolve capacity: prefer separate entry/exit; fallback to single kWh/day ÷ 24
    const resolvedCapEntryKwhH = capEntryKwhH
      ? Number(capEntryKwhH)
      : (capacityKwhDay ? Number(capacityKwhDay) / 24 : null);
    const resolvedCapExitKwhH  = capExitKwhH
      ? Number(capExitKwhH)
      : (capacityKwhDay ? Number(capacityKwhDay) / 24 * 0.67 : null);  // 9.22/13.75 ratio

    const resolvedCapKwhDay = capacityKwhDay
      ? Number(capacityKwhDay)
      : (resolvedCapEntryKwhH ? resolvedCapEntryKwhH * 24 : 0);

    // Legacy daily tariff for backward compat columns
    const legacyTariffEntryDay = tariffEntryEurKwhDay || (resolvedTariffEntryYr / 365);
    const legacyTariffExitDay  = tariffExitEurKwhDay  || (resolvedTariffExitYr  / 365);
    const legacyMwh    = maxDailyMwh  || (resolvedCapKwhDay / 1000);
    const legacyTariff = tariffEurMwh || ((legacyTariffEntryDay + legacyTariffExitDay) * 1000);

    // Bundled: firm transit and domestic are bundleable; comm.reverse is not
    const isBundled = dir.bundlable !== false;

    // Auto-generate contract number: GTA-YYYY-NNN
    const year = new Date(startDate).getFullYear();
    const { rows: cnt } = await db.query(
      `SELECT COUNT(*) AS c FROM contracts WHERE EXTRACT(YEAR FROM start_date) = $1`, [year]
    );
    const contractNo = gtaNumber || `GTA-${year}-${String(Number(cnt[0].c) + 1).padStart(3, '0')}`;

    try {
      const { rows } = await db.query(
        `INSERT INTO contracts (
           contract_no, shipper_id,
           contract_type, capacity_type, flow_direction, booking_period, is_bundled,
           entry_point_code, exit_point_code,
           capacity_kwh_day, tariff_entry_eur_kwh_day, tariff_exit_eur_kwh_day,
           capacity_kwh_h, tariff_entry_eur_kwh_h, tariff_exit_eur_kwh_h,
           cap_entry_kwh_h, cap_exit_kwh_h,
           billing_model,
           max_daily_mwh, tariff_eur_mwh,
           start_date, end_date,
           notes, signed_date, auction_ref, gta_number, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
         RETURNING *`,
        [
          contractNo, shipperId,
          contractType, meta.capacity, flowDirection, meta.booking, isBundled,
          dir.entryPoint, dir.exitPoint,
          resolvedCapKwhDay, legacyTariffEntryDay, legacyTariffExitDay,
          resolvedCapEntryKwhH, resolvedTariffEntryYr, resolvedTariffExitYr,
          resolvedCapEntryKwhH, resolvedCapExitKwhH,
          'CAPACITY',
          legacyMwh, legacyTariff,
          startDate, endDate,
          notes || null, signedDate || null,
          auctionRef || null, contractNo, req.user.id,
        ]
      );

      await addAudit({
        actionType: 'CREATE', entityType: 'contract', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description:
          `GTA ${contractNo} | ${contractType} | ${dir.label} | ` +
          `Entry: ${resolvedCapEntryKwhH ? resolvedCapEntryKwhH.toFixed(0) : '—'} kWh/h ×€${resolvedTariffEntryYr}/yr | ` +
          `Exit:  ${resolvedCapExitKwhH  ? resolvedCapExitKwhH.toFixed(0)  : '—'} kWh/h ×€${resolvedTariffExitYr}/yr`,
        newValue: rows[0],
      });

      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── PATCH /:id ────────────────────────────────────────────────────────────────
router.patch('/:id', authorize('contracts:update'), async (req, res, next) => {
  const allowed = [
    'status', 'max_daily_mwh', 'tariff_eur_mwh', 'notes', 'end_date',
    'capacity_kwh_day', 'tariff_entry_eur_kwh_day', 'tariff_exit_eur_kwh_day',
    'cap_entry_kwh_h', 'cap_exit_kwh_h',
    'tariff_entry_eur_kwh_h', 'tariff_exit_eur_kwh_h',
    'auction_ref', 'gta_number', 'billing_model',
  ];
  const updates = []; const values = []; let i = 1;
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE contracts SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Contract not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
