'use strict';

/**
 * Seed runner — inserts test/demo data.
 * Usage: node src/db/seed-runner.js
 *
 * Handles __HASH_*__ placeholders by generating real argon2id hashes.
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

let argon2;
try { argon2 = require('argon2'); } catch { argon2 = null; }

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'gtcp',
  user:     process.env.DB_USER     || 'gtcp_user',
  password: process.env.DB_PASSWORD || '',
});

const PASSWORDS = {
  '__HASH_admin__':     'admin123',
  '__HASH_disp__':      'disp123',
  '__HASH_credit__':    'credit123',
  '__HASH_billing__':   'billing123',
  '__HASH_contracts__': 'contracts123',
};

async function run() {
  let sql = fs.readFileSync(path.join(__dirname, 'seeds', 'seed.sql'), 'utf-8');

  // Replace password placeholders with real hashes
  if (argon2) {
    for (const [placeholder, password] of Object.entries(PASSWORDS)) {
      const hash = await argon2.hash(password);
      sql = sql.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), hash);
    }
    console.log('Password hashes generated with argon2.');
  } else {
    // Fallback: use bcrypt-style placeholder for CI (won't pass login tests but allows schema tests)
    for (const [placeholder] of Object.entries(PASSWORDS)) {
      sql = sql.replaceAll(placeholder, '$2a$10$placeholder_hash_for_ci_testing_only');
    }
    console.warn('argon2 not available — using placeholder hashes.');
  }

  try {
    await pool.query(sql);
    console.log('Seed data inserted.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    // Non-fatal — ON CONFLICT DO NOTHING handles duplicates
  }

  // Insert system_params defaults
  const params = [
    ['tariff_entry_gospodjinci_eur_kwh_h_yr', '6.00'],
    ['tariff_exit_horgos_eur_kwh_h_yr', '6.85'],
    ['tariff_commercial_reverse_eur_kwh_h_yr', '3.25'],
    ['tariff_bundled_annual_eur_kwh_h_yr', '12.85'],
    ['tariff_daily_entry_eur_kwh_h', '0.0329'],
    ['tariff_daily_exit_horgos_eur_kwh_h', '0.0375'],
    ['fuel_gas_x1_compressor_pct', '0.42'],
    ['fuel_gas_x2_preheating_pct', '0.08'],
    ['fuel_gas_kn_quality_kwh', '0'],
    ['fuel_gas_rate_pct', '0.50'],
    ['fuel_gas_price_eur_mwh', '32.50'],
    ['gcv_horgos_kwh_nm3', '11.523'],
    ['balancing_gas_rate_eur_mwh', '5.00'],
    ['euribor_6m_pct', '2.64'],
    ['late_payment_spread_pct', '3.0'],
    ['late_payment_day_basis', '360'],
  ];

  for (const [key, value] of params) {
    await pool.query(
      `INSERT INTO system_params (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  console.log('System params seeded.');

  await pool.end();
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
