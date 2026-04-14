#!/usr/bin/env node
'use strict';

/**
 * Fix Fuel Gas line items on invoices where shipper's route is NOT eligible
 * for FG charges (NC Art.18.3 + Art.19.1.4).
 *
 * Sprint 17 · US-1711 (FG-06/FG-07) · 15.04.2026
 *
 * Eligibility (CLAUDE.md "Fuel Gas Allocation Rules"):
 *   FG fee > 0 ⟺ contract.flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA}
 *             AND shipper.fuel_gas_election = 'CASH'
 *
 * For every invoice violating this rule:
 *   1. Set invoice_line_items.amount_eur = 0 WHERE line_type = 'FUEL_GAS'.
 *   2. Recalculate invoices.total_amount_eur as SUM of remaining line items.
 *   3. Zero invoices.fuel_gas_amount_eur / fuel_gas_kwh / fuel_gas_volume_nm3.
 *
 * Usage:
 *   node scripts/fix-fuel-gas-invoices.js            # dry-run (default)
 *   node scripts/fix-fuel-gas-invoices.js --apply    # commit changes
 *   node scripts/fix-fuel-gas-invoices.js --report   # write FG_DATA_FIX_REPORT.md
 */

const path = require('path');
const fs   = require('fs');
const db   = require('../src/db');

const APPLY  = process.argv.includes('--apply');
const REPORT = process.argv.includes('--report');

const FG_APPLICABLE_DIRECTIONS = ['KIREVO_HORGOS', 'KIREVO_HORGOS_AND_SERBIA'];

async function findAffectedInvoices() {
  // Shipper-level eligibility: at least one ACTIVE contract on a transit route
  // means the shipper can legitimately be charged FG on its aggregate invoice.
  // Invoice-level flow_direction is unreliable (often null).
  const { rows } = await db.query(`
    SELECT
      i.id,
      i.invoice_no,
      i.shipper_id,
      s.code              AS shipper_code,
      s.name              AS shipper_name,
      COALESCE(s.fuel_gas_election, 'CASH') AS election,
      i.flow_direction    AS invoice_direction,
      i.fuel_gas_amount_eur,
      i.total_amount_eur,
      EXISTS (
        SELECT 1 FROM contracts cc
         WHERE cc.shipper_id = i.shipper_id
           AND cc.status = 'ACTIVE'
           AND cc.flow_direction = ANY($1::text[])
      ) AS has_transit_contract,
      (SELECT string_agg(DISTINCT flow_direction, ', ')
         FROM contracts WHERE shipper_id = i.shipper_id AND status = 'ACTIVE'
      ) AS all_directions,
      (SELECT COALESCE(SUM(amount_eur), 0)
         FROM invoice_line_items
        WHERE invoice_id = i.id AND line_type = 'FUEL_GAS')           AS fg_line_total,
      (SELECT COALESCE(SUM(amount_eur), 0)
         FROM invoice_line_items
        WHERE invoice_id = i.id AND line_type <> 'FUEL_GAS')          AS non_fg_total
    FROM invoices i
    JOIN shippers s ON s.id = i.shipper_id
    ORDER BY i.invoice_no
  `, [FG_APPLICABLE_DIRECTIONS]);

  return rows.filter(r => {
    const noTransit   = !r.has_transit_contract;
    const inKind      = r.election === 'IN_KIND';
    const hasFgCharge = Number(r.fg_line_total) > 0
                     || Number(r.fuel_gas_amount_eur) > 0;
    return (noTransit || inKind) && hasFgCharge;
  });
}

async function fixInvoice(inv) {
  const newTotal = parseFloat(Number(inv.non_fg_total).toFixed(2));
  if (!APPLY) return { invoice_no: inv.invoice_no, plannedTotal: newTotal };

  await db.query('BEGIN');
  try {
    await db.query(
      `UPDATE invoice_line_items SET amount_eur = 0
        WHERE invoice_id = $1 AND line_type = 'FUEL_GAS'`,
      [inv.id]
    );
    await db.query(
      `UPDATE invoices
          SET fuel_gas_amount_eur = 0,
              fuel_gas_kwh        = 0,
              fuel_gas_volume_nm3 = 0,
              fuel_gas_volume_mwh = 0,
              total_amount_eur    = $1
        WHERE id = $2`,
      [newTotal, inv.id]
    );
    await db.query('COMMIT');
    return { invoice_no: inv.invoice_no, newTotal };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

function formatEur(n) {
  return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function writeReport(affected, results) {
  const outPath = path.join(__dirname, '..', '..', 'reports', 'FG_DATA_FIX_REPORT.md');
  const totalCorrectionEur = affected.reduce((s, r) => s + Number(r.fg_line_total || 0), 0);
  const lines = [
    '# Fuel Gas Data Fix Report',
    '',
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    `**Mode:** ${APPLY ? 'APPLIED' : 'DRY-RUN'}`,
    `**Sprint:** 17 · US-1711 (FG-06/FG-07)`,
    '',
    `## Summary`,
    '',
    `- Affected invoices: **${affected.length}**`,
    `- Total FG correction: **${formatEur(totalCorrectionEur)} EUR**`,
    '',
    `## Invoices`,
    '',
    '| Invoice | Shipper | Contracts (flow_directions) | Election | FG was (EUR) | New total (EUR) |',
    '|---|---|---|---|---|---|',
    ...affected.map(r => {
      const dirs = r.all_directions || r.invoice_direction || '—';
      return `| ${r.invoice_no} | ${r.shipper_code} ${r.shipper_name} | ${dirs} | ${r.election} | ${formatEur(r.fg_line_total)} | ${formatEur(r.non_fg_total)} |`;
    }),
    '',
    `*Rule: FG > 0 ⟺ flow_direction ∈ {KIREVO_HORGOS, KIREVO_HORGOS_AND_SERBIA} AND election = 'CASH' (NC Art.18.3 + Art.19.1.4).*`,
    '',
  ];
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\nReport written → ${outPath}`);
}

(async () => {
  console.log(`[fix-fuel-gas-invoices] Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const affected = await findAffectedInvoices();
  if (!affected.length) {
    console.log('No invoices to fix. All FG charges comply with NC Art.18.');
    if (REPORT) await writeReport([], []);
    process.exit(0);
  }

  console.log(`\nFound ${affected.length} invoice(s) to fix:\n`);
  for (const r of affected) {
    const dirs = r.all_directions || r.invoice_direction || '—';
    console.log(
      `  ${r.invoice_no} | ${r.shipper_code} | contracts=[${dirs}] | election=${r.election}` +
      ` | FG was=${formatEur(r.fg_line_total)} EUR | new_total=${formatEur(r.non_fg_total)} EUR`
    );
  }

  const results = [];
  for (const inv of affected) {
    try {
      const res = await fixInvoice(inv);
      results.push(res);
    } catch (err) {
      console.error(`Failed to fix ${inv.invoice_no}:`, err.message);
    }
  }

  if (REPORT) await writeReport(affected, results);

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to commit changes.');
  } else {
    console.log(`\nApplied ${results.length}/${affected.length} fixes.`);
  }
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
