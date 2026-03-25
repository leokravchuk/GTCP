'use strict';

/**
 * Seed runner — generates real Argon2 hashes and inserts seed data.
 * Usage: node src/db/seed.js
 */

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const argon2 = require('argon2');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'gtcp',
  user:     process.env.DB_USER     || 'gtcp_user',
  password: process.env.DB_PASSWORD || '',
});

// Demo passwords — change in production!
const DEMO_PASSWORDS = {
  admin:      'Admin@2026!',
  dispatcher: 'Disp@2026!',
  credit:     'Credit@2026!',
  billing:    'Billing@2026!',
  contracts:  'Contracts@2026!',
};

async function run() {
  console.log('Generating Argon2id hashes...');
  const hashes = {};
  for (const [role, pwd] of Object.entries(DEMO_PASSWORDS)) {
    hashes[role] = await argon2.hash(pwd, { type: argon2.argon2id });
    console.log(`  ✅ ${role}`);
  }

  // Read SQL template and replace placeholders
  let sql = fs.readFileSync(path.join(__dirname, 'seeds', 'seed.sql'), 'utf8');
  sql = sql
    .replace('__HASH_admin__',     hashes.admin)
    .replace('__HASH_disp__',      hashes.dispatcher)
    .replace('__HASH_credit__',    hashes.credit)
    .replace('__HASH_billing__',   hashes.billing)
    .replace('__HASH_contracts__', hashes.contracts);

  console.log('\nInserting seed data...');
  await pool.query(sql);
  console.log('✅ Seed complete.\n');
  console.log('Demo credentials:');
  for (const [role, pwd] of Object.entries(DEMO_PASSWORDS)) {
    const user = role === 'dispatcher' ? 'dispatcher1' : role === 'admin' ? 'admin' : `${role}1`;
    console.log(`  ${user.padEnd(12)} : ${pwd}`);
  }

  await pool.end();
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
