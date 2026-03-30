'use strict';

/**
 * Edigas XML message service (stub).
 * Will generate Edigas-compliant nomination/confirmation XML when integrated with FGSZ/Bulgartransgaz.
 */

async function generateNominationXml(nomination) {
  return `<?xml version="1.0"?><edigasNomination ref="${nomination.reference}" />`;
}

async function generateConfirmationXml(nomination) {
  return `<?xml version="1.0"?><edigasConfirmation ref="${nomination.reference}" status="${nomination.status}" />`;
}

function buildNomint(nomination, shipper) {
  const eic = shipper.eic_code || 'UNKNOWN';
  return `<?xml version="1.0" encoding="UTF-8"?>
<nomint:NominationDocument xmlns:nomint="urn:edigas:nomint:5:0">
  <MessageIdentification>${nomination.reference || 'NOM'}</MessageIdentification>
  <ShipperCode codingScheme="305">${eic}</ShipperCode>
  <Quantity unit="KWH">${nomination.volume_kwh || 0}</Quantity>
</nomint:NominationDocument>`;
}

function buildRenomint(nomination, shipper) {
  const eic = shipper.eic_code || 'UNKNOWN';
  return `<?xml version="1.0" encoding="UTF-8"?>
<nomint:RenominationDocument xmlns:nomint="urn:edigas:nomint:5:0">
  <MessageIdentification>${nomination.reference || 'RENOM'}</MessageIdentification>
  <ShipperCode codingScheme="305">${eic}</ShipperCode>
  <Quantity unit="KWH">${nomination.volume_kwh || 0}</Quantity>
</nomint:RenominationDocument>`;
}

async function submitToTso(xml, nominationId) {
  // Mock mode: simulate TSO acceptance
  if (process.env.NODE_ENV === 'test' || process.env.RBP_MODE === 'mock') {
    return {
      success: true,
      nomres: { status: 'ACCEPTED', docId: `NOMRES-${nominationId}`, timestamp: new Date().toISOString() },
    };
  }
  // Production: POST to RBP.EU endpoint
  throw new Error('RBP.EU real submission not implemented yet');
}

module.exports = { generateNominationXml, generateConfirmationXml, buildNomint, buildRenomint, submitToTso };
