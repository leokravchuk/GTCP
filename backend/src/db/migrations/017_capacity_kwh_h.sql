-- Migration 017: Populate capacity_kwh_h from capacity_mwh_d
-- Purpose: Use native kWh/h column instead of runtime MWh/d × 1000 / 24 conversion
-- NC Reference: §2.1 — capacity always in kWh/h
-- Sprint 16 (09.04.2026)

BEGIN;

-- 0. Add column if not exists (may be missing in older DBs)
ALTER TABLE capacity_bookings ADD COLUMN IF NOT EXISTS capacity_kwh_h NUMERIC(18,2);

-- 1. Backfill capacity_kwh_h from capacity_mwh_d
UPDATE capacity_bookings
SET capacity_kwh_h = ROUND(capacity_mwh_d * 1000.0 / 24.0, 2)
WHERE capacity_mwh_d IS NOT NULL
  AND (capacity_kwh_h IS NULL OR capacity_kwh_h = 0);

-- 2. Drop and recreate v_capacity_available to use capacity_kwh_h directly
DROP VIEW IF EXISTS v_capacity_available;
CREATE VIEW v_capacity_available AS
SELECT
  ip.code AS point_code,
  ip.direction,
  COALESCE(tc.tech_kwh_h, 0) AS tech_kwh_h,
  COALESCE(tc.reserved_kwh_h, 0) AS reserved_kwh_h,
  COALESCE(cb_sum.contracted_kwh_h, 0) AS contracted_kwh_h,
  COALESCE(tc.tech_kwh_h, 0) - COALESCE(cb_sum.contracted_kwh_h, 0) AS available_kwh_h
FROM interconnection_points ip
LEFT JOIN LATERAL (
  SELECT tech_kwh_h, reserved_kwh_h
  FROM capacity_technical
  WHERE point_code = ip.code AND gas_year = '2025/2026'
  LIMIT 1
) tc ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(capacity_kwh_h), 0) AS contracted_kwh_h
  FROM capacity_bookings
  WHERE point = ip.code AND status = 'ACTIVE'
    AND period_from <= CURRENT_DATE AND period_to >= CURRENT_DATE
) cb_sum ON true
WHERE ip.is_active = true;

COMMIT;
