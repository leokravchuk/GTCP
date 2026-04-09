'use strict';

/**
 * GTCP Seed Runner — programmatic DB seeding (no raw SQL files).
 *
 * Usage:  node src/db/seed-runner.js
 * Reset:  npm run db:reset  (migrate + seed)
 *
 * All seed data lives here as JS arrays.
 * Password placeholders are replaced with real argon2id hashes at runtime.
 * Source for auction calendar: MAR0277-24 ENTSOG + NC Gastrans Art.7
 * Source for reserve prices: AERS Decision 05-145 (17.07.2025)
 */

require('dotenv').config();

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

// ─── Password config ────────────────────────────────────────────────────────

const USER_PASSWORDS = {
  admin:      'admin123',
  dispatcher: 'disp123',
  credit:     'credit123',
  billing:    'billing123',
  contracts:  'contracts123',
};

async function hashPassword(plain) {
  if (argon2) return argon2.hash(plain);
  return '$2a$10$placeholder_hash_for_ci_testing_only';
}

// ─── Seed: Users ────────────────────────────────────────────────────────────

async function seedUsers(client) {
  const users = [
    { id: '11111111-0000-0000-0000-000000000001', username: 'admin',      email: 'admin@gtcp.local',      role: 'admin',      fullName: 'Администратор Системы', pwKey: 'admin' },
    { id: '11111111-0000-0000-0000-000000000002', username: 'dispatcher1', email: 'disp1@gtcp.local',      role: 'dispatcher', fullName: 'Иванов Диспетчер',      pwKey: 'dispatcher' },
    { id: '11111111-0000-0000-0000-000000000003', username: 'credit1',    email: 'credit1@gtcp.local',     role: 'credit',     fullName: 'Петров Кредит',         pwKey: 'credit' },
    { id: '11111111-0000-0000-0000-000000000004', username: 'billing1',   email: 'billing1@gtcp.local',    role: 'billing',    fullName: 'Сидорова Биллинг',      pwKey: 'billing' },
    { id: '11111111-0000-0000-0000-000000000005', username: 'contracts1', email: 'contracts1@gtcp.local',  role: 'contracts',  fullName: 'Козлов Контракты',      pwKey: 'contracts' },
  ];

  for (const u of users) {
    const hash = await hashPassword(USER_PASSWORDS[u.pwKey]);
    await client.query(
      `INSERT INTO users (id, username, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      [u.id, u.username, u.email, hash, u.role, u.fullName]
    );
  }
  console.log('  ✓ Users seeded (%d rows)', users.length);
}

// ─── Seed: Shippers ─────────────────────────────────────────────────────────

async function seedShippers(client) {
  const shippers = [
    ['22222222-0000-0000-0000-000000000001', 'SHP-001', 'Газпром Экспорт',         'RU', '27X-GA-GAZPROM-0', 5000000, 2100000],
    ['22222222-0000-0000-0000-000000000002', 'SHP-002', 'Naftna Industrija Srbije', 'RS', '27X-NIS-SERBIA-0', 3000000, 1500000],
    ['22222222-0000-0000-0000-000000000003', 'SHP-003', 'MET Energy Trading',       'CH', '27X-MET-ENERGY-0', 2500000, 800000],
    ['22222222-0000-0000-0000-000000000004', 'SHP-004', 'WIEH GmbH',               'DE', '27X-WIEH-GMBH-00', 4000000, 3900000],
    ['22222222-0000-0000-0000-000000000005', 'SHP-005', 'Srbijagas',               'RS', '27X-SRBIJAGAS-00', 2000000, 500000],
  ];

  for (const s of shippers) {
    await client.query(
      `INSERT INTO shippers (id, code, name, country, eic_code, credit_limit, current_exposure)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO NOTHING`,
      s
    );
  }
  console.log('  ✓ Shippers seeded (%d rows)', shippers.length);
}

// ─── Seed: Contracts ────────────────────────────────────────────────────────

async function seedContracts(client) {
  const adminId = '11111111-0000-0000-0000-000000000001';
  const contracts = [
    ['33333333-0000-0000-0000-000000000001', 'CTR-2026-001', '22222222-0000-0000-0000-000000000001', 'FIRM',          '2026-01-01', '2026-12-31', 450000, 0.75],
    ['33333333-0000-0000-0000-000000000002', 'CTR-2026-002', '22222222-0000-0000-0000-000000000002', 'FIRM',          '2026-01-01', '2026-12-31', 280000, 0.72],
    ['33333333-0000-0000-0000-000000000003', 'CTR-2026-003', '22222222-0000-0000-0000-000000000003', 'INTERRUPTIBLE', '2026-03-01', '2026-09-30', 150000, 0.68],
    ['33333333-0000-0000-0000-000000000004', 'CTR-2026-004', '22222222-0000-0000-0000-000000000004', 'FIRM',          '2026-01-01', '2026-12-31', 380000, 0.74],
    ['33333333-0000-0000-0000-000000000005', 'CTR-2026-005', '22222222-0000-0000-0000-000000000005', 'FIRM',          '2026-02-01', '2026-12-31', 200000, 0.71],
  ];

  for (const c of contracts) {
    await client.query(
      `INSERT INTO contracts (id, contract_no, shipper_id, contract_type, start_date, end_date,
                              max_daily_mwh, tariff_eur_mwh, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9)
       ON CONFLICT (contract_no) DO NOTHING`,
      [...c, adminId]
    );
  }
  console.log('  ✓ Contracts seeded (%d rows)', contracts.length);
}

// ─── Seed: Capacity Bookings ────────────────────────────────────────────────

async function seedCapacityBookings(client) {
  const adminId = '11111111-0000-0000-0000-000000000001';
  // [ref, shipper_id, point, direction, type, capacity_mwh_d, capacity_kwh_h, allocated, from, to, category]
  // capacity_kwh_h = authoritative (AERS kWh/h), capacity_mwh_d = back-calculated (× 24 / 1000)
  // RULE: LT = 90% Tech exact, ST = 10% fully free for auctions (no ST pre-bookings)
  // RULE: Газпром HORGOS-EXIT = floor(Tech × 0.9) = 9,216,209 (Final Exemption Act)
  // RULE: Each shipper balanced: Entry = Σ Exit
  const bookings = [
    // Газпром: transit (Kirevo→Horgoš) + domestic (Kirevo→Serbia)
    ['LT-001-E',  '22222222-0000-0000-0000-000000000001', 'KIREVO-ENTRY', 'ENTRY', 'FIRM', 234053.52, 9752230, 430000, '2026-01-01', '2026-12-31', 'LONG_TERM'],
    ['LT-001-XH', '22222222-0000-0000-0000-000000000001', 'HORGOS-EXIT',  'EXIT',  'FIRM', 221188.62, 9216209, 420000, '2026-01-01', '2026-12-31', 'LONG_TERM'],
    ['LT-001-XS', '22222222-0000-0000-0000-000000000001', 'EXIT-SERBIA',  'EXIT',  'FIRM',  12864.50,  536021, 260000, '2026-01-01', '2026-12-31', 'LONG_TERM'],
    // NIS: domestic only (Kirevo→Serbia)
    ['LT-002-E',  '22222222-0000-0000-0000-000000000002', 'KIREVO-ENTRY', 'ENTRY', 'FIRM',  96005.02, 4000209, 265000, '2026-01-01', '2026-12-31', 'LONG_TERM'],
    ['LT-002-XS', '22222222-0000-0000-0000-000000000002', 'EXIT-SERBIA',  'EXIT',  'FIRM',  96005.02, 4000209, 260000, '2026-01-01', '2026-12-31', 'LONG_TERM'],
  ];
  // Verification: KIREVO-ENTRY LT = 9,752,230 + 4,000,209 = 13,752,439 = floor(15,280,488×0.9) ✓
  // Verification: HORGOS-EXIT  LT = 9,216,209 = floor(10,240,233×0.9) ✓
  // Verification: EXIT-SERBIA  LT = 536,021 + 4,000,209 = 4,536,230 = floor(5,040,256×0.9) ✓
  // Verification: Газпром Δ = 9,752,230 − (9,216,209+536,021) = 0 ✓
  // Verification: NIS Δ = 4,000,209 − 4,000,209 = 0 ✓
  // ST Free: Entry 1,528,049 | Horgoš 1,024,024 | Serbia 504,026 = 10% each ✓

  for (const b of bookings) {
    await client.query(
      `INSERT INTO capacity_bookings (booking_ref, shipper_id, point, direction, booking_type,
                                      capacity_mwh_d, capacity_kwh_h, allocated_mwh_d, period_from, period_to, created_by, capacity_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (booking_ref) DO NOTHING`,
      [...b, adminId]
    );
  }
  console.log('  ✓ Capacity bookings seeded (%d rows)', bookings.length);
}

// ─── Seed: Nominations (Gas Day 2026-03-23) ─────────────────────────────────

async function seedNominations(client) {
  const dispatcherId = '11111111-0000-0000-0000-000000000002';
  // [ref, shipper_id, gas_day, direction, point, volume_mwh, status]
  const nominations = [
    ['NOM-2026-00001', '22222222-0000-0000-0000-000000000001', '2026-03-23', 'ENTRY', 'KIREVO-ENTRY', 430000, 'MATCHED'],
    ['NOM-2026-00002', '22222222-0000-0000-0000-000000000001', '2026-03-23', 'EXIT',  'HORGOS-EXIT',  430000, 'MATCHED'],
    ['NOM-2026-00003', '22222222-0000-0000-0000-000000000002', '2026-03-23', 'ENTRY', 'KIREVO-ENTRY', 265000, 'PARTIALLY_MATCHED'],
    ['NOM-2026-00004', '22222222-0000-0000-0000-000000000002', '2026-03-23', 'EXIT',  'EXIT-SERBIA',  260000, 'PENDING'],
    ['NOM-2026-00005', '22222222-0000-0000-0000-000000000004', '2026-03-23', 'ENTRY', 'KIREVO-ENTRY', 375000, 'PENDING'],
    ['NOM-2026-00006', '22222222-0000-0000-0000-000000000004', '2026-03-23', 'EXIT',  'HORGOS-EXIT',  370000, 'PENDING'],
  ];

  for (const n of nominations) {
    await client.query(
      `INSERT INTO nominations (reference, shipper_id, gas_day, direction, point, volume_mwh, status, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (reference) DO NOTHING`,
      [...n, dispatcherId]
    );
  }
  console.log('  ✓ Nominations seeded (%d rows)', nominations.length);
}

// ─── Seed: Invoices ─────────────────────────────────────────────────────────

async function seedInvoices(client) {
  const billingId = '11111111-0000-0000-0000-000000000004';
  // [invoice_no, shipper_id, period_from, period_to, volume_mwh, tariff, amount, status, due_date]
  const invoices = [
    ['INV-2026-0001', '22222222-0000-0000-0000-000000000001', '2026-02-01', '2026-02-28', 12450000, 0.75, 9337500.00, 'ISSUED', '2026-03-31'],
    ['INV-2026-0002', '22222222-0000-0000-0000-000000000002', '2026-02-01', '2026-02-28',  7420000, 0.72, 5342400.00, 'PAID',   '2026-03-15'],
  ];

  for (const inv of invoices) {
    await client.query(
      `INSERT INTO invoices (invoice_no, shipper_id, period_from, period_to, volume_mwh,
                             tariff_eur_mwh, amount_eur, status, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (invoice_no) DO NOTHING`,
      [...inv, billingId]
    );
  }
  console.log('  ✓ Invoices seeded (%d rows)', invoices.length);
}

// ─── Seed: Margin Calls ─────────────────────────────────────────────────────

async function seedMarginCalls(client) {
  await client.query(
    `INSERT INTO margin_calls (shipper_id, exposure_eur, limit_eur, status, issued_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING`,
    [
      '22222222-0000-0000-0000-000000000004', 3900000.00, 4000000.00, 'OPEN',
      '11111111-0000-0000-0000-000000000003',
      'Exposure approaching credit limit. Issued automatically by Credit Monitor.',
    ]
  );
  console.log('  ✓ Margin calls seeded');
}

// ─── Seed: Audit Log ────────────────────────────────────────────────────────

async function seedAuditLog(client) {
  await client.query(
    `INSERT INTO audit_log (action_type, entity_type, entity_id, username, description) VALUES
     ('SYSTEM', NULL, NULL, 'system', 'Database seed completed successfully'),
     ('LOGIN',  NULL, NULL, 'admin',  'Initial admin login during seed')`
  );
  console.log('  ✓ Audit log seeded');
}

// ─── Seed: System Params (AERS tariffs, rates) ─────────────────────────────

async function seedSystemParams(client) {
  const params = [
    ['tariff_entry_gospodjinci_eur_kwh_h_yr', '6.00'],
    ['tariff_exit_horgos_eur_kwh_h_yr',       '6.85'],
    ['tariff_commercial_reverse_eur_kwh_h_yr', '3.25'],
    ['tariff_bundled_annual_eur_kwh_h_yr',     '12.85'],
    ['tariff_daily_entry_eur_kwh_h',           '0.0329'],
    ['tariff_daily_exit_horgos_eur_kwh_h',     '0.0375'],
    ['fuel_gas_x1_compressor_pct',             '0.42'],
    ['fuel_gas_x2_preheating_pct',             '0.08'],
    ['fuel_gas_kn_quality_kwh',                '0'],
    ['fuel_gas_rate_pct',                      '0.50'],
    ['fuel_gas_price_eur_mwh',                 '32.50'],
    ['gcv_horgos_kwh_nm3',                     '11.523'],
    ['balancing_gas_rate_eur_mwh',             '5.00'],
    ['euribor_6m_pct',                         '2.64'],
    ['late_payment_spread_pct',                '3.0'],
    ['late_payment_day_basis',                 '360'],
  ];

  for (const [key, value] of params) {
    await client.query(
      `INSERT INTO system_params (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
  console.log('  ✓ System params seeded (%d rows)', params.length);
}

// ─── Seed: Auction Calendar (GY 2025/2026) ──────────────────────────────────
// Source: seed_auctions_v2.sql — 115 auctions
// MAR0277-24 ENTSOG + NC Gastrans Art.7 + AERS Decision 05-145

async function seedAuctions(client) {
  // Clear existing auction data for clean re-seed
  await client.query('DELETE FROM auction_bids');
  await client.query('DELETE FROM auction_calendar');

  // [point_code, product_type, capacity_type, gas_year, auction_start, auction_end,
  //  delivery_start, delivery_end, status, cam_nc_ref, reserve_price, auction_round, notes]
  const auctions = [
    // ── YEARLY FIRM (Art.7.4.2.1+7.1.2) — 1st Mon July ──
    // NC Art.7.1.2: ONLY if LT surrendered. No surrenders in GY2025 → price 0
    ['KIREVO-ENTRY',     'YEARLY', 'FIRM', 2025, '2025-07-06 07:00+00', '2025-07-06 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 0, null, 'No LT surrendered'],
    ['HORGOS-EXIT',      'YEARLY', 'FIRM', 2025, '2025-07-06 07:00+00', '2025-07-06 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 0, null, 'No LT surrendered'],
    ['EXIT-SERBIA',      'YEARLY', 'FIRM', 2025, '2025-07-06 07:00+00', '2025-07-06 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 0, null, 'No LT surrendered'],

    // ── YEARLY CR (Art.7.4.3.1) — 3rd Mon July ──
    ['HORGOS-ENTRY',     'YEARLY', 'COMMERCIAL_REVERSE', 2025, '2025-07-20 07:00+00', '2025-07-20 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY','YEARLY', 'COMMERCIAL_REVERSE', 2025, '2025-07-20 07:00+00', '2025-07-20 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 1.99, null, null],

    // ── QUARTERLY FIRM (Art.7.4.2.2) — 4 rounds ──

    // Round 1: 1st Mon Aug — Q1+Q2+Q3+Q4
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 1.81, 1, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 2.07, 1, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 1.27, 1, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.78, 1, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 2.03, 1, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.24, 1, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80, 1, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05, 1, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25, 1, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81, 1, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07, 1, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-08-03 07:00+00', '2025-08-03 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27, 1, null],

    // Round 2: 1st Mon Nov — Q2+Q3+Q4
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.78, 2, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 2.03, 2, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.24, 2, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80, 2, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05, 2, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25, 2, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81, 2, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07, 2, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2025-11-02 08:00+00', '2025-11-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27, 2, null],

    // Round 3: 1st Mon Feb — Q3+Q4
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80, 3, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05, 3, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25, 3, null],
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81, 3, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07, 3, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2026-02-01 08:00+00', '2026-02-01 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27, 3, null],

    // Round 4: 1st Mon May — Q4 only
    ['KIREVO-ENTRY', 'QUARTERLY', 'FIRM', 2025, '2026-05-03 07:00+00', '2026-05-03 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 1.81, 4, null],
    ['HORGOS-EXIT',  'QUARTERLY', 'FIRM', 2025, '2026-05-03 07:00+00', '2026-05-03 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 2.07, 4, null],
    ['EXIT-SERBIA',  'QUARTERLY', 'FIRM', 2025, '2026-05-03 07:00+00', '2026-05-03 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 1.27, 4, null],

    // ── QUARTERLY CR (Art.7.4.3.2) — 1st Mon Sep/Dec/Mar/Jun ──

    // CR Round 1
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 1, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 1, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 1, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 1, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 1, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 1, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 1, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-08-31 07:00+00', '2025-08-31 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 1, null],

    // CR Round 2
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 2, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 2, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 2, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 2, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 2, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-30 08:00+00', '2025-11-30 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 2, null],

    // CR Round 3
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-01 07:00+00', '2026-03-01 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 3, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-01 07:00+00', '2026-03-01 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 3, null],
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-01 07:00+00', '2026-03-01 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 3.25, 3, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-01 07:00+00', '2026-03-01 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.2', 1.99, 3, null],

    // CR Round 4
    ['HORGOS-ENTRY',      'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-05-31 07:00+00', '2026-05-31 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.3.2', 3.25, 4, null],
    ['EXIT-SERBIA-ENTRY', 'QUARTERLY', 'COMMERCIAL_REVERSE', 2025, '2026-05-31 07:00+00', '2026-05-31 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.3.2', 1.99, 4, null],

    // ── MONTHLY FIRM (Art.7.4.2.3) — 3rd Mon M-1 ──

    // Oct 2025 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2025-09-14 07:00+00', '2025-09-14 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2025-09-14 07:00+00', '2025-09-14 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2025-09-14 07:00+00', '2025-09-14 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.46, null, null],
    // Nov 2025 (30d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2025-10-19 07:00+00', '2025-10-19 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.64, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2025-10-19 07:00+00', '2025-10-19 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.73, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2025-10-19 07:00+00', '2025-10-19 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.45, null, null],
    // Dec 2025 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2025-11-16 08:00+00', '2025-11-16 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2025-11-16 08:00+00', '2025-11-16 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2025-11-16 08:00+00', '2025-11-16 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.46, null, null],
    // Jan 2026 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2025-12-14 08:00+00', '2025-12-14 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2025-12-14 08:00+00', '2025-12-14 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2025-12-14 08:00+00', '2025-12-14 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.46, null, null],
    // Feb 2026 (28d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-01-18 08:00+00', '2026-01-18 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.60, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-01-18 08:00+00', '2026-01-18 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.68, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-01-18 08:00+00', '2026-01-18 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.42, null, null],
    // Mar 2026 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-02-15 08:00+00', '2026-02-15 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-02-15 08:00+00', '2026-02-15 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-02-15 08:00+00', '2026-02-15 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.46, null, null],
    // Apr 2026 (30d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-03-15 07:00+00', '2026-03-15 16:00+00', '2026-04-01', '2026-05-01', 'CLOSED', 'Art.7.4.2.3', 0.64, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-03-15 07:00+00', '2026-03-15 16:00+00', '2026-04-01', '2026-05-01', 'CLOSED', 'Art.7.4.2.3', 0.73, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-03-15 07:00+00', '2026-03-15 16:00+00', '2026-04-01', '2026-05-01', 'CLOSED', 'Art.7.4.2.3', 0.45, null, null],
    // May 2026 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-04-19 07:00+00', '2026-04-19 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-04-19 07:00+00', '2026-04-19 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-04-19 07:00+00', '2026-04-19 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.46, null, null],
    // Jun 2026 (30d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-05-17 07:00+00', '2026-05-17 16:00+00', '2026-06-01', '2026-07-01', 'UPCOMING', 'Art.7.4.2.3', 0.64, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-05-17 07:00+00', '2026-05-17 16:00+00', '2026-06-01', '2026-07-01', 'UPCOMING', 'Art.7.4.2.3', 0.73, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-05-17 07:00+00', '2026-05-17 16:00+00', '2026-06-01', '2026-07-01', 'UPCOMING', 'Art.7.4.2.3', 0.45, null, null],
    // Jul 2026 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-06-14 07:00+00', '2026-06-14 16:00+00', '2026-07-01', '2026-08-01', 'UPCOMING', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-06-14 07:00+00', '2026-06-14 16:00+00', '2026-07-01', '2026-08-01', 'UPCOMING', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-06-14 07:00+00', '2026-06-14 16:00+00', '2026-07-01', '2026-08-01', 'UPCOMING', 'Art.7.4.2.3', 0.46, null, null],
    // Aug 2026 (31d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-07-19 07:00+00', '2026-07-19 16:00+00', '2026-08-01', '2026-09-01', 'UPCOMING', 'Art.7.4.2.3', 0.66, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-07-19 07:00+00', '2026-07-19 16:00+00', '2026-08-01', '2026-09-01', 'UPCOMING', 'Art.7.4.2.3', 0.76, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-07-19 07:00+00', '2026-07-19 16:00+00', '2026-08-01', '2026-09-01', 'UPCOMING', 'Art.7.4.2.3', 0.46, null, null],
    // Sep 2026 (30d)
    ['KIREVO-ENTRY', 'MONTHLY', 'FIRM', 2025, '2026-08-16 07:00+00', '2026-08-16 16:00+00', '2026-09-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.3', 0.64, null, null],
    ['HORGOS-EXIT',  'MONTHLY', 'FIRM', 2025, '2026-08-16 07:00+00', '2026-08-16 16:00+00', '2026-09-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.3', 0.73, null, null],
    ['EXIT-SERBIA',  'MONTHLY', 'FIRM', 2025, '2026-08-16 07:00+00', '2026-08-16 16:00+00', '2026-09-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.3', 0.45, null, null],

    // ── MONTHLY CR (Art.7.4.3.3) — 1 week after Firm ──

    // Oct 2025
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-09-22 07:00+00', '2025-09-22 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-09-22 07:00+00', '2025-09-22 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Nov 2025
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-10-27 07:00+00', '2025-10-27 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-10-27 07:00+00', '2025-10-27 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Dec 2025
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-24 08:00+00', '2025-11-24 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-11-24 08:00+00', '2025-11-24 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Jan 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-12-22 08:00+00', '2025-12-22 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2025-12-22 08:00+00', '2025-12-22 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Feb 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-01-26 08:00+00', '2026-01-26 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-01-26 08:00+00', '2026-01-26 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Mar 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-02-23 08:00+00', '2026-02-23 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-02-23 08:00+00', '2026-02-23 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // Apr 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-23 07:00+00', '2026-03-23 16:00+00', '2026-04-01', '2026-05-01', 'CLOSED', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-03-23 07:00+00', '2026-03-23 16:00+00', '2026-04-01', '2026-05-01', 'CLOSED', 'Art.7.4.3.3', 1.99, null, null],
    // May 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-04-27 07:00+00', '2026-04-27 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-04-27 07:00+00', '2026-04-27 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.3.3', 1.99, null, null],
    // Jun 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-05-25 07:00+00', '2026-05-25 16:00+00', '2026-06-01', '2026-07-01', 'UPCOMING', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-05-25 07:00+00', '2026-05-25 16:00+00', '2026-06-01', '2026-07-01', 'UPCOMING', 'Art.7.4.3.3', 1.99, null, null],
    // Jul 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-06-22 07:00+00', '2026-06-22 16:00+00', '2026-07-01', '2026-08-01', 'UPCOMING', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-06-22 07:00+00', '2026-06-22 16:00+00', '2026-07-01', '2026-08-01', 'UPCOMING', 'Art.7.4.3.3', 1.99, null, null],
    // Aug 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-07-27 07:00+00', '2026-07-27 16:00+00', '2026-08-01', '2026-09-01', 'UPCOMING', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-07-27 07:00+00', '2026-07-27 16:00+00', '2026-08-01', '2026-09-01', 'UPCOMING', 'Art.7.4.3.3', 1.99, null, null],
    // Sep 2026
    ['HORGOS-ENTRY',      'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-08-24 07:00+00', '2026-08-24 16:00+00', '2026-09-01', '2026-10-01', 'UPCOMING', 'Art.7.4.3.3', 3.25, null, null],
    ['EXIT-SERBIA-ENTRY', 'MONTHLY', 'COMMERCIAL_REVERSE', 2025, '2026-08-24 07:00+00', '2026-08-24 16:00+00', '2026-09-01', '2026-10-01', 'UPCOMING', 'Art.7.4.3.3', 1.99, null, null],
  ];

  const insertSQL = `
    INSERT INTO auction_calendar
      (point_code, product_type, capacity_type, gas_year,
       auction_start_date, auction_end_date, delivery_start, delivery_end,
       status, cam_nc_reference, reserve_price_eur_kwh_h, auction_round, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`;

  for (const a of auctions) {
    await client.query(insertSQL, a);
  }
  console.log('  ✓ Auction calendar seeded (%d rows)', auctions.length);
}

// ─── Seed: Gas Quality (NC Art.17, Annex 3A) ───────────────────────────────
// Realistic data based on GMS Kiskundorozsma (Horgoš) measurements.
// Source: openapi.yaml — GCV avg 11.523 kWh/Nm³, Wobbe ~14.975, CH4 ~94.38%, density ~0.7656
// Bulgarian entry (Kirevo) and domestic exit (Serbia) values slightly differ.

async function seedGasQuality(client) {
  await client.query('DELETE FROM gas_quality_daily');

  // Base values per IP (realistic ranges for natural gas on Gastrans pipeline)
  const ipProfiles = {
    'KIREVO-ENTRY':  { gcvBase: 11.480, wobbeBase: 14.920, ch4Base: 94.10, densityBase: 0.7680, h2sBase: 1.20 },
    'HORGOS-EXIT':   { gcvBase: 11.523, wobbeBase: 14.975, ch4Base: 94.38, densityBase: 0.7656, h2sBase: 1.15 },
    'EXIT-SERBIA':   { gcvBase: 11.510, wobbeBase: 14.950, ch4Base: 94.25, densityBase: 0.7665, h2sBase: 1.18 },
  };

  // Seed 31 days of March 2026 (current demo month) for all 3 IPs
  const rows = [];
  for (const [point, profile] of Object.entries(ipProfiles)) {
    for (let day = 1; day <= 31; day++) {
      const gasDay = `2026-03-${String(day).padStart(2, '0')}`;
      // Small daily variation (±0.5% for GCV, proportional for others)
      const vary = () => 0.995 + Math.random() * 0.01; // 0.995..1.005
      rows.push([
        gasDay,
        point,
        +(profile.gcvBase * vary()).toFixed(4),
        +(profile.wobbeBase * vary()).toFixed(4),
        +(profile.h2sBase * vary()).toFixed(4),
        +(profile.ch4Base * vary()).toFixed(2),
        +(profile.densityBase * vary()).toFixed(4),
      ]);
    }
  }

  const insertSQL = `
    INSERT INTO gas_quality_daily (gas_day, point_code, gcv_kwh_nm3, wobbe_index, h2s_mg_nm3, ch4_pct, density_kg_m3)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`;

  for (const r of rows) {
    await client.query(insertSQL, r);
  }
  console.log('  ✓ Gas quality seeded (%d rows, 3 IPs × 31 days)', rows.length);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (argon2) {
      console.log('Password hashes generated with argon2.');
    } else {
      console.warn('argon2 not available — using placeholder hashes.');
    }

    await seedUsers(client);
    await seedShippers(client);
    await seedContracts(client);
    await seedCapacityBookings(client);
    await seedNominations(client);
    await seedInvoices(client);
    await seedMarginCalls(client);
    await seedAuditLog(client);
    await seedSystemParams(client);
    await seedAuctions(client);
    await seedGasQuality(client);

    await client.query('COMMIT');
    console.log('\nSeed completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
