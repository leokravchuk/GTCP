-- ============================================================
-- Migration 004: Official AERS Tariffs GY2025/2026
-- Source: AERS Decision 05-145, 17 July 2025 (confirmed 25 Jul 2025)
-- Tariff unit: EUR / (kWh/h) / period
-- ============================================================

-- 1. Official capacity tariff table (full AERS schedule)
CREATE TABLE IF NOT EXISTS capacity_tariffs (
  id              SERIAL PRIMARY KEY,
  gas_year        VARCHAR(9)  NOT NULL DEFAULT '2025/2026',   -- e.g. 2025/2026
  product_type    VARCHAR(30) NOT NULL,   -- ANNUAL_FIRM, QUARTERLY_FIRM, MONTHLY_FIRM, DAILY_FIRM, WITHIN_DAY, COMMERCIAL_REVERSE
  quarter         VARCHAR(5),             -- Q1/Q2/Q3/Q4 (for quarterly products)
  month_days      INTEGER,                -- 28/30/31 (for monthly products)
  point_code      VARCHAR(30) NOT NULL,   -- GOSPODJINCI-ENTRY, HORGOS-EXIT, KIREVO-ENTRY, DOMESTIC-EXIT
  tariff_eur      NUMERIC(12,6) NOT NULL, -- EUR/(kWh/h)/period
  interruption_multiplier NUMERIC(4,1) DEFAULT 3.0,  -- Art. 3 of Decision: 3× for interrupted daily/within-day
  effective_from  DATE NOT NULL DEFAULT '2025-10-01',
  effective_to    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Clear existing tariff data for idempotency
DELETE FROM capacity_tariffs WHERE gas_year = '2025/2026';

-- Annual Firm
INSERT INTO capacity_tariffs (gas_year, product_type, point_code, tariff_eur) VALUES
  ('2025/2026', 'ANNUAL_FIRM', 'KIREVO-ENTRY',     6.00),
  ('2025/2026', 'ANNUAL_FIRM', 'DOMESTIC-EXIT',    4.19),   -- Paraćin / Pančevo / Gospođinci
  ('2025/2026', 'ANNUAL_FIRM', 'HORGOS-EXIT',      6.85),
-- Annual Interruptible
  ('2025/2026', 'ANNUAL_INTERRUPTIBLE', 'KIREVO-ENTRY',   2.85),
  ('2025/2026', 'ANNUAL_INTERRUPTIBLE', 'DOMESTIC-EXIT',  1.99),
-- Annual Commercial Reverse (Horgoš ENTRY → Gospođinci EXIT)
  ('2025/2026', 'ANNUAL_COMMERCIAL_REVERSE', 'HORGOS-EXIT', 3.25),
-- Quarterly Firm — Q1 (Oct–Dec 2025)
  ('2025/2026', 'QUARTERLY_FIRM', 'KIREVO-ENTRY',   1.81),
  ('2025/2026', 'QUARTERLY_FIRM', 'DOMESTIC-EXIT',  1.27),
  ('2025/2026', 'QUARTERLY_FIRM', 'HORGOS-EXIT',    2.07),
-- Quarterly Firm — Q2 (Jan–Mar 2026)
  ('2025/2026', 'QUARTERLY_FIRM_Q2', 'KIREVO-ENTRY',  1.78),
  ('2025/2026', 'QUARTERLY_FIRM_Q2', 'DOMESTIC-EXIT', 1.24),
  ('2025/2026', 'QUARTERLY_FIRM_Q2', 'HORGOS-EXIT',   2.03),
-- Quarterly Firm — Q3 (Apr–Jun 2026)
  ('2025/2026', 'QUARTERLY_FIRM_Q3', 'KIREVO-ENTRY',  1.80),
  ('2025/2026', 'QUARTERLY_FIRM_Q3', 'DOMESTIC-EXIT', 1.25),
  ('2025/2026', 'QUARTERLY_FIRM_Q3', 'HORGOS-EXIT',   2.05),
-- Quarterly Firm — Q4 (Jul–Sep 2026)
  ('2025/2026', 'QUARTERLY_FIRM_Q4', 'KIREVO-ENTRY',  1.81),
  ('2025/2026', 'QUARTERLY_FIRM_Q4', 'DOMESTIC-EXIT', 1.27),
  ('2025/2026', 'QUARTERLY_FIRM_Q4', 'HORGOS-EXIT',   2.07),
-- Monthly Firm — February (28 days)
  ('2025/2026', 'MONTHLY_FIRM_28D', 'KIREVO-ENTRY',   0.60),
  ('2025/2026', 'MONTHLY_FIRM_28D', 'DOMESTIC-EXIT',  0.42),
  ('2025/2026', 'MONTHLY_FIRM_28D', 'HORGOS-EXIT',    0.68),
-- Monthly Firm — 30-day month
  ('2025/2026', 'MONTHLY_FIRM_30D', 'KIREVO-ENTRY',   0.64),
  ('2025/2026', 'MONTHLY_FIRM_30D', 'DOMESTIC-EXIT',  0.45),
  ('2025/2026', 'MONTHLY_FIRM_30D', 'HORGOS-EXIT',    0.73),
-- Monthly Firm — 31-day month
  ('2025/2026', 'MONTHLY_FIRM_31D', 'KIREVO-ENTRY',   0.66),
  ('2025/2026', 'MONTHLY_FIRM_31D', 'DOMESTIC-EXIT',  0.46),
  ('2025/2026', 'MONTHLY_FIRM_31D', 'HORGOS-EXIT',    0.76),
-- Daily Firm  (same as Daily Interruptible per AERS)
  ('2025/2026', 'DAILY_FIRM', 'KIREVO-ENTRY',   0.0329),
  ('2025/2026', 'DAILY_FIRM', 'DOMESTIC-EXIT',  0.0230),
  ('2025/2026', 'DAILY_FIRM', 'HORGOS-EXIT',    0.0375),
  ('2025/2026', 'DAILY_COMMERCIAL_REVERSE', 'DOMESTIC-EXIT', 0.0109),
  ('2025/2026', 'DAILY_COMMERCIAL_REVERSE', 'HORGOS-EXIT',   0.0178),
-- Within-Day (same firm & interruptible)
  ('2025/2026', 'WITHIN_DAY', 'KIREVO-ENTRY',   0.0021),
  ('2025/2026', 'WITHIN_DAY', 'DOMESTIC-EXIT',  0.0014),
  ('2025/2026', 'WITHIN_DAY', 'HORGOS-EXIT',    0.0023);

-- 2. Add capacity_kwh_h to contracts (power in kWh/h, official Gastrans unit)
--    capacity_kwh_day / 24 = capacity_kwh_h
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS capacity_kwh_h  NUMERIC(18,2);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tariff_entry_eur_kwh_h NUMERIC(12,6);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tariff_exit_eur_kwh_h  NUMERIC(12,6);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS billing_model VARCHAR(20) DEFAULT 'CAPACITY';
  -- CAPACITY = capacity-based (take-or-pay), VOLUME = per-MWh (legacy)

-- Populate capacity_kwh_h from existing capacity_kwh_day
UPDATE contracts
SET capacity_kwh_h = capacity_kwh_day / 24.0
WHERE capacity_kwh_day IS NOT NULL AND capacity_kwh_h IS NULL;

-- Set default official tariffs for existing annual firm contracts
-- GOSPODJINCI_HORGOS (firm): entry 4.19 + exit 6.85
UPDATE contracts
SET tariff_entry_eur_kwh_h = 4.19,
    tariff_exit_eur_kwh_h  = 6.85
WHERE flow_direction = 'GOSPODJINCI_HORGOS'
  AND contract_type = 'TSA_FIRM_ANNUAL'
  AND tariff_entry_eur_kwh_h IS NULL;

-- HORGOS_GOSPODJINCI (commercial reverse): 3.25 total
UPDATE contracts
SET tariff_entry_eur_kwh_h = 0.00,
    tariff_exit_eur_kwh_h  = 3.25
WHERE flow_direction = 'HORGOS_GOSPODJINCI'
  AND contract_type = 'TSA_COMMERCIAL_REVERSE'
  AND tariff_entry_eur_kwh_h IS NULL;

-- 3. Add MDAP (Delivery-Acceptance Protocol) table for actual flows
CREATE TABLE IF NOT EXISTS mdap_daily (
  id              SERIAL PRIMARY KEY,
  contract_id     UUID REFERENCES contracts(id),
  gas_day         DATE NOT NULL,
  point_code      VARCHAR(30) NOT NULL,    -- GOSPODJINCI, HORGOS, KIREVO, etc.
  direction       VARCHAR(5)  NOT NULL,    -- ENTRY / EXIT
  nominated_kwh   NUMERIC(18,2) DEFAULT 0,
  allocated_kwh   NUMERIC(18,2) DEFAULT 0,
  gcv_kwh_nm3     NUMERIC(8,6),            -- Gross Calorific Value kWh/Nm3 at 0°C
  density_kg_nm3  NUMERIC(8,6),            -- Density kg/Nm3 at 0°C
  volume_nm3      NUMERIC(18,2),           -- Nm3 at 0°C (calculated from allocated_kwh / gcv)
  volume_kg       NUMERIC(18,2),           -- kg (volume_nm3 × density)
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, gas_day, point_code, direction)
);

-- 4. Add MDAP-based quantity columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS capacity_kwh_h    NUMERIC(18,2);  -- contracted capacity used for billing
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS capacity_fee_eur  NUMERIC(18,4);  -- capacity_kwh_h × tariff × days
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS allocated_kwh     NUMERIC(18,2);  -- actual MDAP sum for the period
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_days      INTEGER;        -- days in billing period

-- 5. Update system_params: replace wrong tariff values with official AERS values
-- Official units: EUR/(kWh/h)/year for annual firm
INSERT INTO system_params (key, value, description, updated_by) VALUES
  ('tariff_entry_gospodjinci_eur_kwh_h_yr', '4.19',    'Official AERS tariff GY2025/26: Entry Gospođinci (Domestic Exit Zone) firm annual EUR/(kWh/h)/year', NULL),
  ('tariff_exit_horgos_eur_kwh_h_yr',       '6.85',    'Official AERS tariff GY2025/26: Exit Horgoš (IP Kiskundorozsma) firm annual EUR/(kWh/h)/year', NULL),
  ('tariff_commercial_reverse_eur_kwh_h_yr','3.25',    'Official AERS tariff GY2025/26: Commercial Reverse annual EUR/(kWh/h)/year', NULL),
  ('tariff_daily_entry_eur_kwh_h',          '0.0230',  'Official AERS: Daily firm entry Gospođinci EUR/(kWh/h)/day', NULL),
  ('tariff_daily_exit_horgos_eur_kwh_h',    '0.0375',  'Official AERS: Daily firm exit Horgoš EUR/(kWh/h)/day', NULL),
  ('tariff_bundled_annual_eur_kwh_h_yr',    '11.04',   'Bundled entry+exit annual firm (4.19+6.85) EUR/(kWh/h)/year', NULL),
  ('gas_year_current',                       '"2025/2026"','Current gas year (Oct 2025 – Sep 2026)', NULL),
  ('gcv_reference_kwh_nm3',                  '11.524',  'Reference GCV kWh/Nm3 at 0°C (GMS-4 Gospođinci April 2025 actual)', NULL),
  ('density_reference_kg_nm3',               '0.7661',  'Reference density kg/Nm3 at 0°C (GMS-4 April 2025 actual)', NULL),
  ('nbs_rate_usd_rsd',                       '104.39',  'NBS exchange rate USD/RSD (reference April 2025)', NULL),
  ('nbs_rate_eur_rsd',                       '117.22',  'NBS exchange rate EUR/RSD (reference April 2025)', NULL)
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at  = NOW();
