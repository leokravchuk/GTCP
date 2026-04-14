'use strict';

/**
 * Adjacent TSO matching service (NC Art.13).
 * Sprint 17 · US-1703 · 15.04.2026
 *
 * Gastrans exchanges nominations at each IP with the adjacent TSO:
 *   KIREVO-ENTRY ↔ Bulgartransgaz (Bulgaria)
 *   HORGOS-EXIT  ↔ FGSZ (Hungary)
 *   EXIT-SERBIA  ↔ TRANSPORTGAS SRBIJA (domestic)
 *
 * Matching rule (NC Art.13 Lesser Rule):
 *   matched = min(our_nomination, their_nomination)
 *   lesser_side = OURS if our < their, THEIRS if their < our, EQUAL otherwise.
 *
 * Active TSO logic (Art.13.1): at each IP Gastrans acts as either Active
 * or Passive. In this mock we treat Gastrans as Active on all three IPs.
 */

// ── Mapping IP → adjacent TSO ────────────────────────────────────────────────
const ADJACENT_TSO_BY_POINT = {
  'KIREVO-ENTRY':  'Bulgartransgaz',
  'HORGOS-EXIT':   'FGSZ',
  'EXIT-SERBIA':   'TRANSPORTGAS SRBIJA',
  // Commercial Reverse (virtual) points share the same adjacent TSOs:
  'HORGOS-ENTRY':       'FGSZ',
  'EXIT-SERBIA-ENTRY':  'TRANSPORTGAS SRBIJA',
  'KIREVO-EXIT':        'Bulgartransgaz',
};

/**
 * Compute adjacent TSO nomination for a given IP + gas_day.
 *
 * In production this would be a SOAP/EDIG@S call to the adjacent TSO.
 * For Sprint 17 we deterministically derive a plausible quantity from the
 * caller's nomination to exercise both "their < ours", "ours < theirs",
 * and "equal" branches in testing.
 *
 * @param {string} ipCode       — e.g. 'HORGOS-EXIT'
 * @param {string} gasDay       — ISO date
 * @param {number} ourKwhH      — our nomination kWh/h
 * @param {Object} [opts]
 * @param {number} [opts.scenario] — 'less' | 'more' | 'equal' | number factor
 * @returns {Promise<{adjacentTso: string, theirKwhH: number, mocked: true}>}
 */
async function fetchAdjacentNomination(ipCode, gasDay, ourKwhH, opts = {}) {
  const adjacentTso = ADJACENT_TSO_BY_POINT[ipCode];
  if (!adjacentTso) {
    throw new Error(`No adjacent TSO configured for IP ${ipCode}`);
  }
  let factor;
  switch (opts.scenario) {
    case 'less':  factor = 0.95; break;
    case 'more':  factor = 1.05; break;
    case 'equal': factor = 1.00; break;
    default:      factor = typeof opts.factor === 'number' ? opts.factor : 1.00;
  }
  const theirKwhH = parseFloat((Number(ourKwhH || 0) * factor).toFixed(2));
  return { adjacentTso, theirKwhH, mocked: true };
}

/**
 * Apply Lesser Rule to a pair of nominations.
 * @param {number} ourKwhH
 * @param {number} theirKwhH
 * @returns {{ matchedKwhH: number, lesserSide: 'OURS'|'THEIRS'|'EQUAL' }}
 */
function applyLesserRule(ourKwhH, theirKwhH) {
  const a = Number(ourKwhH || 0);
  const b = Number(theirKwhH || 0);
  const matchedKwhH = parseFloat(Math.min(a, b).toFixed(2));
  let lesserSide;
  if (a < b)        lesserSide = 'OURS';
  else if (b < a)   lesserSide = 'THEIRS';
  else              lesserSide = 'EQUAL';
  return { matchedKwhH, lesserSide };
}

/**
 * Run full adjacent-TSO match for a single nomination:
 *  1. Fetch adjacent TSO's side (mock).
 *  2. Apply Lesser Rule.
 *  3. Persist to adjacent_tso_matches + update nomination.status.
 *
 * @param {Object} deps
 * @param {Object} deps.db              — db module with query()
 * @param {Object} nomination           — {id, point, gas_day, volume_kwh_h}
 * @param {Object} [opts]               — passed to fetchAdjacentNomination
 * @returns {Promise<Object>} persisted match row + status decision
 */
async function matchWithAdjacentTso({ db }, nomination, opts = {}) {
  const ipCode = nomination.point;
  const ourKwhH = Number(nomination.volume_kwh_h || nomination.volumeKwhH || 0);
  const { adjacentTso, theirKwhH } = await fetchAdjacentNomination(
    ipCode, nomination.gas_day, ourKwhH, opts
  );
  const { matchedKwhH, lesserSide } = applyLesserRule(ourKwhH, theirKwhH);

  // Reject if either side is zero (no flow agreed).
  const matchStatus = matchedKwhH > 0 ? 'MATCHED' : 'REJECTED';

  const { rows } = await db.query(
    `INSERT INTO adjacent_tso_matches
       (nomination_id, adjacent_tso, ip_code, our_side_kwh_h, their_side_kwh_h,
        matched_kwh_h, lesser_side, match_status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      nomination.id, adjacentTso, ipCode, ourKwhH, theirKwhH,
      matchedKwhH, lesserSide, matchStatus,
      opts.notes || `Mocked adjacent match (Art.13 Lesser Rule)`,
    ]
  );

  // Update nomination status and allocated_kwh_h (Art.12.3 enforcement)
  const newNomStatus = matchStatus === 'MATCHED' ? 'MATCHED_ADJACENT' : 'REJECTED';
  await db.query(
    `UPDATE nominations
        SET status = $1,
            matched_kwh_h = $2,
            allocated_kwh_h = $2
      WHERE id = $3`,
    [newNomStatus, matchedKwhH, nomination.id]
  );

  return { match: rows[0], newNominationStatus: newNomStatus };
}

module.exports = {
  ADJACENT_TSO_BY_POINT,
  fetchAdjacentNomination,
  applyLesserRule,
  matchWithAdjacentTso,
};
