'use strict';

const express   = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db        = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

// GET /shippers
router.get('/', authorize('shippers:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, code, name, country, eic_code, credit_limit, current_exposure, is_active, status, gta_type,
              sp_rating, moodys_rating, creditreform_score, rating_exempt, created_at
       FROM shippers ORDER BY code`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /shippers/:id
router.get('/:id', authorize('shippers:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM shippers WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /shippers
router.post(
  '/',
  authorize('shippers:create'),
  [
    body('code').trim().isLength({ min: 1, max: 20 }),
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('creditLimit').isNumeric(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { code, name, country, eicCode, creditLimit } = req.body;
    try {
      const { rows } = await db.query(
        `INSERT INTO shippers (code, name, country, eic_code, credit_limit)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [code, name, country || null, eicCode || null, creditLimit]
      );
      await addAudit({ actionType: 'CREATE', entityType: 'shipper', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Shipper ${code} created`, newValue: rows[0] });
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// PATCH /shippers/:id
router.patch('/:id', authorize('shippers:update'), async (req, res, next) => {
  const allowed = ['name','country','eic_code','credit_limit','is_active'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) { updates.push(`${k} = $${i++}`); values.push(v); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE shippers SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Shipper not found' });
    await addAudit({ actionType: 'UPDATE', entityType: 'shipper', entityId: rows[0].id,
      userId: req.user.id, username: req.user.username, ipAddress: req.ip,
      description: `Shipper ${rows[0].code} updated`, newValue: rows[0] });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NC Art.3 — Shipper Registration Lifecycle (Sprint 10)
// APPLICANT → APPROVED → ACTIVE → SUSPENDED → REMOVED
// ═══════════════════════════════════════════════════════════════════════════

// Allowed status transitions (NC Art.3)
const STATUS_TRANSITIONS = {
  APPLICANT: ['APPROVED', 'REMOVED'],          // Art.3.3.7: reject → REMOVED
  APPROVED:  ['ACTIVE', 'REMOVED'],            // Art.3.3.9: execute GTA → ACTIVE
  ACTIVE:    ['SUSPENDED', 'REMOVED'],         // Art.7.5.4: suspend; Art.3.7: remove
  SUSPENDED: ['ACTIVE', 'REMOVED'],            // reinstate or remove
  REMOVED:   [],                                // terminal
};

// POST /shippers/apply — NC Art.3.3: submit Request for Access
router.post(
  '/apply',
  authorize('shippers:create'),
  [
    body('name').trim().isLength({ min: 1, max: 255 }),
    body('country_of_incorporation').optional().isString(),
    body('company_id').optional().isString(),
    body('tax_id').optional().isString(),
    body('address').optional().isString(),
    body('representative_name').optional().isString(),
    body('representative_email').optional().isEmail(),
    body('credit_limit').optional().isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const {
      name, country_of_incorporation, company_id, tax_id, address,
      representative_name, representative_email, representative_phone,
      representative_position, license_no, credit_limit,
      statement_transit, statement_ship_or_pay, statement_insolvency,
    } = req.body;

    try {
      // Generate shipper code
      const { rows: cnt } = await db.query('SELECT COUNT(*) AS c FROM shippers');
      const code = `SHP-${String(Number(cnt[0].c) + 1).padStart(3, '0')}`;

      const { rows } = await db.query(
        `INSERT INTO shippers (
           code, name, status, gta_type, country, country_of_incorporation,
           company_id, tax_id, address, license_no, credit_limit,
           representative_name, representative_email, representative_phone, representative_position,
           statement_transit, statement_ship_or_pay, statement_insolvency
         ) VALUES ($1,$2,'APPLICANT','SHORT_TERM',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [code, name, country_of_incorporation, country_of_incorporation, company_id, tax_id,
         address, license_no, credit_limit || 0,
         representative_name, representative_email, representative_phone, representative_position,
         statement_transit || false, statement_ship_or_pay || false, statement_insolvency || false]
      );

      await addAudit({ actionType: 'SHIPPER_APPLY', entityType: 'shipper', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Shipper ${code} "${name}" applied (NC Art.3.3)` });

      res.status(201).json({ ...rows[0], ncRef: 'NC Art.3.3 — Request for Access to the System' });
    } catch (err) { next(err); }
  }
);

// PATCH /shippers/:id/status — NC Art.3 lifecycle transition
router.patch(
  '/:id/status',
  authorize('shippers:update'),
  [body('status').isIn(['APPLICANT', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REMOVED'])],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { status, reason } = req.body;

    try {
      const { rows: current } = await db.query('SELECT * FROM shippers WHERE id = $1', [req.params.id]);
      if (!current.length) return res.status(404).json({ error: 'Shipper not found' });

      const shipper = current[0];
      const allowed = STATUS_TRANSITIONS[shipper.status] || [];

      if (!allowed.includes(status)) {
        return res.status(422).json({
          error: `Invalid transition: ${shipper.status} → ${status}`,
          allowed,
          ncRef: 'NC Art.3 — Shipper lifecycle',
        });
      }

      // NC Art.3.7: Removal checks — contracted capacity = 0 + outstanding debt = 0
      if (status === 'REMOVED') {
        const { rows: caps } = await db.query(
          `SELECT COALESCE(SUM(capacity_mwh_d), 0) AS total_cap
           FROM capacity_bookings WHERE shipper_id = $1 AND status = 'ACTIVE'`,
          [req.params.id]
        );
        if (parseFloat(caps[0]?.total_cap || 0) > 0) {
          return res.status(422).json({
            error: 'Cannot remove: shipper has active contracted capacity',
            ncRef: 'NC Art.3.7.1 — no Contracted Capacity',
            contractedCapacity: caps[0].total_cap,
          });
        }

        const { rows: debt } = await db.query(
          `SELECT COALESCE(SUM(total_amount_eur), 0) AS total_debt
           FROM invoices WHERE shipper_id = $1 AND status IN ('ISSUED', 'OVERDUE')`,
          [req.params.id]
        );
        if (parseFloat(debt[0]?.total_debt || 0) > 0) {
          return res.status(422).json({
            error: 'Cannot remove: shipper has outstanding debt',
            ncRef: 'NC Art.3.7.1 — no outstanding debt',
            outstandingDebt: debt[0].total_debt,
          });
        }
      }

      // Update status
      const updateFields = [`status = '${status}'`];
      if (status === 'ACTIVE' && !shipper.gta_executed_at) {
        updateFields.push(`gta_executed_at = NOW()`);
      }
      if (status === 'REMOVED') {
        updateFields.push(`removed_at = NOW()`);
        updateFields.push(`removal_reason = '${(reason || '').replace(/'/g, "''")}'`);
        updateFields.push(`is_active = false`);
      }

      const { rows } = await db.query(
        `UPDATE shippers SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
        [req.params.id]
      );

      // Record change in shipper_changes (A-176: audit trail)
      await db.query(
        `INSERT INTO shipper_changes (shipper_id, changed_by, field_name, old_value, new_value, reason)
         VALUES ($1, $2, 'status', $3, $4, $5)`,
        [req.params.id, req.user.id, shipper.status, status, reason || null]
      );

      await addAudit({ actionType: 'SHIPPER_STATUS', entityType: 'shipper', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Shipper ${shipper.code} status: ${shipper.status} → ${status}${reason ? ` (${reason})` : ''}` });

      res.json({ ...rows[0], transition: `${shipper.status} → ${status}`, ncRef: 'NC Art.3' });
    } catch (err) { next(err); }
  }
);

// GET /shippers/:id/history — NC Art.3.5: shipper change audit trail
router.get('/:id/history', authorize('shippers:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT sc.*, u.username AS changed_by_name
       FROM shipper_changes sc
       LEFT JOIN users u ON u.id = sc.changed_by
       WHERE sc.shipper_id = $1
       ORDER BY sc.changed_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
