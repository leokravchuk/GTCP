'use strict';

/**
 * Nominations REST API
 * GET    /nominations              — list (filter by gas_day, shipper, status)
 * GET    /nominations/:id          — single
 * POST   /nominations              — create nomination
 * POST   /nominations/match        — run matching algorithm (dispatcher)
 * POST   /nominations/:id/renom    — submit renomination (±10% rule)
 * PATCH  /nominations/:id/status   — update status (dispatcher/admin)
 */

const express    = require('express');
const { body, query: qv, validationResult } = require('express-validator');
const db         = require('../db');
const authenticate  = require('../middleware/authenticate');
const authorize     = require('../middleware/authorize');
const { addAudit }  = require('../services/auditService');

const edigas = require('../services/edigasService');

const router = express.Router();
router.use(authenticate);

// ── helpers ────────────────────────────────────────────────────────────────────

/** Auto-increment reference counter: NOM-YYYY-NNNNN */
async function nextReference(gasDay) {
  const year = new Date(gasDay).getFullYear();
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM nominations
     WHERE EXTRACT(YEAR FROM gas_day) = $1`, [year]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(5, '0');
  return `NOM-${year}-${seq}`;
}

// ── GET / ──────────────────────────────────────────────────────────────────────
router.get('/', authorize('nominations:read'), async (req, res, next) => {
  const { gas_day, shipper_id, status, direction, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params     = [];
  let i = 1;

  if (gas_day)    { conditions.push(`n.gas_day = $${i++}`);    params.push(gas_day); }
  if (shipper_id) { conditions.push(`n.shipper_id = $${i++}`); params.push(shipper_id); }
  if (status)     { conditions.push(`n.status = $${i++}`);     params.push(status); }
  if (direction)  { conditions.push(`n.direction = $${i++}`);  params.push(direction); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT n.*, s.code AS shipper_code, s.name AS shipper_name
       FROM nominations n
       JOIN shippers s ON s.id = n.shipper_id
       ${where}
       ORDER BY n.gas_day DESC, n.submitted_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /:id ───────────────────────────────────────────────────────────────────
router.get('/:id', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT n.*, s.code AS shipper_code, s.name AS shipper_name
       FROM nominations n
       JOIN shippers s ON s.id = n.shipper_id
       WHERE n.id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Nomination not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST / — create ────────────────────────────────────────────────────────────
router.post(
  '/',
  authorize('nominations:create'),
  [
    body('shipperId').isUUID(),
    body('gasDay').isDate(),
    body('direction').isIn(['ENTRY','EXIT']),
    body('point').trim().isLength({ min: 1 }),
    body('volumeMwh').isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, gasDay, direction, point, volumeMwh, notes } = req.body;
    try {
      const reference = await nextReference(gasDay);
      const { rows } = await db.query(
        `INSERT INTO nominations
           (reference, shipper_id, gas_day, direction, point, volume_mwh, submitted_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [reference, shipperId, gasDay, direction, point, volumeMwh, req.user.id, notes || null]
      );
      await addAudit({ actionType: 'NOMINATION_SUBMIT', entityType: 'nomination', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Nomination ${reference} submitted (${direction} ${volumeMwh} MWh)`, newValue: rows[0] });
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ── POST /match — ENTRY/EXIT matching algorithm ────────────────────────────────
router.post('/match', authorize('nominations:match'), async (req, res, next) => {
  const { gasDay } = req.body;
  if (!gasDay) return res.status(400).json({ error: 'gasDay is required' });

  try {
    const results = await db.withTransaction(async (client) => {
      // Fetch all PENDING nominations for the gas day
      const { rows: pending } = await client.query(
        `SELECT * FROM nominations
         WHERE gas_day = $1 AND status = 'PENDING'
         ORDER BY submitted_at`, [gasDay]
      );

      const entries = pending.filter(n => n.direction === 'ENTRY');
      const exits   = pending.filter(n => n.direction === 'EXIT');
      const matched = [];

      // Group by shipper
      const shipperIds = [...new Set(pending.map(n => n.shipper_id))];

      for (const shipperId of shipperIds) {
        const entry = entries.find(n => n.shipper_id === shipperId);
        const exit  = exits.find(n => n.shipper_id === shipperId);
        if (!entry || !exit) continue;

        const matchedVolume = Math.min(Number(entry.volume_mwh), Number(exit.volume_mwh));
        const entryStatus   = matchedVolume === Number(entry.volume_mwh) ? 'MATCHED' : 'PARTIALLY_MATCHED';
        const exitStatus    = matchedVolume === Number(exit.volume_mwh)  ? 'MATCHED' : 'PARTIALLY_MATCHED';

        await client.query(
          `UPDATE nominations SET status = $1, matched_volume = $2 WHERE id = $3`,
          [entryStatus, matchedVolume, entry.id]
        );
        await client.query(
          `UPDATE nominations SET status = $1, matched_volume = $2 WHERE id = $3`,
          [exitStatus, matchedVolume, exit.id]
        );

        matched.push({ shipperId, entryId: entry.id, exitId: exit.id, matchedVolume });
      }

      return matched;
    });

    await addAudit({ actionType: 'NOMINATION_MATCH', entityType: 'nomination',
      userId: req.user.id, username: req.user.username, ipAddress: req.ip,
      description: `Matching run for gas_day ${gasDay}: ${results.length} pairs matched` });

    res.json({ gasDay, matchedPairs: results.length, details: results });
  } catch (err) { next(err); }
});

// ── POST /:id/renom — renomination (±10% rule) ────────────────────────────────
router.post(
  '/:id/renom',
  authorize('nominations:renom'),
  [body('newVolumeMwh').isFloat({ min: 0 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { newVolumeMwh, notes } = req.body;

    try {
      const { rows: orig } = await db.query('SELECT * FROM nominations WHERE id = $1', [req.params.id]);
      if (!orig.length) return res.status(404).json({ error: 'Nomination not found' });

      const original = orig[0];
      const delta    = Math.abs(newVolumeMwh - Number(original.volume_mwh)) / Number(original.volume_mwh);

      // CAM NC: renomination tolerance ±10%
      if (delta > 0.10) {
        return res.status(422).json({
          error: `Renomination volume ${newVolumeMwh} exceeds ±10% tolerance of original ${original.volume_mwh} MWh`,
          delta: (delta * 100).toFixed(2) + '%',
          maxAllowed: (Number(original.volume_mwh) * 1.10).toFixed(3),
          minAllowed: (Number(original.volume_mwh) * 0.90).toFixed(3),
        });
      }

      const reference = `${original.reference}-R${original.gas_day_cycle + 1}`;
      const { rows: renom } = await db.query(
        `INSERT INTO nominations
           (reference, shipper_id, gas_day, direction, point, volume_mwh, submitted_by,
            parent_id, gas_day_cycle, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING') RETURNING *`,
        [reference, original.shipper_id, original.gas_day, original.direction,
         original.point, newVolumeMwh, req.user.id, original.id,
         original.gas_day_cycle + 1, notes || null]
      );

      // Mark original as RENOMINATED
      await db.query(`UPDATE nominations SET status = 'RENOMINATED' WHERE id = $1`, [original.id]);

      await addAudit({ actionType: 'RENOMINATION', entityType: 'nomination', entityId: renom[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Renomination ${reference}: ${original.volume_mwh} → ${newVolumeMwh} MWh (${(delta*100).toFixed(2)}%)`,
        oldValue: { volume: original.volume_mwh }, newValue: { volume: newVolumeMwh } });

      res.status(201).json(renom[0]);
    } catch (err) { next(err); }
  }
);

// ── GET /:id/edigas-nomint — preview NOMINT XML ────────────────────────────────
/**
 * Returns the EDIG@S NOMINT XML that would be sent to RBP.EU for this nomination.
 * Useful for review / audit before actual submission.
 */
router.get('/:id/edigas-nomint', authorize('nominations:read'), async (req, res, next) => {
  try {
    const { rows: noms } = await db.query('SELECT * FROM nominations WHERE id = $1', [req.params.id]);
    if (!noms.length) return res.status(404).json({ error: 'Nomination not found' });

    const nom = noms[0];
    // Enrich with shipper EIC code
    const { rows: shippers } = await db.query('SELECT * FROM shippers WHERE id = $1', [nom.shipper_id]);
    const shipper = shippers[0] || {};

    // Convert MWh → kWh for EDIG@S (1 MWh = 1000 kWh)
    const nomForEdigas = { ...nom, volume_kwh: Number(nom.volume_mwh) * 1000 };

    const isRenom = nom.gas_day_cycle > 0;
    const xml = isRenom
      ? edigas.buildRenomint(nomForEdigas, shipper)
      : edigas.buildNomint(nomForEdigas, shipper);

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Content-Disposition', `inline; filename="NOMINT-${nom.id.slice(0,8)}.xml"`);
    res.send(xml);
  } catch (err) { next(err); }
});

// ── POST /:id/edigas-submit — submit NOMINT to RBP.EU (TSO) ───────────────────
/**
 * Generates NOMINT XML and submits it to the TSO platform (RBP.EU).
 * In development: returns mock NOMRES response.
 * In production: sends real HTTPS request to RBP_URL with Bearer token.
 *
 * Flow:
 *   1. Build NOMINT XML from nomination row
 *   2. POST to RBP.EU (or mock)
 *   3. Parse NOMRES
 *   4. Update nomination tso_status in DB
 *   5. Write audit log
 */
router.post('/:id/edigas-submit', authorize('nominations:create'), async (req, res, next) => {
  try {
    const { rows: noms } = await db.query('SELECT * FROM nominations WHERE id = $1', [req.params.id]);
    if (!noms.length) return res.status(404).json({ error: 'Nomination not found' });

    const nom = noms[0];
    const { rows: shippers } = await db.query('SELECT * FROM shippers WHERE id = $1', [nom.shipper_id]);
    const shipper = shippers[0] || {};

    const nomForEdigas = { ...nom, volume_kwh: Number(nom.volume_mwh) * 1000 };
    const isRenom = nom.gas_day_cycle > 0;
    const nomintXml = isRenom
      ? edigas.buildRenomint(nomForEdigas, shipper)
      : edigas.buildNomint(nomForEdigas, shipper);

    // Submit to TSO
    const result = await edigas.submitToTso(nomintXml, nom.id);

    // Persist TSO response status
    const tsoStatus = result.success ? (result.nomres?.status || 'submitted') : 'error';
    await db.query(
      `UPDATE nominations SET tso_status = $1, tso_response = $2 WHERE id = $3`,
      [tsoStatus, JSON.stringify(result.nomres), nom.id]
    ).catch(() => {}); // column may not exist in MVP schema — non-fatal

    await addAudit({
      actionType:  'EDIGAS_SUBMIT',
      entityType:  'nomination',
      entityId:    nom.id,
      userId:      req.user.id,
      username:    req.user.username,
      ipAddress:   req.ip,
      description: `NOMINT submitted to RBP.EU for ${nom.reference} — TSO status: ${tsoStatus}`,
      newValue:    { tsoStatus, nomresDocId: result.nomres?.docId },
    });

    res.json({
      nominationId:  nom.id,
      reference:     nom.reference,
      tsoStatus,
      edigasDocType: isRenom ? 'NOMINT-P03-RENOM' : 'NOMINT-P02',
      rbpResponse:   result,
      nomintPreview: nomintXml.split('\n').slice(0, 8).join('\n') + '\n  ...',
    });
  } catch (err) { next(err); }
});

module.exports = router;
