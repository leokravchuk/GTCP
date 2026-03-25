-- ============================================================
-- Migration 003 — Contracts: CAM NC / Gastrans Network Code
-- ============================================================
-- Based on:
--   Gastrans Network Code (AERS approved, 30.05.2020)
--   CAM NC EU 2017/459 — Capacity Allocation Mechanisms
--   TAR NC EU 2017/460 — Harmonised Tariff Structures
--   Gastrans Incremental Capacity 2026 (tariff ref: 3.10 EUR/kWh/h/a)
-- ============================================================

-- ── 1. Extend contracts table ─────────────────────────────────────────────────

ALTER TABLE contracts

  -- Contract type (GTA = Gas Transportation Agreement)
  ADD COLUMN IF NOT EXISTS contract_type      VARCHAR(30)
    NOT NULL DEFAULT 'TSA_FIRM_ANNUAL'
    CHECK (contract_type IN (
      'TSA_FIRM_ANNUAL',        -- Long-term firm, annual (primary product)
      'TSA_FIRM_QUARTERLY',     -- Firm quarterly
      'TSA_FIRM_MONTHLY',       -- Firm monthly
      'TSA_FIRM_DAILY',         -- Firm daily / day-ahead
      'TSA_FIRM_WITHIN_DAY',    -- Firm within-day
      'TSA_INTERRUPTIBLE',      -- Interruptible (all durations)
      'TSA_COMMERCIAL_REVERSE'  -- Commercial reverse flow (interruptible by default)
    )),

  -- Capacity type
  ADD COLUMN IF NOT EXISTS capacity_type      VARCHAR(15)
    NOT NULL DEFAULT 'FIRM'
    CHECK (capacity_type IN ('FIRM','INTERRUPTIBLE')),

  -- Flow direction on the Gastrans system
  -- FIRM direction: Gospođinci ENTRY → Horgoš EXIT (TurkStream → Hungary)
  -- COMMERCIAL REVERSE: Horgoš ENTRY → Gospođinci EXIT (Hungary → south)
  ADD COLUMN IF NOT EXISTS flow_direction     VARCHAR(30)
    NOT NULL DEFAULT 'GOSPODJINCI_HORGOS'
    CHECK (flow_direction IN (
      'GOSPODJINCI_HORGOS',   -- Firm: Entry Gospođinci → Exit Horgoš (main transit)
      'HORGOS_GOSPODJINCI'    -- Commercial Reverse: Entry Horgoš → Exit Gospođinci
    )),

  -- Booking period (CAM NC Art. 3 standard products)
  ADD COLUMN IF NOT EXISTS booking_period     VARCHAR(15)
    NOT NULL DEFAULT 'ANNUAL'
    CHECK (booking_period IN (
      'ANNUAL','QUARTERLY','MONTHLY','DAILY','WITHIN_DAY'
    )),

  -- Bundled capacity flag (CAM NC: entry + exit contracted simultaneously)
  ADD COLUMN IF NOT EXISTS is_bundled         BOOLEAN NOT NULL DEFAULT TRUE,

  -- Interconnection points
  ADD COLUMN IF NOT EXISTS entry_point_code   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS exit_point_code    VARCHAR(50),

  -- Tariff structure (TAR NC Entry/Exit model)
  -- For transit: total tariff = tariff_entry_eur_kwh_day + tariff_exit_eur_kwh_day
  -- Gastrans reference: ~3.10 EUR/kWh/h/a (incremental, 2026)
  -- Daily equivalent: 3.10 / 365 ≈ 0.00849 EUR/kWh/d
  ADD COLUMN IF NOT EXISTS tariff_entry_eur_kwh_day  NUMERIC(12,8),
  ADD COLUMN IF NOT EXISTS tariff_exit_eur_kwh_day   NUMERIC(12,8),

  -- Capacity (kWh/d) — max daily contracted volume
  -- Ref: Gospođinci GMS-4 tech capacity: 60,483,072 kWh/d
  -- Ref: IP Horgoš/Kiskundorozsma (SR→HU): 245,765,568 kWh/d
  -- Ref: Firm offered 2025/2026: 108,869,530 kWh/d
  ADD COLUMN IF NOT EXISTS capacity_kwh_day   NUMERIC(18,0),

  -- RBP.EU auction reference
  ADD COLUMN IF NOT EXISTS auction_ref        VARCHAR(100),

  -- Gas Transportation Agreement number (Gastrans format: GTA-YYYY-NNNN)
  ADD COLUMN IF NOT EXISTS gta_number         VARCHAR(50);

-- ── 2. Set defaults for existing contracts ────────────────────────────────────
UPDATE contracts SET
  entry_point_code = 'GOSPODJINCI-ENTRY',
  exit_point_code  = 'HORGOS-EXIT'
WHERE entry_point_code IS NULL;

-- ── 3. System params: standard Gastrans tariff rates ─────────────────────────
INSERT INTO system_params (key, value, description) VALUES
  ('tariff_entry_gospodjinci_eur_kwh_day',
   '{"value": 0.004246, "unit": "EUR/kWh/d", "label": "Entry tariff Gospođinci (EUR/kWh/d)"}',
   'Entry capacity tariff at Gospođinci (IP Serbia). Ref: Gastrans NC TAR. ~1.55 EUR/kWh/h/a ÷ 365.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_params (key, value, description) VALUES
  ('tariff_exit_horgos_eur_kwh_day',
   '{"value": 0.004246, "unit": "EUR/kWh/d", "label": "Exit tariff Horgoš (EUR/kWh/d)"}',
   'Exit capacity tariff at Horgoš / IP Kiskundorozsma. Ref: Gastrans NC TAR. ~1.55 EUR/kWh/h/a ÷ 365.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_params (key, value, description) VALUES
  ('tariff_reverse_eur_kwh_day',
   '{"value": 0.002500, "unit": "EUR/kWh/d", "label": "Commercial reverse tariff (EUR/kWh/d)"}',
   'Reduced tariff for commercial reverse flow (Horgoš ENTRY → Gospođinci EXIT). Interruptible.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_params (key, value, description) VALUES
  ('tech_capacity_gospodjinci_kwh_day',
   '{"value": 60483072, "unit": "kWh/d", "label": "Technical capacity GMS-4 Gospođinci"}',
   'Technical (firm) capacity of GMS-4 Gospođinci. Source: Gastrans transparency data.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_params (key, value, description) VALUES
  ('tech_capacity_horgos_kwh_day',
   '{"value": 245765568, "unit": "kWh/d", "label": "Technical capacity IP Horgoš (SR→HU)"}',
   'Technical (firm) capacity of IP Kiskundorozsma 1200 (Serbia→Hungary). Source: Gastrans transparency data.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_params (key, value, description) VALUES
  ('contracted_capacity_2025_kwh_day',
   '{"value": 108869530, "unit": "kWh/d", "label": "Contracted firm capacity 2025/2026"}',
   'Total firm yearly capacity contracted at IP Serbia for gas year 2025/2026 (Gastrans→Transportgas direction).')
ON CONFLICT (key) DO NOTHING;

-- ── 4. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contracts_flow_direction
  ON contracts (flow_direction, capacity_type, status);
CREATE INDEX IF NOT EXISTS idx_contracts_type
  ON contracts (contract_type, status);
