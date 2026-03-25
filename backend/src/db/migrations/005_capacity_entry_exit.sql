-- ============================================================
-- Migration 005 — Capacity Entry/Exit Split + Gas Quality
-- ============================================================
-- Fixes:
--   1. Entry ≠ Exit capacity (13,752,230 vs 9,216,209 kWh/h)
--      → separate cap_entry_kwh_h / cap_exit_kwh_h on contracts
--      → corrected calcCapacityFee: entry_cap×t_entry + exit_cap×t_exit
--   2. EXIT_SERBIA: one integrated domestic exit point (NC Art. 6.3.1)
--      Gospođinci GMS-4 + Pančevo GMS-3 + Paraćin GMS-2 → single IP code
--   3. KIREVO-ENTRY: physical entry from Bulgaria (GMS-1)
--   4. gas_quality_daily table with Horgoš Annex 3A data (April 2025)
--   5. Fuel Gas NC Art.18 formula params: X1 (compressor), X2 (preheating)
--   6. Late payment interest (NC Art. 20.4.2): 6M EURIBOR + 3%, 360d basis
-- ============================================================

-- ── 1. Interconnection points: add NC-correct codes ──────────────────────────

INSERT INTO interconnection_points
  (code, name, eic_code, country, direction, point_type)
VALUES
  ('KIREVO-ENTRY',
   'Kirevo / Zaječar — ENTRY (from Bulgaria, GMS-1)',
   '21Z-RS-KIREVO-ENTR-Y', 'SRB', 'ENTRY', 'PHYSICAL'),
  ('EXIT-SERBIA',
   'Exit Point Serbia — integrated domestic exit (GMS-2 Paraćin + GMS-3 Pančevo + GMS-4 Gospođinci)',
   '21Z-RS-EXIT-SERBIA-Y', 'SRB', 'EXIT',  'PHYSICAL')
ON CONFLICT (code) DO NOTHING;

-- Mark old split codes as inactive (replaced by EXIT-SERBIA)
UPDATE interconnection_points
SET    is_active = FALSE
WHERE  code IN ('GOSPODJINCI-EXIT', 'GOSPODJINCI-ENTRY', 'DOMESTIC-EXIT')
  AND  is_active = TRUE;

-- ── 2. Contracts: add separate entry/exit capacity columns ────────────────────

-- cap_entry_kwh_h: reserved entry capacity (kWh/h) — can differ from exit
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS cap_entry_kwh_h  NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS cap_exit_kwh_h   NUMERIC(18,2);

-- Back-fill from existing capacity_kwh_h for transit contracts
-- Transit reserved (90% rule): Entry 13,752,230 / Exit Horgoš 9,216,209 kWh/h
-- Ratio: 9,216,209 / 13,752,230 = 0.6700
UPDATE contracts
SET cap_entry_kwh_h = capacity_kwh_h,
    cap_exit_kwh_h  = ROUND(capacity_kwh_h * 0.6700, 2)
WHERE flow_direction = 'GOSPODJINCI_HORGOS'
  AND capacity_kwh_h IS NOT NULL
  AND cap_entry_kwh_h IS NULL;

-- Commercial Reverse: entry = exit = same capacity
UPDATE contracts
SET cap_entry_kwh_h = capacity_kwh_h,
    cap_exit_kwh_h  = capacity_kwh_h
WHERE flow_direction = 'HORGOS_GOSPODJINCI'
  AND capacity_kwh_h IS NOT NULL
  AND cap_entry_kwh_h IS NULL;

-- ── 3. Contracts: add KIREVO_EXIT_SERBIA flow direction ───────────────────────

-- Extend CHECK constraint for flow_direction
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_flow_direction_check;
ALTER TABLE contracts
  ADD CONSTRAINT contracts_flow_direction_check
    CHECK (flow_direction IN (
      'GOSPODJINCI_HORGOS',  -- Firm transit: Entry Kirevo → Exit Horgoš (main)
      'HORGOS_GOSPODJINCI',  -- Commercial Reverse: Entry Horgoš → Exit Kirevo
      'KIREVO_EXIT_SERBIA'   -- Domestic delivery: Entry Kirevo → Exit Serbia
    ));

-- ── 4. Gas quality daily table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gas_quality_daily (
  id              SERIAL        PRIMARY KEY,
  gas_day         DATE          NOT NULL,
  point_code      VARCHAR(50)   NOT NULL REFERENCES interconnection_points(code),
  -- Measured quantities
  energy_kwh      NUMERIC(18,0),        -- Delivered energy kWh (25/0°C GCV basis)
  volume_nm3      NUMERIC(18,0),        -- Delivered volume Nm³ at 0°C
  -- Operating conditions
  pressure_barg   NUMERIC(8,4),         -- Delivery pressure (Barg)
  temp_c          NUMERIC(6,2),         -- Delivery temperature (°C)
  -- Composition
  methane_pct     NUMERIC(7,4),         -- Methane mole %
  -- Physical properties
  density_kg_nm3  NUMERIC(8,6),         -- Density at 0°C, kg/Nm³
  wobbe_kwh_nm3   NUMERIC(10,6),        -- Wobbe Index (25/0°C), kWh/Nm³
  gcv_kwh_nm3     NUMERIC(10,6),        -- Gross Calorific Value (25/0°C), kWh/Nm³
  -- Metadata
  source          VARCHAR(100),         -- Source document (e.g. 'Annex 3A April 2025')
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (gas_day, point_code)
);

CREATE INDEX IF NOT EXISTS idx_gas_quality_day_point
  ON gas_quality_daily (gas_day, point_code);

-- ── 5. Seed: Horgoš April 2025 actuals (Annex 3A) ────────────────────────────
-- Source: FGSZ Ltd. — Gastrans D.O.O. Quantity & Quality Report GMS Kiskundorozsma 2

INSERT INTO gas_quality_daily
  (gas_day, point_code, energy_kwh, volume_nm3, pressure_barg, temp_c,
   methane_pct, density_kg_nm3, wobbe_kwh_nm3, gcv_kwh_nm3, source)
VALUES
  ('2025-04-01', 'HORGOS-EXIT', 234300000, 20333172, 67.5378, 12.36, 94.3527, 0.7653, 14.977086, 11.523099, 'Annex 3A April 2025'),
  ('2025-04-02', 'HORGOS-EXIT', 228348000, 19799865, 67.6283, 12.17, 94.333,  0.7657, 14.986084, 11.533012, 'Annex 3A April 2025'),
  ('2025-04-03', 'HORGOS-EXIT', 233931000, 20253455, 67.5300, 12.31, 94.1900, 0.7666, 15.000172, 11.550266, 'Annex 3A April 2025'),
  ('2025-04-04', 'HORGOS-EXIT', 228175000, 19755472, 67.8616, 12.92, 94.1273, 0.7666, 14.999186, 11.549929, 'Annex 3A April 2025'),
  ('2025-04-05', 'HORGOS-EXIT', 213971000, 18547700, 68.5280, 13.01, 94.2793, 0.7658, 14.990215, 11.536285, 'Annex 3A April 2025'),
  ('2025-04-06', 'HORGOS-EXIT', 213111000, 18507893, 68.2559, 11.37, 94.4626, 0.7650, 14.968959, 11.514518, 'Annex 3A April 2025'),
  ('2025-04-07', 'HORGOS-EXIT', 215321000, 18707620, 67.6316, 10.75, 94.5007, 0.7648, 14.965474, 11.509958, 'Annex 3A April 2025'),
  ('2025-04-08', 'HORGOS-EXIT', 221023000, 19201988, 67.2849, 11.15, 94.4914, 0.7648, 14.965483, 11.510431, 'Annex 3A April 2025'),
  ('2025-04-09', 'HORGOS-EXIT', 224806000, 19533683, 67.5232, 12.02, 94.4967, 0.7647, 14.964805, 11.508620, 'Annex 3A April 2025'),
  ('2025-04-10', 'HORGOS-EXIT', 222153000, 19299599, 67.3640, 11.56, 94.4994, 0.7648, 14.966478, 11.510535, 'Annex 3A April 2025'),
  ('2025-04-11', 'HORGOS-EXIT', 221683000, 19239932, 66.6614, 12.67, 94.3841, 0.7658, 14.971577, 11.522263, 'Annex 3A April 2025'),
  ('2025-04-12', 'HORGOS-EXIT', 221637000, 19233975, 67.0094, 12.95, 94.3862, 0.7658, 14.972795, 11.523274, 'Annex 3A April 2025'),
  ('2025-04-13', 'HORGOS-EXIT', 221558000, 19231376, 67.8130, 13.56, 94.4142, 0.7656, 14.971840, 11.520638, 'Annex 3A April 2025'),
  ('2025-04-14', 'HORGOS-EXIT', 220872000, 19175551, 67.9675, 13.24, 94.4343, 0.7653, 14.971117, 11.518543, 'Annex 3A April 2025'),
  ('2025-04-15', 'HORGOS-EXIT', 221143000, 19193630, 68.1102, 13.49, 94.3811, 0.7657, 14.971460, 11.521726, 'Annex 3A April 2025'),
  ('2025-04-16', 'HORGOS-EXIT', 220365000, 19124193, 68.5616, 14.49, 94.3686, 0.7658, 14.972165, 11.522835, 'Annex 3A April 2025'),
  ('2025-04-17', 'HORGOS-EXIT', 224410000, 19478871, 68.7480, 14.61, 94.3885, 0.7655, 14.972297, 11.520815, 'Annex 3A April 2025'),
  ('2025-04-18', 'HORGOS-EXIT', 223265000, 19371768, 68.7215, 13.80, 94.3616, 0.7658, 14.975170, 11.525247, 'Annex 3A April 2025'),
  ('2025-04-19', 'HORGOS-EXIT', 223379000, 19376858, 68.5027, 13.84, 94.3273, 0.7661, 14.976110, 11.528338, 'Annex 3A April 2025'),
  ('2025-04-20', 'HORGOS-EXIT', 223224000, 19368022, 68.5510, 14.29, 94.3575, 0.7659, 14.974605, 11.525253, 'Annex 3A April 2025'),
  ('2025-04-21', 'HORGOS-EXIT', 223263000, 19368975, 68.4948, 14.67, 94.3396, 0.7661, 14.975236, 11.526995, 'Annex 3A April 2025'),
  ('2025-04-22', 'HORGOS-EXIT', 222885000, 19327107, 68.6178, 14.86, 94.2855, 0.7665, 14.977982, 11.532350, 'Annex 3A April 2025'),
  ('2025-04-23', 'HORGOS-EXIT', 221909000, 19254121, 68.8974, 14.84, 94.3563, 0.7659, 14.974782, 11.525298, 'Annex 3A April 2025'),
  ('2025-04-24', 'HORGOS-EXIT', 221856000, 19253951, 68.9245, 14.69, 94.3853, 0.7656, 14.973811, 11.522622, 'Annex 3A April 2025'),
  ('2025-04-25', 'HORGOS-EXIT', 224229000, 19457512, 68.6276, 14.62, 94.3798, 0.7657, 14.974388, 11.524076, 'Annex 3A April 2025'),
  ('2025-04-26', 'HORGOS-EXIT', 227000000, 19702105, 68.3018, 14.64, 94.4090, 0.7656, 14.973279, 11.521719, 'Annex 3A April 2025'),
  ('2025-04-27', 'HORGOS-EXIT', 226888000, 19697346, 68.6293, 14.41, 94.4381, 0.7653, 14.971478, 11.518660, 'Annex 3A April 2025'),
  ('2025-04-28', 'HORGOS-EXIT', 222987000, 19392338, 69.0045, 14.37, 94.6032, 0.7638, 14.959775, 11.498525, 'Annex 3A April 2025')
ON CONFLICT (gas_day, point_code) DO UPDATE
  SET energy_kwh     = EXCLUDED.energy_kwh,
      volume_nm3     = EXCLUDED.volume_nm3,
      pressure_barg  = EXCLUDED.pressure_barg,
      temp_c         = EXCLUDED.temp_c,
      methane_pct    = EXCLUDED.methane_pct,
      density_kg_nm3 = EXCLUDED.density_kg_nm3,
      wobbe_kwh_nm3  = EXCLUDED.wobbe_kwh_nm3,
      gcv_kwh_nm3    = EXCLUDED.gcv_kwh_nm3,
      source         = EXCLUDED.source;

-- ── 6. Fuel Gas NC Art.18 formula parameters ──────────────────────────────────
-- FG = X1 × Q1 + X2 × Q2 − KN
--   X1 = compressor gas rate (% of Horgoš / transit nominations)
--   X2 = preheating gas rate (% of Serbia / domestic nominations)
--   KN = quality compensation (set to 0 until metering data available)

INSERT INTO system_params (key, value, description) VALUES
  ('fuel_gas_x1_compressor_pct',
   '{"value": 0.42, "unit": "pct", "label": "X1: Compressor gas rate (% of Horgoš Q)"}',
   'NC Art.18: X1 coefficient for compressor stations. Applied to Horgoš (transit) nominations. '
   'Source: Gastrans NC Art.18.1.1 — typical 0.35–0.50% for transit pipeline.'),
  ('fuel_gas_x2_preheating_pct',
   '{"value": 0.08, "unit": "pct", "label": "X2: Preheating gas rate (% of Serbia domestic Q)"}',
   'NC Art.18: X2 coefficient for gas preheating. Applied to domestic (Exit Serbia) nominations. '
   'Source: Gastrans NC Art.18.1.2 — typical 0.05–0.10% for preheating only.'),
  ('fuel_gas_kn_quality_kwh',
   '{"value": 0, "unit": "kWh", "label": "KN: Quality compensation (kWh)"}',
   'NC Art.18: KN = quality-based compensation. Set to 0 until systematic quality deviation detected. '
   'Recalculated per billing period based on GCV deviation from reference.')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at  = NOW();

-- Update GCV and density references with April 2025 Horgoš actuals
INSERT INTO system_params (key, value, description) VALUES
  ('gcv_horgos_kwh_nm3',
   '{"value": 11.523, "unit": "kWh/Nm3", "label": "GCV Horgoš (25/0°C) kWh/Nm³"}',
   'Reference GCV at GMS Kiskundorozsma 2. Source: Annex 3A April 2025. '
   'Avg of 28 days: 11.523 kWh/Nm³. Range: 11.499–11.550 kWh/Nm³.'),
  ('wobbe_horgos_kwh_nm3',
   '{"value": 14.975, "unit": "kWh/Nm3", "label": "Wobbe Index Horgoš (25/0°C) kWh/Nm³"}',
   'Reference Wobbe Index at GMS Kiskundorozsma 2. Source: Annex 3A April 2025. '
   'Avg: 14.975 kWh/Nm³. Range: 14.960–15.000 kWh/Nm³.'),
  ('methane_horgos_avg_pct',
   '{"value": 94.38, "unit": "pct", "label": "Methane avg % (Horgoš April 2025)"}',
   'Average methane content at Horgoš, April 2025. Source: Annex 3A.'),
  ('density_horgos_kg_nm3',
   '{"value": 0.7656, "unit": "kg/Nm3", "label": "Density Horgoš at 0°C kg/Nm³"}',
   'Reference gas density at Horgoš. Source: Annex 3A April 2025. Avg: 0.7656 kg/Nm³.')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at  = NOW();

-- ── 7. Late payment interest param (NC Art. 20.4.2) ──────────────────────────
-- Interest = 6M EURIBOR + 3.0%, on 360-day basis

INSERT INTO system_params (key, value, description) VALUES
  ('euribor_6m_pct',
   '{"value": 2.64, "unit": "pct", "label": "6M EURIBOR (%)"}',
   'Current 6-month EURIBOR rate for late payment interest calculation. '
   'Update quarterly. Source: ECB. As of March 2026: ~2.64%.'),
  ('late_payment_spread_pct',
   '{"value": 3.0, "unit": "pct", "label": "Late payment spread (%)"}',
   'NC Art.20.4.2: fixed spread over 6M EURIBOR for overdue invoices. '
   'Total rate = euribor_6m_pct + 3.0%, on 360-day basis.'),
  ('late_payment_day_basis',
   '{"value": 360, "unit": "days", "label": "Interest day basis"}',
   'NC Art.20.4.2: interest accrues on actual days elapsed / 360-day year.')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at  = NOW();

-- ── 8. Invoices: add separate capacity entry/exit fee columns ─────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cap_entry_kwh_h      NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS cap_exit_kwh_h        NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS cap_entry_fee_eur     NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS cap_exit_fee_eur      NUMERIC(18,4),
  ADD COLUMN IF NOT EXISTS fuel_gas_kwh          NUMERIC(18,2),  -- actual FG in kWh
  ADD COLUMN IF NOT EXISTS fuel_gas_volume_nm3   NUMERIC(18,2),  -- FG volume Nm³
  ADD COLUMN IF NOT EXISTS late_payment_days     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_payment_eur      NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flow_direction        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS erp_ref              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS erp_synced_at        TIMESTAMPTZ;

-- Back-fill: split existing capacity_fee_eur evenly (transit 65% entry / 35% exit split)
-- Proper split ratio: entry 4.19 / total 11.04 = 38%, exit 6.85 / 11.04 = 62%
UPDATE invoices
SET cap_entry_fee_eur = ROUND(capacity_fee_eur * (4.19 / 11.04), 4),
    cap_exit_fee_eur  = ROUND(capacity_fee_eur * (6.85 / 11.04), 4)
WHERE capacity_fee_eur IS NOT NULL
  AND cap_entry_fee_eur IS NULL;

-- ── 9. View: monthly statement (NC Art. 20.1) ─────────────────────────────────

CREATE OR REPLACE VIEW v_monthly_statement AS
SELECT
  i.invoice_no,
  i.shipper_id,
  s.name                              AS shipper_name,
  s.code                              AS shipper_code,
  i.period_from,
  i.period_to,
  i.billing_days,
  -- Capacity (take-or-pay)
  COALESCE(i.cap_entry_kwh_h, i.capacity_kwh_h)  AS cap_entry_kwh_h,
  COALESCE(i.cap_exit_kwh_h,  i.capacity_kwh_h)  AS cap_exit_kwh_h,
  COALESCE(i.cap_entry_fee_eur,
           i.capacity_fee_eur * 4.19 / 11.04)    AS cap_entry_fee_eur,
  COALESCE(i.cap_exit_fee_eur,
           i.capacity_fee_eur * 6.85 / 11.04)    AS cap_exit_fee_eur,
  i.capacity_fee_eur,
  -- Allocated quantities
  i.allocated_kwh,
  i.volume_mwh * 1000                            AS allocated_kwh_v2,
  -- Fuel gas
  i.fuel_gas_volume_mwh,
  i.fuel_gas_kwh,
  i.fuel_gas_amount_eur,
  -- Balancing
  i.balancing_gas_mwh,
  i.balancing_gas_eur,
  -- Totals
  i.total_amount_eur,
  i.late_payment_eur,
  i.total_amount_eur + COALESCE(i.late_payment_eur, 0) AS total_due_eur,
  -- Invoice metadata
  i.status,
  i.due_date,
  i.paid_at,
  i.flow_direction,
  i.created_at                                   AS invoice_date
FROM invoices i
JOIN shippers s ON s.id = i.shipper_id;

-- ── 10. Index on gas_quality_daily ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gas_quality_year_month
  ON gas_quality_daily (EXTRACT(YEAR FROM gas_day), EXTRACT(MONTH FROM gas_day), point_code);
