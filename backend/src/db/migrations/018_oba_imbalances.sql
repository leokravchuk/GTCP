-- Migration 018: OBA Daily Imbalances (TSO-to-TSO)
-- Purpose: NC Art.15 Balancing — operational balancing agreements between adjacent TSOs
-- Scope: TSO-level only. Shippers are ALWAYS in balance (nominated = allocated, NC Art.12.3)
-- Sprint 16 (10.04.2026) · US-1603b

BEGIN;

-- 1. Add allocated_kwh_h to nominations (for Art.12.3 enforcement: allocated = nominated)
ALTER TABLE nominations ADD COLUMN IF NOT EXISTS allocated_kwh_h NUMERIC(18,2);

-- Backfill: allocated = nominated for existing records (NC Art.12.3 rule)
UPDATE nominations
SET allocated_kwh_h = volume_kwh_h
WHERE allocated_kwh_h IS NULL AND volume_kwh_h IS NOT NULL;

-- 2. OBA daily imbalances table (TSO-to-TSO, read-only informational)
CREATE TABLE IF NOT EXISTS oba_daily_imbalances (
  id SERIAL PRIMARY KEY,
  gas_day DATE NOT NULL,
  point_code TEXT NOT NULL,                   -- KIREVO-ENTRY / HORGOS-EXIT / EXIT-SERBIA
  adjacent_tso TEXT NOT NULL,                 -- Bulgartransgaz / FGSZ / TRANSPORTGAS SRBIJA
  direction TEXT CHECK (direction IN ('ENTRY','EXIT')),

  -- Volumes at IP level (for the whole Gas Day)
  nominated_kwh NUMERIC(18,2) NOT NULL DEFAULT 0,    -- Σ shipper nominations × 24h
  allocated_kwh NUMERIC(18,2) NOT NULL DEFAULT 0,    -- = nominated (shipper level always balanced)
  measured_kwh  NUMERIC(18,2) NOT NULL DEFAULT 0,    -- physically measured at IP (metering)

  -- Imbalance breakdown (OBA components)
  metering_diff_kwh    NUMERIC(18,2) DEFAULT 0,      -- measurement accuracy (±0.2%)
  linepack_diff_kwh    NUMERIC(18,2) DEFAULT 0,      -- line pack change
  gcv_correction_kwh   NUMERIC(18,2) DEFAULT 0,      -- GCV normalization (kWh/Nm³)

  -- Total imbalance = measured - allocated (what TSO physically saw vs what shippers nominated)
  total_imbalance_kwh  NUMERIC(18,2) GENERATED ALWAYS AS
    (measured_kwh - allocated_kwh) STORED,

  oba_status TEXT DEFAULT 'PENDING',  -- PENDING / RECONCILED / SETTLED
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(gas_day, point_code, direction)
);

CREATE INDEX IF NOT EXISTS idx_oba_gas_day ON oba_daily_imbalances(gas_day DESC);
CREATE INDEX IF NOT EXISTS idx_oba_point ON oba_daily_imbalances(point_code, gas_day);
CREATE INDEX IF NOT EXISTS idx_oba_tso ON oba_daily_imbalances(adjacent_tso, gas_day);

COMMENT ON TABLE oba_daily_imbalances IS
  'NC Art.15 — Operational Balancing Agreement between adjacent TSOs. '
  'Read-only. Shippers are NOT charged for these imbalances (NC Art.12.3: nominated = allocated).';

COMMIT;
