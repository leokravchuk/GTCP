'use strict';

/**
 * EDIGAS v5.1 XML Service — Nomination/Renomination messages
 * Specification: ENTSOG EDIGAS v5.1 (urn:edigas:nomint:5:1)
 *
 * Document types:
 *   01G = Nomination (initial)
 *   P03 = Renomination
 *
 * Roles:
 *   ZSH = Shipper (sender)
 *   ZSO = System Operator / TSO (receiver)
 *
 * Direction codes:
 *   Z02 = Entry
 *   Z03 = Exit
 */

const TSO_EIC = '21X-RS-GASTRANS-0';
const TSO_NAME = 'Gastrans d.o.o.';
const SCHEMA_URI = 'urn:edigas:nomint:5:1';

/**
 * Build EDIGAS NOMINT XML (Nomination or Renomination)
 * @param {Object} nom — nomination row from DB
 * @param {Object} shipper — shipper row from DB
 * @returns {string} XML string
 */
function buildNomint(nom, shipper) {
  const isRenom = (nom.gas_day_cycle || 0) > 0;
  const docType = isRenom ? 'P03' : '01G';
  const docLabel = isRenom ? 'RenominationDocument' : 'NominationDocument';
  const directionCode = (nom.direction || '').toUpperCase() === 'ENTRY' ? 'Z02' : 'Z03';
  const directionLabel = directionCode === 'Z02' ? 'Entry' : 'Exit';

  const eicCode = shipper.eic_code || 'UNKNOWN-EIC';
  const shipperCode = shipper.code || 'UNKNOWN';
  const reference = nom.reference || `NOM-${nom.id}`;
  const volumeKwhH = Number(nom.volume_kwh_h) || 0;
  const point = nom.point || 'UNKNOWN-POINT';
  const contractRef = nom.contract_id || 'N/A';

  // Gas Day: 06:00 CET → 06:00 CET next day
  // In UTC: 05:00Z → 05:00Z (winter CET=UTC+1) or 04:00Z → 04:00Z (summer CEST=UTC+2)
  // Gas day: DB stores as DATE, pg returns as local midnight or UTC-shifted
  // Use local date to avoid timezone offset (2026-03-29T21:00Z → local 2026-03-30)
  const gasDayDate = new Date(nom.gas_day);
  const gasDay = nom.gas_day
    ? `${gasDayDate.getFullYear()}-${String(gasDayDate.getMonth()+1).padStart(2,'0')}-${String(gasDayDate.getDate()).padStart(2,'0')}`
    : 'UNKNOWN';
  const month = gasDayDate.getMonth(); // 0-indexed
  const isSummer = month >= 2 && month <= 9; // Mar-Oct = CEST
  const startUTC = isSummer ? '04:00Z' : '05:00Z';
  const endUTC = isSummer ? '04:00Z' : '05:00Z';

  const nextDay = new Date(gasDayDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth()+1).padStart(2,'0')}-${String(nextDay.getDate()).padStart(2,'0')}`;

  const creationTime = new Date().toISOString().replace(/\.\d+Z/, 'Z');
  const cycle = nom.gas_day_cycle || 1;
  const version = cycle;

  return `<?xml version="1.0" encoding="UTF-8"?>
<nomint:${docLabel}
    xmlns:nomint="${SCHEMA_URI}"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="${SCHEMA_URI} edigas-nomint-5-1.xsd">

  <!-- Document Header -->
  <DocumentIdentification>NOMINT-${reference}</DocumentIdentification>
  <DocumentVersion>${version}</DocumentVersion>
  <DocumentType>${docType}</DocumentType>
  <CreationDateTime>${creationTime}</CreationDateTime>

  <!-- Sender (Shipper) -->
  <SenderIdentification codingScheme="305">${eicCode}</SenderIdentification>
  <SenderRole>ZSH</SenderRole>

  <!-- Receiver (TSO Gastrans) -->
  <ReceiverIdentification codingScheme="305">${TSO_EIC}</ReceiverIdentification>
  <ReceiverRole>ZSO</ReceiverRole>

  <!-- Nomination Time Series -->
  <NominationTimeSeries>
    <Identification>TS-${reference}-${cycle}</Identification>
    <ContractReference>${contractRef}</ContractReference>
    <ContractType>CT01</ContractType>

    <!-- Connection Point -->
    <ConnectionPointIdentification codingScheme="305">${point}</ConnectionPointIdentification>
    <Direction>${directionCode}</Direction>
    <DirectionMeaning>${directionLabel}</DirectionMeaning>

    <!-- Shipper -->
    <ShipperIdentification codingScheme="305">${eicCode}</ShipperIdentification>
    <ShipperCode>${shipperCode}</ShipperCode>

    <!-- Measure Unit -->
    <MeasureUnitQuantity>KWH</MeasureUnitQuantity>

    <!-- Gas Day -->
    <GasDay>${gasDay}</GasDay>
    <NominationCycle>${cycle}</NominationCycle>

    <!-- Nomination Period (full Gas Day: 06:00 CET → 06:00 CET) -->
    <NominationPeriod>
      <TimeInterval>${gasDay}T${startUTC}/${nextDayStr}T${endUTC}</TimeInterval>
      <Direction>${directionCode}</Direction>
      <Quantity unit="KWH_H">${volumeKwhH}</Quantity>
      <QuantityMeaning>Hourly rate (kWh/h), equally allocated to all hours of Gas Day (NC Art.12.1)</QuantityMeaning>
    </NominationPeriod>

    <!-- NC Art.12.3: Equal Nominations — Entry must equal Exit per shipper per Gas Day -->
    <EqualNominationsRule>NC Art.12.3</EqualNominationsRule>
  </NominationTimeSeries>

  <!-- Audit -->
  <ProcessType>NOM</ProcessType>
  <NCReference>NC Gastrans Art.12</NCReference>
  <Platform>GTCP (Gas Trading and Commercial Platform)</Platform>
</nomint:${docLabel}>`;
}

/**
 * Build NOMINT XML — alias for Nomination (gas_day_cycle = 0)
 */
function buildNominationXml(nom, shipper) {
  return buildNomint({ ...nom, gas_day_cycle: 0 }, shipper);
}

/**
 * Build RENOMINT XML — alias for Renomination (gas_day_cycle > 0)
 */
function buildRenomint(nom, shipper) {
  return buildNomint({ ...nom, gas_day_cycle: Math.max(1, nom.gas_day_cycle || 1) }, shipper);
}

/**
 * Build NOMRES XML (Confirmation from TSO) — mock
 */
function buildNomres(nom, shipper, confirmedQty) {
  const reference = nom.reference || `NOM-${nom.id}`;
  const eicCode = shipper.eic_code || 'UNKNOWN-EIC';
  const volumeKwhH = confirmedQty || Number(nom.volume_kwh_h) || 0;
  const gasDay = nom.gas_day ? new Date(nom.gas_day).toISOString().slice(0, 10) : 'UNKNOWN';

  return `<?xml version="1.0" encoding="UTF-8"?>
<nomres:ConfirmationDocument xmlns:nomres="urn:edigas:nomres:5:1">
  <DocumentIdentification>NOMRES-${reference}</DocumentIdentification>
  <DocumentType>06G</DocumentType>
  <CreationDateTime>${new Date().toISOString().replace(/\.\d+Z/, 'Z')}</CreationDateTime>
  <SenderIdentification codingScheme="305">${TSO_EIC}</SenderIdentification>
  <SenderRole>ZSO</SenderRole>
  <ReceiverIdentification codingScheme="305">${eicCode}</ReceiverIdentification>
  <ReceiverRole>ZSH</ReceiverRole>
  <ConfirmationTimeSeries>
    <OriginalDocumentIdentification>NOMINT-${reference}</OriginalDocumentIdentification>
    <ConnectionPointIdentification codingScheme="305">${nom.point || ''}</ConnectionPointIdentification>
    <GasDay>${gasDay}</GasDay>
    <ConfirmedQuantity unit="KWH_H">${volumeKwhH}</ConfirmedQuantity>
    <Status>CONFIRMED</Status>
    <NCReference>NC Art.12.6.1 — Confirmed Quantities</NCReference>
  </ConfirmationTimeSeries>
</nomres:ConfirmationDocument>`;
}

/**
 * Submit NOMINT to TSO (mock mode)
 */
async function submitToTso(xml, nominationId) {
  if (process.env.NODE_ENV === 'test' || process.env.RBP_MODE === 'mock') {
    return {
      success: true,
      nomres: { status: 'ACCEPTED', docId: `NOMRES-${nominationId}`, timestamp: new Date().toISOString() },
    };
  }
  throw new Error('RBP.EU real submission not implemented yet');
}

/**
 * Legacy aliases
 */
function generateNominationXml(nomination) {
  return buildNomint(nomination, {});
}
function generateConfirmationXml(nomination) {
  return buildNomres(nomination, {}, Number(nomination.volume_kwh_h));
}

module.exports = {
  buildNomint,
  buildRenomint,
  buildNominationXml,
  buildNomres,
  generateNominationXml,
  generateConfirmationXml,
  submitToTso,
  TSO_EIC,
};
