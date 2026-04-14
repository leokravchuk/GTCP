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
const {
  matchWithAdjacentTso,
  fetchAdjacentNomination,
  applyLesserRule,
  ADJACENT_TSO_BY_POINT,
} = require('../services/adjacentTsoService');

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

// ── GET /export — CSV export (NC Art.12 nominations register) ─────────────────
const { rowsToCsv, sendCsv } = require('../utils/csvExport');
router.get('/export', authorize('nominations:read'), async (req, res, next) => {
  const { gas_day, shipper_id, status, direction, from, to } = req.query;
  const conds = []; const params = []; let i = 1;
  if (gas_day)    { conds.push(`n.gas_day = $${i++}`);    params.push(gas_day); }
  if (shipper_id) { conds.push(`n.shipper_id = $${i++}`); params.push(shipper_id); }
  if (status)     { conds.push(`n.status = $${i++}`);     params.push(status); }
  if (direction)  { conds.push(`n.direction = $${i++}`);  params.push(direction); }
  if (from)       { conds.push(`n.gas_day >= $${i++}`);   params.push(from); }
  if (to)         { conds.push(`n.gas_day <= $${i++}`);   params.push(to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT n.reference, s.code AS shipper_code, s.name AS shipper_name,
              n.gas_day, n.direction, n.point,
              n.volume_kwh_h, n.contracted_kwh_h,
              n.matched_kwh_h, n.allocated_kwh_h,
              n.is_over_nomination, n.status, n.gas_day_cycle, n.submitted_at
         FROM nominations n JOIN shippers s ON s.id = n.shipper_id
         ${where} ORDER BY n.gas_day DESC, n.submitted_at DESC`,
      params
    );
    const csv = rowsToCsv(rows, [
      { key: 'reference',          header: 'Reference' },
      { key: 'shipper_code',       header: 'Shipper' },
      { key: 'shipper_name',       header: 'Shipper Name' },
      { key: 'gas_day',            header: 'Gas Day' },
      { key: 'direction',          header: 'Direction' },
      { key: 'point',              header: 'Point' },
      { key: 'volume_kwh_h',       header: 'Nominated kWh/h' },
      { key: 'contracted_kwh_h',   header: 'Contracted kWh/h' },
      { key: 'matched_kwh_h',      header: 'Matched kWh/h' },
      { key: 'allocated_kwh_h',    header: 'Allocated kWh/h' },
      { key: 'is_over_nomination', header: 'Over-Nom' },
      { key: 'status',             header: 'Status' },
      { key: 'gas_day_cycle',      header: 'Cycle' },
      { key: 'submitted_at',       header: 'Submitted' },
    ]);
    return sendCsv(res, 'nominations', csv);
  } catch (err) { next(err); }
});

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
    const idParam = req.params.id;
    const isUUID = idParam.length === 36 && idParam.includes('-');
    const { rows } = await db.query(
      `SELECT n.*, s.code AS shipper_code, s.name AS shipper_name
       FROM nominations n
       JOIN shippers s ON s.id = n.shipper_id
       WHERE ${isUUID ? 'n.id' : 'n.reference'} = $1`, [idParam]
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
    body('shipperId').isString().isLength({ min: 1 }),
    body('gasDay').isDate(),
    body('direction').isIn(['ENTRY','EXIT']),
    body('point').trim().isLength({ min: 1 }),
    body('volumeKwhH').isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    let { shipperId, gasDay, direction, point, volumeKwhH, notes } = req.body;

    // Resolve shipper code → UUID if needed (frontend may send "SHP-001" instead of UUID)
    if (shipperId && shipperId.length < 36) {
      try {
        const { rows } = await db.query('SELECT id FROM shippers WHERE code = $1 OR name = $1', [shipperId]);
        if (rows.length) shipperId = rows[0].id;
      } catch {}
    }

    // ── NC Art. 12.6.1.1: Nomination deadline = D-1 before 14:00 CET ──────
    // (NC says 14:00 CET for submission; 13:00 CET in some interpretations
    //  refers to matching start, but we validate against 14:00 CET as per Art. 12.6.1.1)
    const gasDayDate = new Date(gasDay + 'T06:00:00+01:00'); // Gas Day starts 06:00 CET
    const deadlineCET = new Date(gasDayDate);
    deadlineCET.setDate(deadlineCET.getDate() - 1); // D-1
    deadlineCET.setHours(14, 0, 0, 0); // 14:00 CET
    const nowCET = new Date();
    if (nowCET > deadlineCET) {
      // Allow bypass in dev/test mode
      if (process.env.NODE_ENV === 'production') {
        return res.status(422).json({
          error: `Nomination deadline passed: D-1 before 14:00 CET (${deadlineCET.toISOString()})`,
          ncRef: 'NC Art. 12.6.1.1',
          gasDay, deadline: deadlineCET.toISOString(), now: nowCET.toISOString(),
        });
      }
      // Dev mode: log warning but allow
      console.warn(`[NC Art.12.6] Nomination deadline passed for ${gasDay}, allowing in dev mode`);
    }

    try {
      const nominatedKwhH = Number(volumeKwhH);
      let contractedKwhH = 0;
      let isOverNom = false;
      let overNomInterruptible = 0;

      // ── NC Art.13.2.1: Nomination ≤ Contracted Capacity ────────────────
      // Lookup contracted capacity from capacity_bookings + contracts
      try {
        const { rows: bk } = await db.query(
          `SELECT COALESCE(SUM(capacity_kwh_h), 0) AS contracted_kwh_h
           FROM capacity_bookings
           WHERE shipper_id = $1 AND point = $2 AND direction = $3
             AND status = 'ACTIVE'
             AND period_from <= $4 AND period_to >= $4`,
          [shipperId, point, direction, gasDay]
        );
        contractedKwhH = parseFloat(bk[0]?.contracted_kwh_h || 0);

        // Also check contracts table (cap_entry/cap_exit)
        if (contractedKwhH === 0) {
          const entryOrExit = direction === 'ENTRY' ? 'cap_entry_kwh_h' : 'cap_exit_kwh_h';
          const { rows: cRows } = await db.query(
            `SELECT COALESCE(MAX(${entryOrExit}), 0) AS cap
             FROM contracts
             WHERE shipper_id = $1 AND status = 'ACTIVE'
               AND start_date <= $2 AND end_date >= $2`,
            [shipperId, gasDay]
          );
          contractedKwhH = parseFloat(cRows[0]?.cap || 0);
        }
      } catch(e) {
        // capacity_bookings may not exist in test — skip check
        console.warn(`[NC Art.13.2] Capacity check skipped: ${e.message}`);
      }

      // Validate nomination against contracted capacity
      if (contractedKwhH > 0 && nominatedKwhH > contractedKwhH) {
        // ── NC Art.12.8: Over-Nomination eligibility ─────────────────────
        // Allowed when ALL Firm Capacity fully contracted at IP
        // AND total nominations < Total Contracted (spare capacity exists)
        try {
          const { rows: totalCap } = await db.query(
            `SELECT COALESCE(SUM(capacity_kwh_h), 0) AS total
             FROM capacity_bookings WHERE point = $1 AND direction = $2
               AND status = 'ACTIVE' AND period_from <= $3 AND period_to >= $3`,
            [point, direction, gasDay]
          );
          const totalContracted = parseFloat(totalCap[0]?.total || 0);

          const { rows: totalNoms } = await db.query(
            `SELECT COALESCE(SUM(volume_kwh_h), 0) AS total
             FROM nominations WHERE point = $1 AND direction = $2
               AND gas_day = $3 AND status NOT IN ('REJECTED','CANCELLED')`,
            [point, direction, gasDay]
          );
          const totalNominated = parseFloat(totalNoms[0]?.total || 0);

          if (totalContracted > 0 && totalNominated < totalContracted) {
            // Over-Nomination allowed — excess = Within-Day Interruptible
            isOverNom = true;
            overNomInterruptible = nominatedKwhH - contractedKwhH;
            console.log(`[NC Art.12.8] Over-Nomination allowed: ${nominatedKwhH} > ${contractedKwhH}, excess ${overNomInterruptible} kWh/h = Interruptible`);
          } else {
            return res.status(422).json({
              error: `Nomination ${nominatedKwhH} kWh/h exceeds Contracted Capacity ${contractedKwhH} kWh/h at ${point}`,
              ncRef: 'NC Art.13.2.1 — Nomination must not exceed Contracted Capacity',
              contracted: contractedKwhH,
              nominated: nominatedKwhH,
              excess: nominatedKwhH - contractedKwhH,
              overNomEligible: false,
              reason: totalNominated >= totalContracted
                ? 'Total nominations already equal Total Contracted — no spare capacity for Over-Nomination'
                : 'Contracted capacity is zero',
            });
          }
        } catch(e) {
          // If can't check — reject to be safe (production mode)
          if (process.env.NODE_ENV === 'production') {
            return res.status(422).json({
              error: `Nomination exceeds Contracted Capacity and Over-Nomination check failed`,
              ncRef: 'NC Art.13.2.1',
              contracted: contractedKwhH, nominated: nominatedKwhH,
            });
          }
        }
      }

      // ── INSERT nomination ──────────────────────────────────────────────
      const reference = await nextReference(gasDay);
      const { rows } = await db.query(
        `INSERT INTO nominations
           (reference, shipper_id, gas_day, direction, point, volume_kwh_h,
            contracted_kwh_h, is_over_nomination, over_nom_interruptible_kwh_h,
            submitted_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [reference, shipperId, gasDay, direction, point, volumeKwhH,
         contractedKwhH || null, isOverNom, overNomInterruptible,
         req.user.id, notes || null]
      );
      await addAudit({ actionType: 'NOMINATION_SUBMIT', entityType: 'nomination', entityId: rows[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Nomination ${reference} (${direction} ${volumeKwhH} kWh/h at ${point})${isOverNom ? ' [OVER-NOM: excess '+overNomInterruptible+' kWh/h]' : ''}${contractedKwhH > 0 ? ' [CC: '+contractedKwhH+']' : ''}`,
        newValue: rows[0] });
      // ── NC Art.12.3: Equal Nominations check (warning, not reject) ─────
      // Entry = Σ Exit + VTP trades (for this shipper on this gas day)
      let balanceWarning = null;
      try {
        const { rows: allNoms } = await db.query(
          `SELECT direction, COALESCE(SUM(volume_kwh_h), 0) AS total
           FROM nominations
           WHERE shipper_id = $1 AND gas_day = $2 AND status NOT IN ('REJECTED','CANCELLED')
           GROUP BY direction`,
          [shipperId, gasDay]
        );
        const entryTotal = parseFloat(allNoms.find(n => n.direction === 'ENTRY')?.total || 0);
        const exitTotal  = parseFloat(allNoms.find(n => n.direction === 'EXIT')?.total || 0);
        const diff = entryTotal - exitTotal;

        if (Math.abs(diff) > 0 && entryTotal > 0 && exitTotal > 0) {
          balanceWarning = {
            ncRef: 'NC Art.12.3 — Equal Nominations Rule',
            message: `Entry (${entryTotal} kWh/h) ≠ Exit (${exitTotal} kWh/h), diff = ${diff > 0 ? '+' : ''}${diff} kWh/h`,
            entryTotal, exitTotal, diff,
            hint: diff > 0
              ? `Excess Entry ${diff} kWh/h needs EXIT-SERBIA nomination or VTP trade`
              : `Excess Exit ${Math.abs(diff)} kWh/h — Entry nomination missing`,
          };
        }
      } catch(e) { /* non-critical */ }

      res.status(201).json({
        ...rows[0],
        _capacityCheck: {
          contracted: contractedKwhH,
          nominated: nominatedKwhH,
          utilizationPct: contractedKwhH > 0 ? (nominatedKwhH / contractedKwhH * 100).toFixed(1) : null,
          isOverNomination: isOverNom,
          overNomInterruptible,
        },
        _balanceWarning: balanceWarning,
      });
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

        const matchedVolume = Math.min(Number(entry.volume_kwh_h), Number(exit.volume_kwh_h));
        const entryStatus   = matchedVolume === Number(entry.volume_kwh_h) ? 'MATCHED' : 'PARTIALLY_MATCHED';
        const exitStatus    = matchedVolume === Number(exit.volume_kwh_h)  ? 'MATCHED' : 'PARTIALLY_MATCHED';

        // NC Art.12.3: allocated_kwh_h = matched = nominated (shippers always balanced)
        await client.query(
          `UPDATE nominations SET status = $1, matched_kwh_h = $2, allocated_kwh_h = $2 WHERE id = $3`,
          [entryStatus, matchedVolume, entry.id]
        );
        await client.query(
          `UPDATE nominations SET status = $1, matched_kwh_h = $2, allocated_kwh_h = $2 WHERE id = $3`,
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

// ── POST /:id/match-adjacent — NC Art.13 Lesser Rule with adjacent TSO ────────
router.post('/:id/match-adjacent', authorize('nominations:match'), async (req, res, next) => {
  const { id } = req.params;
  const { scenario, factor, notes } = req.body || {};

  try {
    const { rows } = await db.query(
      `SELECT * FROM nominations WHERE id = $1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Nomination not found' });
    const nom = rows[0];

    if (!ADJACENT_TSO_BY_POINT[nom.point]) {
      return res.status(400).json({
        error: `No adjacent TSO configured for point ${nom.point}`,
      });
    }

    const result = await matchWithAdjacentTso({ db }, nom, { scenario, factor, notes });

    await addAudit({
      actionType: 'NOMINATION_MATCH_ADJACENT',
      entityType: 'nomination',
      userId:   req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      description: `Adjacent TSO match for ${nom.reference} at ${nom.point}: ` +
                   `our=${result.match.our_side_kwh_h} their=${result.match.their_side_kwh_h} ` +
                   `matched=${result.match.matched_kwh_h} (${result.match.lesser_side})`,
    });

    res.status(201).json({
      match: result.match,
      nominationStatus: result.newNominationStatus,
      ncRef: 'NC Art.13 Lesser Rule',
    });
  } catch (err) { next(err); }
});

// ── GET /:id/matching-result — US-1704 Double-Sided Matching Result ───────────
router.get('/:id/matching-result', authorize('nominations:read'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows: nomRows } = await db.query(
      `SELECT n.*, s.code AS shipper_code, s.name AS shipper_name
         FROM nominations n JOIN shippers s ON s.id = n.shipper_id
        WHERE n.id = $1`, [id]
    );
    if (!nomRows.length) return res.status(404).json({ error: 'Nomination not found' });
    const nom = nomRows[0];

    const { rows: adjMatches } = await db.query(
      `SELECT * FROM adjacent_tso_matches
        WHERE nomination_id = $1
        ORDER BY matched_at DESC`, [id]
    );

    res.json({
      nomination: {
        id: nom.id,
        reference: nom.reference,
        shipperCode: nom.shipper_code,
        shipperName: nom.shipper_name,
        gasDay: nom.gas_day,
        point: nom.point,
        direction: nom.direction,
        nominatedKwhH: Number(nom.volume_kwh_h),
        matchedKwhH:   Number(nom.matched_kwh_h || 0),
        allocatedKwhH: Number(nom.allocated_kwh_h || 0),
        status: nom.status,
      },
      adjacentMatches: adjMatches,
      summary: {
        hasAdjacentMatch: adjMatches.length > 0,
        lastLesserSide:   adjMatches[0]?.lesser_side || null,
        adjacentTso:      adjMatches[0]?.adjacent_tso || null,
      },
      ncRef: 'NC Art.13 Double-Sided Matching',
    });
  } catch (err) { next(err); }
});

// ── POST /:id/renom — renomination (±10% rule) ────────────────────────────────
router.post(
  '/:id/renom',
  authorize('nominations:renom'),
  [body('newVolumeKwhH').isFloat({ min: 0 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { newVolumeKwhH, notes } = req.body;

    try {
      const { rows: orig } = await db.query('SELECT * FROM nominations WHERE id = $1', [req.params.id]);
      if (!orig.length) return res.status(404).json({ error: 'Nomination not found' });

      const original = orig[0];
      const nominated = Number(original.volume_kwh_h);
      const newVol = Number(newVolumeKwhH);
      const contracted = Number(original.contracted_kwh_h) || 0;

      // ── NC Art.12.7.5: Renomination Limitation ───────────────────────
      // Only applies if shipper contracted ≥ 10% of Technical Capacity in prev GY
      // and product is not Daily/Within-Day/Interruptible (Art.12.7.6)
      let maxUp = contracted; // default: can go up to Contracted Capacity
      let minDown = 0;
      let renomRule = '';

      if (contracted > 0) {
        const pctNom = nominated / contracted; // % of CC that was nominated

        if (newVol > nominated) {
          // ── UPWARD renomination ──
          if (pctNom <= 0.80) {
            // Art.12.7.5.1: Nom 0–80% CC → upward Firm to 90% CC, +10% Interruptible
            maxUp = contracted * 0.90;
            renomRule = 'Art.12.7.5.1: Nom≤80%→ up to 90% Firm + 10% Interruptible';
          } else {
            // Art.12.7.5.2: Nom 80–100% CC → upward to half of non-nominated
            const nonNom = contracted - nominated;
            maxUp = nominated + nonNom / 2; // Firm; other half = Interruptible
            renomRule = 'Art.12.7.5.2: Nom>80%→ up to half of non-nominated Firm';
          }
        } else {
          // ── DOWNWARD renomination ──
          if (pctNom > 0.20) {
            // Art.12.7.5.3: Nom 20–100% CC → min 10% CC
            minDown = contracted * 0.10;
            renomRule = 'Art.12.7.5.3: Nom>20%→ min 10% CC';
          } else {
            // Art.12.7.5.4: Nom ≤20% CC → min half of Nominated
            minDown = nominated / 2;
            renomRule = 'Art.12.7.5.4: Nom≤20%→ min half of Nominated';
          }
        }

        // Validate
        if (newVol > maxUp && newVol > nominated) {
          return res.status(422).json({
            error: `Renomination ${newVol} kWh/h exceeds upward limit ${maxUp.toFixed(0)} kWh/h`,
            ncRef: renomRule,
            contracted, nominated, newVolume: newVol, maxUpward: Math.round(maxUp),
          });
        }
        if (newVol < minDown && newVol < nominated) {
          return res.status(422).json({
            error: `Renomination ${newVol} kWh/h below downward limit ${minDown.toFixed(0)} kWh/h`,
            ncRef: renomRule,
            contracted, nominated, newVolume: newVol, minDownward: Math.round(minDown),
          });
        }
      }

      const reference = `${original.reference}-R${original.gas_day_cycle + 1}`;
      const { rows: renom } = await db.query(
        `INSERT INTO nominations
           (reference, shipper_id, gas_day, direction, point, volume_kwh_h, submitted_by,
            parent_id, gas_day_cycle, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING') RETURNING *`,
        [reference, original.shipper_id, original.gas_day, original.direction,
         original.point, newVolumeKwhH, req.user.id, original.id,
         original.gas_day_cycle + 1, notes || null]
      );

      // Mark original as RENOMINATED
      await db.query(`UPDATE nominations SET status = 'RENOMINATED' WHERE id = $1`, [original.id]);

      await addAudit({ actionType: 'RENOMINATION', entityType: 'nomination', entityId: renom[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Renomination ${reference}: ${original.volume_kwh_h} → ${newVolumeKwhH} kWh/h (${renomRule || 'NC Art.12.7'})`,
        oldValue: { volume: original.volume_kwh_h }, newValue: { volume: newVolumeKwhH } });

      res.status(201).json(renom[0]);
    } catch (err) { next(err); }
  }
);

// ── POST /over-nominate — Within-Day Interruptible via Over-Nomination (NC Art. 12.8)
/**
 * NC Art. 12.8: If Firm Capacity is fully contracted at the relevant IP for a Gas Day
 * and Nominations < Total Contracted Capacity, the User may submit an Over-Nomination
 * exceeding its Contracted Capacity. This creates Within-Day Interruptible Capacity.
 *
 * Preconditions:
 * 1. Firm Capacity fully contracted at the IP
 * 2. Total nominations at IP < Total Contracted Capacity
 * 3. Confirmed within 2 hours after renomination cycle
 */
router.post(
  '/over-nominate',
  authorize('nominations:create'),
  [
    body('shipperId').isString().isLength({ min: 1 }),
    body('point').trim().isLength({ min: 1 }),
    body('direction').isIn(['ENTRY', 'EXIT']),
    body('volumeKwhH').isFloat({ min: 1 }),
    body('gasDay').isDate(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { shipperId, point, direction, volumeKwhH, gasDay } = req.body;

    try {
      // 1. Check shipper's contracted capacity at this point
      const { rows: bookings } = await db.query(
        `SELECT COALESCE(SUM(capacity_kwh_h), 0) AS contracted
         FROM capacity_bookings
         WHERE point = $1 AND direction = $2 AND status = 'ACTIVE'
           AND period_from <= $3 AND period_to >= $3`,
        [point, direction, gasDay]
      );
      const totalContracted = parseFloat(bookings[0]?.contracted || 0);

      if (totalContracted <= 0) {
        return res.status(422).json({
          error: 'Over-Nomination rejected: no Firm Capacity contracted at this IP',
          ncRef: 'NC Art. 12.8',
          point, direction,
        });
      }

      // 2. Check total nominations at this point for this gas day
      const { rows: noms } = await db.query(
        `SELECT COALESCE(SUM(volume_kwh_h), 0) AS nominated
         FROM nominations
         WHERE point = $1 AND direction = $2 AND gas_day = $3
           AND status IN ('PENDING', 'MATCHED', 'CONFIRMED')`,
        [point, direction, gasDay]
      );
      const totalNominated = parseFloat(noms[0]?.nominated || 0);

      if (totalNominated >= totalContracted) {
        return res.status(422).json({
          error: 'Over-Nomination rejected: total nominations already meet or exceed contracted capacity',
          ncRef: 'NC Art. 12.8 — requires nominations < Total Contracted Capacity',
          totalContracted, totalNominated,
        });
      }

      // 3. Get shipper's own contracted capacity
      const { rows: myBookings } = await db.query(
        `SELECT COALESCE(SUM(capacity_kwh_h), 0) AS my_contracted
         FROM capacity_bookings
         WHERE shipper_id = $1 AND point = $2 AND direction = $3 AND status = 'ACTIVE'
           AND period_from <= $4 AND period_to >= $4`,
        [shipperId, point, direction, gasDay]
      );
      const myContracted = parseFloat(myBookings[0]?.my_contracted || 0);

      // 4. Create the over-nomination (exceeds own contracted capacity)
      const reference = `OVNOM-${gasDay.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
      const { rows: created } = await db.query(
        `INSERT INTO nominations
           (reference, shipper_id, gas_day, direction, point, volume_kwh_h,
            submitted_by, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8) RETURNING *`,
        [reference, shipperId, gasDay, direction, point, volumeKwhH, req.user.id,
         `Over-Nomination NC Art.12.8: ${volumeKwhH} kWh/h (contracted: ${myContracted})`]
      );

      await addAudit({
        actionType: 'OVER_NOMINATION', entityType: 'nomination', entityId: created[0].id,
        userId: req.user.id, username: req.user.username, ipAddress: req.ip,
        description: `Over-Nomination at ${point} ${direction}: ${volumeKwhH} kWh/h (own contracted: ${myContracted}, total at IP: ${totalNominated}/${totalContracted})`,
      });

      res.status(201).json({
        ...created[0],
        overNomination: true,
        ncRef: 'NC Art. 12.8',
        ownContracted: myContracted,
        excessKwhH: Math.max(0, volumeKwhH - myContracted),
        totalContractedAtIp: totalContracted,
        totalNominatedAtIp: totalNominated,
        confirmationDeadline: '2 hours after renomination cycle end',
      });
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
    // Support both UUID and reference (NOM-2026-00001)
    const idParam = req.params.id;
    const isUUID = idParam.length === 36 && idParam.includes('-');
    const { rows: noms } = await db.query(
      isUUID ? 'SELECT * FROM nominations WHERE id = $1' : 'SELECT * FROM nominations WHERE reference = $1',
      [idParam]
    );
    if (!noms.length) return res.status(404).json({ error: 'Nomination not found' });

    const nom = noms[0];
    const { rows: shipperRows } = await db.query('SELECT * FROM shippers WHERE id = $1', [nom.shipper_id]);
    const shipper = shipperRows[0] || {};

    const xml = edigas.buildNomint(nom, shipper);

    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Content-Disposition', `inline; filename="NOMINT-${(nom.id || '').slice(0,8)}.xml"`);
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

    const nomForEdigas = { ...nom, volume_kwh: Number(nom.volume_kwh_h) * 1000 };
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

// ── PATCH /:id/status — update nomination status (confirm/reject) ────────────
router.patch('/:id/status', authorize('nominations:update'), async (req, res, next) => {
  const { status } = req.body;
  const valid = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'MATCHED', 'PARTIALLY_MATCHED', 'RENOMINATED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }

  try {
    // Support both UUID and reference
    const idParam = req.params.id;
    const isUUID = idParam.length === 36 && idParam.includes('-');
    const whereCol = isUUID ? 'id' : 'reference';

    const { rows: current } = await db.query(`SELECT * FROM nominations WHERE ${whereCol} = $1`, [idParam]);
    if (!current.length) return res.status(404).json({ error: 'Nomination not found' });

    const { rows } = await db.query(
      `UPDATE nominations SET status = $1 WHERE ${whereCol} = $2 RETURNING *`,
      [status, idParam]
    );

    await addAudit({
      actionType: 'NOMINATION_STATUS', entityType: 'nomination', entityId: rows[0].id,
      userId: req.user.id, username: req.user.username, ipAddress: req.ip,
      description: `Nomination ${current[0].reference}: ${current[0].status} -> ${status}`,
    });

    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
