-- ============================================================
-- Migration 002 — Fuel Gas, Balancing Gas, System Params, VTP
-- ============================================================

-- ── 1. System parameters table ──────────────────────────────
CREATE TABLE IF NOT EXISTS system_params (
  key          VARCHAR(100) PRIMARY KEY,
  value        JSONB        NOT NULL,
  description  TEXT,
  updated_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fuel gas rate: % of nominated volume consumed by compressors
INSERT INTO system_params (key, value, description) VALUES
  ('fuel_gas_rate_pct',
   '{"value": 0.50, "unit": "pct", "label": "Fuel Gas Rate (% of volume)"}',
   'Gas consumed by compressor stations as % of nominated volume. Charged to shipper.')
ON CONFLICT (key) DO NOTHING;

-- Fuel gas price: EUR/MWh (market price for fuel gas)
INSERT INTO system_params (key, value, description) VALUES
  ('fuel_gas_price_eur_mwh',
   '{"value": 32.50, "unit": "EUR/MWh", "label": "Fuel Gas Price (EUR/MWh)"}',
   'Market price applied to fuel gas volume for invoice calculation.')
ON CONFLICT (key) DO NOTHING;

-- Balancing gas rate: EUR/MWh premium over fuel gas price
INSERT INTO system_params (key, value, description) VALUES
  ('balancing_gas_rate_eur_mwh',
   '{"value": 5.00, "unit": "EUR/MWh", "label": "Balancing Gas Premium (EUR/MWh)"}',
   'Additional cost per MWh for system balancing gas. Applied when shipper causes imbalance.')
ON CONFLICT (key) DO NOTHING;

-- VTP Serbia: virtual trading point reference price
INSERT INTO system_params (key, value, description) VALUES
  ('vtp_serbia_price_eur_mwh',
   '{"value": 31.80, "unit": "EUR/MWh", "label": "VTP Serbia Reference Price (EUR/MWh)"}',
   'Reference price at Virtual Trading Point Serbia for title transfer trades.')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Extend invoices: fuel gas + balancing gas line items ──
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS volume_mwh          NUMERIC(15,3),
  ADD COLUMN IF NOT EXISTS tariff_eur_mwh      NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS transit_amount_eur  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS fuel_gas_rate_pct   NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS fuel_gas_volume_mwh NUMERIC(15,3),
  ADD COLUMN IF NOT EXISTS fuel_gas_price_eur_mwh NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS fuel_gas_amount_eur NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balancing_gas_mwh   NUMERIC(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balancing_gas_eur   NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_eur    NUMERIC(15,2);

-- Back-fill total_amount_eur = amount_eur for existing rows
UPDATE invoices SET total_amount_eur = amount_eur WHERE total_amount_eur IS NULL;

-- ── 3. Interconnection points reference table ─────────────────
CREATE TABLE IF NOT EXISTS interconnection_points (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)  NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  eic_code    VARCHAR(50),
  country     VARCHAR(3),            -- ISO 3166-1 alpha-3
  direction   VARCHAR(10),           -- ENTRY / EXIT / BOTH / VIRTUAL
  point_type  VARCHAR(20)  NOT NULL  -- PHYSICAL / VTP
    CHECK (point_type IN ('PHYSICAL','VTP')),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Physical interconnection points (Horgoš/Gospođinci corridor)
INSERT INTO interconnection_points (code, name, eic_code, country, direction, point_type) VALUES
  ('HORGOS-ENTRY',
   'Horgoš — ENTRY (from Hungary / MÁV-GÁZ)',
   '21Z-RS-HORGOS-ENTR-Y', 'SRB', 'ENTRY', 'PHYSICAL'),
  ('HORGOS-EXIT',
   'Horgoš — EXIT (reverse flow to Hungary)',
   '21Z-RS-HORGOS-EXIT-Y', 'SRB', 'EXIT', 'PHYSICAL'),
  ('GOSPODJINCI-EXIT',
   'Gospođinci — EXIT (to downstream / South)',
   '21Z-RS-GOSPO-EXIT--Y', 'SRB', 'EXIT', 'PHYSICAL'),
  ('GOSPODJINCI-ENTRY',
   'Gospođinci — ENTRY (reverse flow from South)',
   '21Z-RS-GOSPO-ENTR-Y', 'SRB', 'ENTRY', 'PHYSICAL'),
  ('VTP-SERBIA',
   'VTP Serbia — Virtual Trading Point (title transfer)',
   '21Z-RS-VTP-SERBIA-Y', 'SRB', 'BOTH', 'VTP')
ON CONFLICT (code) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_interconnection_points_type
  ON interconnection_points (point_type, is_active);
