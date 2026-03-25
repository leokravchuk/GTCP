'use strict';

/**
 * EDIG@S Adapter Service
 *
 * Generates and parses EDIG@S XML messages for gas nominations
 * exchanged with TSO platforms such as RBP.EU (Gastrans Serbia).
 *
 * Supported message types:
 *   NOMINT  - Nomination Interactive (shipper → TSO)
 *   NOMRES  - Nomination Response    (TSO → shipper, parsed here)
 *   CAPINT  - Capacity Interactive   (shipper → TSO)
 *
 * Protocol: EDIG@S v4.1 (XML), transport: HTTPS/SFTP (mocked in development)
 *
 * Reference: EDIGAS-Part2-NominationDocument-Implementation-Guide.pdf
 */

const crypto  = require('crypto');
const logger  = require('../utils/logger');

// ── EIC codes ────────────────────────────────────────────────────────────────
// In production these come from contracts / capacity_bookings tables.
// For MVP they are configured here.
const EIC = {
  // ── Own EIC codes ──────────────────────────────────────────────────────────
  sender:              process.env.EIC_SENDER        || '21X-GTCP-SENDER-A',
  tso:                 process.env.EIC_TSO           || '21X-GASTRANS-SRB-B',  // Gastrans Serbia

  // ── Physical interconnection points (Horgoš/Gospođinci corridor) ──────────
  // Direction A: Hungary → Serbia (transit south)
  pointHorgosEntry:    process.env.EIC_HORGOS_ENTRY  || '21Z-RS-HORGOS-ENTR-Y', // Horgoš ENTRY
  pointGospodjinciExit:process.env.EIC_GOSPO_EXIT    || '21Z-RS-GOSPO-EXIT--Y', // Gospođinci EXIT

  // Direction B: Reverse flow (south → Hungary)
  pointHorgosExit:     process.env.EIC_HORGOS_EXIT   || '21Z-RS-HORGOS-EXIT-Y', // Horgoš EXIT
  pointGospodjinciEntry:process.env.EIC_GOSPO_ENTRY  || '21Z-RS-GOSPO-ENTR-Y', // Gospođinci ENTRY

  // ── VTP Serbia (Virtual Trading Point) ────────────────────────────────────
  // Used for title transfer trades, fuel gas, and balancing gas transactions
  pointVtpSerbia:      process.env.EIC_VTP_SERBIA    || '21Z-RS-VTP-SERBIA-Y',

  // ── Transport ─────────────────────────────────────────────────────────────
  rbpUrl:              process.env.RBP_URL            || 'https://rbp.eu/api/nominations',
};

// ── Point selection helper ────────────────────────────────────────────────────
/**
 * Returns the EIC code for the given point code and direction.
 * Falls back to DB lookup via interconnection_points if code is explicit.
 */
function resolvePointEic(pointCode, direction) {
  const map = {
    'HORGOS-ENTRY':      EIC.pointHorgosEntry,
    'HORGOS-EXIT':       EIC.pointHorgosExit,
    'GOSPODJINCI-EXIT':  EIC.pointGospodjinciExit,
    'GOSPODJINCI-ENTRY': EIC.pointGospodjinciEntry,
    'VTP-SERBIA':        EIC.pointVtpSerbia,
  };
  if (pointCode && map[pointCode]) return map[pointCode];
  // Legacy fallback: derive from direction
  return direction === 'ENTRY' ? EIC.pointHorgosEntry : EIC.pointGospodjinciExit;
}

// ── Gas Day helpers ───────────────────────────────────────────────────────────
/**
 * Gas Day runs 06:00 CET → 06:00 CET next day.
 * Convert gas_day (YYYY-MM-DD) to UTC start/end ISO strings.
 */
function gasDayToUtc(gasDayStr) {
  // 06:00 CET = 05:00 UTC (winter) / 04:00 UTC (summer)
  // For simplicity: use 05:00 UTC (CET, winter time)
  const d = new Date(`${gasDayStr}T05:00:00Z`);
  const start = d.toISOString().replace('.000', '');
  d.setDate(d.getDate() + 1);
  const end = d.toISOString().replace('.000', '');
  return { start, end };
}

/**
 * Split a daily volume (kWh) into 24 equal hourly periods.
 * @param {number} volumeKwh - total day volume
 * @returns {number[]} array of 24 hourly quantities
 */
function toHourlyPeriods(volumeKwh) {
  const hourly = Math.round(volumeKwh / 24);
  const periods = Array(24).fill(hourly);
  // Put remainder in last hour
  const diff = volumeKwh - hourly * 24;
  periods[23] += diff;
  return periods;
}

// ── NOMINT generator ──────────────────────────────────────────────────────────
/**
 * Build EDIG@S NOMINT XML for a single nomination.
 *
 * @param {object} nom - nomination row from DB
 * @param {object} shipper - shipper row (needs eic_code)
 * @returns {string} XML string
 */
function buildNomint(nom, shipper) {
  const docId   = `GTCP-NOM-${nom.id.slice(0, 8).toUpperCase()}`;
  const created = new Date().toISOString().replace('.000', '').replace('Z', 'Z');
  const { start, end } = gasDayToUtc(nom.gas_day);
  const tsId    = `TS-${nom.id.slice(0, 8).toUpperCase()}`;
  const periods = toHourlyPeriods(nom.volume_kwh);

  // Direction: ENTRY → Z02, EXIT → Z03 (EDIG@S codelist)
  const dirCode = nom.direction === 'ENTRY' ? 'Z02' : 'Z03';

  // Interconnection point EIC (use explicit point code if set, else derive from direction)
  const pointEic = resolvePointEic(nom.point, nom.direction);
  const shipperEic = shipper.eic_code || `21X-SHIPPER-${shipper.id.slice(0, 6).toUpperCase()}`;

  // Build hourly Period elements
  const periodXml = periods.map((qty, i) => {
    const pos = String(i + 1).padStart(2, '0');
    return `      <Period>
        <Position v="${pos}"/>
        <Quantity v="${qty}"/>
      </Period>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NominationDocument DtdVersion="4" DtdRelease="1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <!-- Document Header -->
  <DocumentIdentification v="${docId}"/>
  <DocumentVersion v="1"/>
  <DocumentType v="NOMINT"/>
  <ProcessType v="P02"/>
  <!-- P02 = Regular nomination, P03 = Renomination -->

  <!-- Parties (EIC-X codes) -->
  <SenderIdentification codingScheme="A01" v="${EIC.sender}"/>
  <ReceiverIdentification codingScheme="A01" v="${EIC.tso}"/>
  <CreationDateTime v="${created}"/>

  <!-- Gas Day: ${nom.gas_day} (06:00 CET - 06:00 CET) -->
  <GasDay v="${nom.gas_day}"/>

  <!-- Time Series -->
  <TimeSeries>
    <TimeSeriesIdentification v="${tsId}"/>
    <BusinessType v="A04"/>
    <!-- A04 = Nomination -->
    <MeasureUnit v="KWH"/>
    <!-- kWh per hour -->

    <StartDateTime v="${start}"/>
    <EndDateTime v="${end}"/>

    <!-- Shipper -->
    <ShipperIdentification codingScheme="A01" v="${shipperEic}"/>

    <!-- Interconnection point: ${nom.direction === 'ENTRY' ? 'Horgoš' : 'Gospođinci'} -->
    <PointIdentification codingScheme="A01" v="${pointEic}"/>
    <Direction v="${dirCode}"/>
    <!-- ${dirCode === 'Z02' ? 'Z02 = Entry' : 'Z03 = Exit'} -->

    <!-- 24 hourly periods -->
${periodXml}

  </TimeSeries>

</NominationDocument>`;
}

// ── NOMRES parser ─────────────────────────────────────────────────────────────
/**
 * Parse a NOMRES XML response from TSO and extract status.
 *
 * @param {string} xml - raw NOMRES XML from RBP.EU
 * @returns {{ docId, status, matchedVolume, reason }}
 */
function parseNomres(xml) {
  // Minimal regex-based extraction (no full XML parser dependency)
  const get = (tag) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*v="([^"]+)"`));
    return m ? m[1] : null;
  };
  const docId          = get('DocumentIdentification');
  const reasonCode     = get('ReasonCode');    // A01 = Accepted, A02 = Rejected, A06 = Partially accepted
  const matchedVol     = get('Quantity');

  const statusMap = { A01: 'matched', A02: 'rejected', A06: 'partial' };
  return {
    docId,
    status:        statusMap[reasonCode] || 'unknown',
    matchedVolume: matchedVol ? Number(matchedVol) : null,
    reason:        reasonCode,
    raw:           xml,
  };
}

// ── Mock RBP.EU submission ────────────────────────────────────────────────────
/**
 * Submit NOMINT to RBP.EU (or mock TSO endpoint).
 *
 * In production: HTTP POST with Bearer token + XML body.
 * In development (NODE_ENV !== 'production'): returns mock NOMRES.
 *
 * @param {string} nomintXml
 * @param {string} nominationId
 * @returns {Promise<{success, nomres, message}>}
 */
async function submitToTso(nomintXml, nominationId) {
  if (process.env.NODE_ENV !== 'production') {
    // ── Mock response ──
    logger.info(`[EDIGAS] MOCK submit nomination ${nominationId} to RBP.EU`);

    // Simulate 200ms TSO latency
    await new Promise(r => setTimeout(r, 200));

    // Simulate partial acceptance (realistic: TSO matches min of ENTRY/EXIT)
    const mockNomres = `<?xml version="1.0" encoding="UTF-8"?>
<NominationDocument DtdVersion="4" DtdRelease="1">
  <DocumentIdentification v="RBP-NOM-RES-${nominationId.slice(0, 8).toUpperCase()}"/>
  <DocumentVersion v="1"/>
  <DocumentType v="NOMRES"/>
  <ProcessType v="P02"/>
  <SenderIdentification codingScheme="A01" v="${EIC.tso}"/>
  <ReceiverIdentification codingScheme="A01" v="${EIC.sender}"/>
  <CreationDateTime v="${new Date().toISOString().replace('.000', '')}"/>
  <ReasonCode v="A01"/>
  <!-- A01 = Accepted -->
  <Quantity v="0"/>
  <!-- TSO confirms matching in separate NOMRES per time series -->
</NominationDocument>`;

    return {
      success: true,
      nomres:  parseNomres(mockNomres),
      message: '[MOCK] Nomination accepted by RBP.EU (simulated)',
    };
  }

  // ── Production: real HTTP submission ──
  try {
    const https = require('https');
    const body  = Buffer.from(nomintXml, 'utf8');

    return await new Promise((resolve, reject) => {
      const url = new URL(EIC.rbpUrl);
      const opts = {
        hostname: url.hostname,
        port:     url.port || 443,
        path:     url.pathname,
        method:   'POST',
        headers: {
          'Content-Type':   'application/xml; charset=UTF-8',
          'Content-Length': body.length,
          'Authorization':  `Bearer ${process.env.RBP_API_TOKEN || ''}`,
          'X-EDIGAS-Version': '4.1',
        },
      };
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', d => { data += d; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, nomres: parseNomres(data), message: 'Accepted by RBP.EU' });
          } else {
            resolve({ success: false, nomres: null, message: `RBP.EU HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    logger.error(`[EDIGAS] TSO submission failed: ${err.message}`);
    return { success: false, nomres: null, message: err.message };
  }
}

// ── Renomination NOMINT ───────────────────────────────────────────────────────
/**
 * Build NOMINT for a renomination (ProcessType P03).
 * Wraps buildNomint and sets process type to P03.
 */
function buildRenomint(nom, shipper) {
  const xml = buildNomint(nom, shipper);
  return xml.replace('<ProcessType v="P02"/>', '<ProcessType v="P03"/>\n  <!-- P03 = Renomination (CAM NC ±10%) -->');
}

// ── Public API ────────────────────────────────────────────────────────────────
module.exports = {
  buildNomint,
  buildRenomint,
  parseNomres,
  submitToTso,
  gasDayToUtc,
  toHourlyPeriods,
  EIC,
};
