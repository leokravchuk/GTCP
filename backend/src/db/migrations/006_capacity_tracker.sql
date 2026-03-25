-- ============================================================
-- Migration 006 — Capacity Tracker & RBP.EU Free Capacity
-- ============================================================
-- Builds operational capacity vitrine:
--   capacity_technical       → reference: tech/reserved/min_service per IP
--   capacity_surrenders      → surrender events (NC Art. 8.3)
--   v_capacity_contracted    → sum of active contracts per IP × product tier
--   v_capacity_available     → reserved − contracted = free for RBP.EU
--   v_rbp_product_slots      → per-product-tier breakdown (Annual/Q/M/D/WD)
--   v_uioli_daily            → UIOLI: unutilized annual → daily free pool
-- ============================================================

-- ── 1. Technical capacity reference table ─────────────────────────────────────
-- Source: VOLUMES TOTAL.xlsx (Gastrans official transparency data)
-- Three sets: technical (nameplate), reserved (offered market 90%), free_10pct

CREATE TABLE IF NOT EXISTS capacity_technical (
  id               SERIAL       PRIMARY KEY,
  point_code       VARCHAR(50)  NOT NULL REFERENCES interconnection_points(code),
  direction        VARCHAR(5)   NOT NULL CHECK (direction IN ('ENTRY','EXIT')),
  gas_year         VARCHAR(9)   NOT NULL DEFAULT '2025/2026',
  -- Technical (nameplate) capacity
  tech_kwh_h       NUMERIC(18,0) NOT NULL,   -- full technical
  -- Reserved for market (offered via RBP.EU auctions, CAM NC Art. 8)
  reserved_kwh_h   NUMERIC(18,0) NOT NULL,   -- = tech × 0.90 (standard regulatory minimum)
  -- Minimum service capacity (not offered, held back for operational safety)
  min_service_kwh_h NUMERIC(18,0) NOT NULL,  -- = tech − reserved
  -- Effective date
  valid_from       DATE         NOT NULL DEFAULT '2025-10-01',
  valid_to         DATE,
  source           TEXT,
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (point_code, gas_year, direction)
);

-- Seed from VOLUMES TOTAL.xlsx — Gastrans GY2025/2026 transparency data
-- Entry Kirevo: single physical entry from Bulgaria (GMS-1)
-- Exit Horgoš:  transit to Hungary (GMS Kiskundorozsma 2)
-- Exit Serbia:  integrated domestic (GMS-2/3/4), = Entry − Exit Horgoš residual

INSERT INTO capacity_technical
  (point_code, direction, gas_year, tech_kwh_h, reserved_kwh_h, min_service_kwh_h, valid_from, source)
VALUES
  ('KIREVO-ENTRY', 'ENTRY', '2025/2026',
   15280488, 13752230, 1528258,
   '2025-10-01',
   'VOLUMES TOTAL.xlsx — Gastrans transparency, Oct 2025. Reserved=13,752,230 (confirmed)'),
  ('HORGOS-EXIT',  'EXIT',  '2025/2026',
   10240233, 9216209,  1024024,
   '2025-10-01',
   'VOLUMES TOTAL.xlsx — Gastrans transparency, Oct 2025. Reserved=9,216,209 (confirmed)'),
  ('EXIT-SERBIA',  'EXIT',  '2025/2026',
   5040256,  4536021,  504235,
   '2025-10-01',
   'VOLUMES TOTAL.xlsx — derived: Entry 13,752,230 − Horgoš 9,216,209 = 4,536,021. '
   'Represents GMS-2 Paraćin + GMS-3 Pančevo + GMS-4 Gospođinci combined.')
ON CONFLICT (point_code, gas_year, direction) DO UPDATE
  SET tech_kwh_h        = EXCLUDED.tech_kwh_h,
      reserved_kwh_h    = EXCLUDED.reserved_kwh_h,
      min_service_kwh_h = EXCLUDED.min_service_kwh_h,
      source            = EXCLUDED.source,
      updated_at        = NOW();

-- ── 2. Capacity surrenders table (NC Art. 8.3) ───────────────────────────────
-- When shipper surrenders capacity back to TSO:
--   - Gastrans re-offers on RBP.EU
--   - If re-auction price < reserve → "uncovered auction premium" charged to original shipper

CREATE TABLE IF NOT EXISTS capacity_surrenders (
  id               SERIAL       PRIMARY KEY,
  contract_id      INTEGER      NOT NULL,   -- references contracts(id) but kept as INT for flex
  surrender_ref    VARCHAR(50)  NOT NULL UNIQUE,
  point_code       VARCHAR(50)  NOT NULL,
  direction        VARCHAR(5)   NOT NULL,
  product_type     VARCHAR(30)  NOT NULL,   -- ANNUAL_FIRM / QUARTERLY_FIRM / MONTHLY_FIRM / DAILY_FIRM
  -- Quantities
  surrendered_kwh_h NUMERIC(18,2) NOT NULL, -- capacity surrendered
  period_from      DATE         NOT NULL,
  period_to        DATE         NOT NULL,
  -- RBP.EU re-auction result
  status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','OFFERED_RBP','SOLD','UNSOLD','PARTIAL')),
  rbp_listing_ref  VARCHAR(100),            -- RBP.EU lot ID for re-offer
  resale_price_eur_kwh_h NUMERIC(12,6),     -- final resale price (if sold)
  reserve_price_eur_kwh_h NUMERIC(12,6),    -- = official tariff from AERS
  -- Auction Premium calculation (NC Art. 8.3)
  auction_premium_eur      NUMERIC(15,4),   -- reserve × qty × days − resale × qty × days
  uncovered_premium_eur    NUMERIC(15,4),   -- portion charged back to original shipper
  -- Metadata
  surrendered_by   UUID,
  surrendered_at   TIMESTAMPTZ  DEFAULT NOW(),
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surrenders_contract   ON capacity_surrenders (contract_id);
CREATE INDEX IF NOT EXISTS idx_surrenders_point_period ON capacity_surrenders (point_code, period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_surrenders_status     ON capacity_surrenders (status);

-- ── 3. View: contracted capacity per IP × product tier × period ───────────────
-- Aggregates from contracts table (migration 003/004/005 schema)
-- Used by the tracker to compute "what's already sold"

CREATE OR REPLACE VIEW v_capacity_contracted AS
WITH product_caps AS (
  SELECT
    c.entry_point_code                        AS entry_point,
    c.exit_point_code                         AS exit_point,
    c.flow_direction,
    c.contract_type,
    c.booking_period,
    c.status,
    c.start_date,
    c.end_date,
    -- Use split capacities from migration 005 where available, fallback to legacy
    COALESCE(c.cap_entry_kwh_h, c.capacity_kwh_h / 24.0, 0)  AS cap_entry_kwh_h,
    COALESCE(c.cap_exit_kwh_h,
             CASE c.flow_direction
               WHEN 'GOSPODJINCI_HORGOS' THEN c.capacity_kwh_h / 24.0 * 0.67
               ELSE c.capacity_kwh_h / 24.0
             END, 0)                                          AS cap_exit_kwh_h,
    -- Classify product tier for the tracker
    CASE c.contract_type
      WHEN 'TSA_FIRM_ANNUAL'        THEN 'ANNUAL'
      WHEN 'TSA_FIRM_QUARTERLY'     THEN 'QUARTERLY'
      WHEN 'TSA_FIRM_MONTHLY'       THEN 'MONTHLY'
      WHEN 'TSA_FIRM_DAILY'         THEN 'DAILY'
      WHEN 'TSA_FIRM_WITHIN_DAY'    THEN 'WITHIN_DAY'
      WHEN 'TSA_INTERRUPTIBLE'      THEN 'INTERRUPTIBLE'
      WHEN 'TSA_COMMERCIAL_REVERSE' THEN 'COMMERCIAL_REVERSE'
      ELSE 'OTHER'
    END                                                       AS product_tier,
    c.id                                                      AS contract_id
  FROM contracts c
  WHERE c.status = 'ACTIVE'
    AND c.start_date <= CURRENT_DATE
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
)
SELECT
  entry_point,
  exit_point,
  flow_direction,
  product_tier,
  COUNT(*)                           AS contract_count,
  SUM(cap_entry_kwh_h)               AS contracted_entry_kwh_h,
  SUM(cap_exit_kwh_h)                AS contracted_exit_kwh_h,
  MIN(start_date)                    AS earliest_start,
  MAX(end_date)                      AS latest_end,
  ARRAY_AGG(contract_id)             AS contract_ids
FROM product_caps
GROUP BY entry_point, exit_point, flow_direction, product_tier;

-- ── 4. View: available capacity per IP (tracker main view) ───────────────────
-- Formula:
--   free_entry = reserved_entry − Σ(contracted_entry across ALL firm product tiers)
--   free_exit  = reserved_exit  − Σ(contracted_exit  across ALL firm product tiers)
--   pct_used   = contracted / reserved × 100

CREATE OR REPLACE VIEW v_capacity_available AS
WITH contracted AS (
  -- Aggregate contracted capacity per entry/exit point (all firm products combined)
  SELECT
    entry_point                        AS point_code,
    'ENTRY'                            AS direction,
    SUM(contracted_entry_kwh_h)        AS contracted_kwh_h
  FROM v_capacity_contracted
  WHERE product_tier NOT IN ('COMMERCIAL_REVERSE','INTERRUPTIBLE')
  GROUP BY entry_point
  UNION ALL
  SELECT
    exit_point                         AS point_code,
    'EXIT'                             AS direction,
    SUM(contracted_exit_kwh_h)         AS contracted_kwh_h
  FROM v_capacity_contracted
  WHERE product_tier NOT IN ('COMMERCIAL_REVERSE','INTERRUPTIBLE')
  GROUP BY exit_point
),
surrendered AS (
  -- Subtract surrendered capacity from "taken" (it's now free again)
  SELECT
    point_code,
    direction,
    SUM(surrendered_kwh_h)            AS surrendered_kwh_h
  FROM capacity_surrenders
  WHERE status IN ('OFFERED_RBP','SOLD','UNSOLD','PARTIAL')
    AND period_from <= CURRENT_DATE
    AND period_to   >= CURRENT_DATE
  GROUP BY point_code, direction
)
SELECT
  ct.point_code,
  ct.direction,
  ip.name                                                   AS point_name,
  ct.gas_year,
  -- Technical
  ct.tech_kwh_h,
  ct.reserved_kwh_h,
  ct.min_service_kwh_h,
  -- Contracted (from active GTA contracts)
  COALESCE(c.contracted_kwh_h, 0)                           AS contracted_kwh_h,
  -- Surrendered back to market
  COALESCE(s.surrendered_kwh_h, 0)                          AS surrendered_kwh_h,
  -- NET free = reserved − contracted + surrendered
  GREATEST(0,
    ct.reserved_kwh_h
    - COALESCE(c.contracted_kwh_h, 0)
    + COALESCE(s.surrendered_kwh_h, 0)
  )                                                         AS free_kwh_h,
  -- Percentages
  ROUND(
    COALESCE(c.contracted_kwh_h, 0)
    / NULLIF(ct.reserved_kwh_h, 0) * 100, 2
  )                                                         AS contracted_pct,
  ROUND(
    GREATEST(0, ct.reserved_kwh_h - COALESCE(c.contracted_kwh_h, 0))
    / NULLIF(ct.reserved_kwh_h, 0) * 100, 2
  )                                                         AS free_pct,
  -- EUR value of free capacity (annual tariff × free_kwh_h)
  CASE
    WHEN ct.point_code = 'KIREVO-ENTRY' THEN
      ROUND(GREATEST(0, ct.reserved_kwh_h - COALESCE(c.contracted_kwh_h,0)) * 6.00, 0)
    WHEN ct.point_code = 'HORGOS-EXIT'  THEN
      ROUND(GREATEST(0, ct.reserved_kwh_h - COALESCE(c.contracted_kwh_h,0)) * 6.85, 0)
    WHEN ct.point_code = 'EXIT-SERBIA'  THEN
      ROUND(GREATEST(0, ct.reserved_kwh_h - COALESCE(c.contracted_kwh_h,0)) * 4.19, 0)
    ELSE NULL
  END                                                       AS free_annual_value_eur,
  ct.source
FROM capacity_technical ct
JOIN interconnection_points ip ON ip.code = ct.point_code
LEFT JOIN contracted c  ON c.point_code  = ct.point_code AND c.direction = ct.direction
LEFT JOIN surrendered s ON s.point_code  = ct.point_code AND s.direction = ct.direction
WHERE ct.valid_from <= CURRENT_DATE
  AND (ct.valid_to IS NULL OR ct.valid_to >= CURRENT_DATE);

-- ── 5. View: RBP.EU product slots — per IP × product tier ────────────────────
-- Shows for each product tier (Annual/Q/M/D/WD) how much is contracted and free
-- This is what Gastrans would publish on RBP.EU transparency portal

CREATE OR REPLACE VIEW v_rbp_product_slots AS
WITH tiers AS (
  -- All combinations: each IP × each product tier
  SELECT ip.code AS point_code, ip.direction, t.tier
  FROM interconnection_points ip
  CROSS JOIN (VALUES
    ('ANNUAL'), ('QUARTERLY'), ('MONTHLY'), ('DAILY'), ('WITHIN_DAY')
  ) AS t(tier)
  WHERE ip.code IN ('KIREVO-ENTRY','HORGOS-EXIT','EXIT-SERBIA')
    AND ip.is_active = TRUE
),
tech AS (
  SELECT point_code, direction, gas_year, reserved_kwh_h
  FROM capacity_technical
  WHERE valid_from <= CURRENT_DATE
    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
),
-- UIOLI stacking: capacity used by longer-duration contracts reduces what's available
-- for shorter-duration products AT THE SAME IP
contracted_by_tier AS (
  SELECT
    entry_point                AS point_code,
    'ENTRY'                    AS direction,
    product_tier,
    SUM(contracted_entry_kwh_h) AS contracted_kwh_h
  FROM v_capacity_contracted
  WHERE product_tier NOT IN ('COMMERCIAL_REVERSE','INTERRUPTIBLE','OTHER')
  GROUP BY entry_point, product_tier
  UNION ALL
  SELECT
    exit_point                 AS point_code,
    'EXIT'                     AS direction,
    product_tier,
    SUM(contracted_exit_kwh_h) AS contracted_kwh_h
  FROM v_capacity_contracted
  WHERE product_tier NOT IN ('COMMERCIAL_REVERSE','INTERRUPTIBLE','OTHER')
  GROUP BY exit_point, product_tier
)
SELECT
  ti.point_code,
  ti.direction,
  ip.name                                            AS point_name,
  ti.tier                                            AS product_tier,
  -- Standard auction window (CAM NC Art. 9 / 11 / 12)
  CASE ti.tier
    WHEN 'ANNUAL'     THEN 'D-365 (Aug prev year)'
    WHEN 'QUARTERLY'  THEN 'D-90  (3 months before)'
    WHEN 'MONTHLY'    THEN 'D-21  (3 weeks before)'
    WHEN 'DAILY'      THEN 'D-1   (09:00 CET)'
    WHEN 'WITHIN_DAY' THEN 'H+1   (rolling intraday)'
  END                                                AS auction_window,
  -- Allocation mechanism
  CASE ti.tier
    WHEN 'ANNUAL'     THEN 'Price-competitive auction'
    WHEN 'QUARTERLY'  THEN 'Price-competitive auction'
    WHEN 'MONTHLY'    THEN 'Price-competitive auction'
    WHEN 'DAILY'      THEN 'FCFS (first-come-first-served)'
    WHEN 'WITHIN_DAY' THEN 'FCFS (first-come-first-served)'
  END                                                AS allocation_mechanism,
  -- Reserved (base for this tier)
  COALESCE(te.reserved_kwh_h, 0)                    AS reserved_kwh_h,
  -- Already contracted in this tier
  COALESCE(ct.contracted_kwh_h, 0)                  AS contracted_this_tier_kwh_h,
  -- Total contracted across ALL longer tiers (annual blocks daily too)
  -- UIOLI: daily free = reserved - SUM(annual+quarterly+monthly contracted)
  COALESCE(
    (SELECT SUM(cbt2.contracted_kwh_h)
     FROM contracted_by_tier cbt2
     WHERE cbt2.point_code = ti.point_code
       AND cbt2.direction  = ti.direction
       AND CASE ti.tier
             WHEN 'WITHIN_DAY' THEN TRUE  -- all tiers consume within-day
             WHEN 'DAILY'      THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY','MONTHLY','DAILY')
             WHEN 'MONTHLY'    THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY','MONTHLY')
             WHEN 'QUARTERLY'  THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY')
             WHEN 'ANNUAL'     THEN cbt2.product_tier = 'ANNUAL'
           END
    ), 0
  )                                                  AS contracted_all_higher_kwh_h,
  -- Free for THIS product tier (UIOLI stacking)
  GREATEST(0,
    COALESCE(te.reserved_kwh_h, 0) -
    COALESCE(
      (SELECT SUM(cbt2.contracted_kwh_h)
       FROM contracted_by_tier cbt2
       WHERE cbt2.point_code = ti.point_code
         AND cbt2.direction  = ti.direction
         AND CASE ti.tier
               WHEN 'WITHIN_DAY' THEN TRUE
               WHEN 'DAILY'      THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY','MONTHLY','DAILY')
               WHEN 'MONTHLY'    THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY','MONTHLY')
               WHEN 'QUARTERLY'  THEN cbt2.product_tier IN ('ANNUAL','QUARTERLY')
               WHEN 'ANNUAL'     THEN cbt2.product_tier = 'ANNUAL'
             END
      ), 0)
  )                                                  AS free_kwh_h,
  te.gas_year
FROM tiers ti
JOIN interconnection_points ip ON ip.code = ti.point_code
LEFT JOIN tech te ON te.point_code = ti.point_code AND te.direction = ti.direction
LEFT JOIN contracted_by_tier ct ON ct.point_code = ti.point_code
                                AND ct.direction  = ti.direction
                                AND ct.product_tier = ti.tier;

-- ── 6. View: UIOLI daily free pool ────────────────────────────────────────────
-- CAM NC Art. 13-16: use-it-or-lose-it
-- If annual shipper doesn't nominate → that day's capacity goes to daily pool
-- This view estimates UIOLI contribution from the last 30 days

CREATE OR REPLACE VIEW v_uioli_daily AS
WITH daily_nominations AS (
  -- Sum of nominated quantities per IP per gas day
  SELECT
    n.gas_day,
    md.point_code,
    md.direction,
    SUM(md.nominated_kwh) AS nominated_kwh
  FROM nominations n
  JOIN mdap_daily md ON md.contract_id IN (
    SELECT id FROM contracts WHERE status = 'ACTIVE'
  ) AND md.gas_day = n.gas_day
  WHERE n.gas_day >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY n.gas_day, md.point_code, md.direction
),
contracted_daily AS (
  -- What annual+quarterly+monthly holders have contracted (converted to kWh/day)
  SELECT
    entry_point  AS point_code,
    'ENTRY'      AS direction,
    SUM(contracted_entry_kwh_h) * 24  AS contracted_kwh_day
  FROM v_capacity_contracted
  WHERE product_tier IN ('ANNUAL','QUARTERLY','MONTHLY')
  GROUP BY entry_point
  UNION ALL
  SELECT
    exit_point   AS point_code,
    'EXIT'       AS direction,
    SUM(contracted_exit_kwh_h) * 24  AS contracted_kwh_day
  FROM v_capacity_contracted
  WHERE product_tier IN ('ANNUAL','QUARTERLY','MONTHLY')
  GROUP BY exit_point
)
SELECT
  dn.gas_day,
  dn.point_code,
  dn.direction,
  COALESCE(cd.contracted_kwh_day, 0)                   AS contracted_kwh_day,
  COALESCE(dn.nominated_kwh, 0)                        AS nominated_kwh,
  GREATEST(0,
    COALESCE(cd.contracted_kwh_day, 0)
    - COALESCE(dn.nominated_kwh, 0)
  )                                                     AS uioli_free_kwh,
  CASE
    WHEN cd.contracted_kwh_day > 0 THEN
      ROUND(
        (cd.contracted_kwh_day - COALESCE(dn.nominated_kwh,0))
        / cd.contracted_kwh_day * 100, 2
      )
    ELSE 0
  END                                                   AS uioli_pct,
  -- Convert to kWh/h for consistency with capacity tracker
  GREATEST(0,
    COALESCE(cd.contracted_kwh_day,0) - COALESCE(dn.nominated_kwh,0)
  ) / 24.0                                              AS uioli_free_kwh_h
FROM daily_nominations dn
LEFT JOIN contracted_daily cd
  ON cd.point_code = dn.point_code AND cd.direction = dn.direction;

-- ── 7. Surrender: stored procedure for initiating surrender ──────────────────
CREATE OR REPLACE FUNCTION fn_create_surrender(
  p_contract_id    INTEGER,
  p_surrendered_kwh_h NUMERIC,
  p_period_from    DATE,
  p_period_to      DATE,
  p_user_id        UUID
) RETURNS TABLE (
  surrender_ref    VARCHAR,
  auction_premium  NUMERIC,
  status           VARCHAR
) LANGUAGE plpgsql AS $$
DECLARE
  v_ref            VARCHAR(50);
  v_point          VARCHAR(50);
  v_direction      VARCHAR(5);
  v_product        VARCHAR(30);
  v_tariff         NUMERIC;
  v_days           INTEGER;
  v_premium        NUMERIC;
BEGIN
  -- Generate surrender reference
  v_ref := 'SRR-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(CAST(
              (SELECT COUNT(*)+1 FROM capacity_surrenders
               WHERE EXTRACT(YEAR FROM surrendered_at) = EXTRACT(YEAR FROM NOW()))
            AS TEXT), 3, '0');

  -- Fetch contract data
  SELECT
    CASE flow_direction
      WHEN 'GOSPODJINCI_HORGOS' THEN 'KIREVO-ENTRY'
      WHEN 'HORGOS_GOSPODJINCI' THEN 'HORGOS-ENTRY'
      WHEN 'KIREVO_EXIT_SERBIA' THEN 'KIREVO-ENTRY'
    END,
    CASE flow_direction
      WHEN 'GOSPODJINCI_HORGOS' THEN 'ENTRY'
      WHEN 'HORGOS_GOSPODJINCI' THEN 'ENTRY'
      WHEN 'KIREVO_EXIT_SERBIA' THEN 'ENTRY'
    END,
    contract_type,
    COALESCE(tariff_entry_eur_kwh_h, 4.19)
  INTO v_point, v_direction, v_product, v_tariff
  FROM contracts WHERE id = p_contract_id;

  v_days := p_period_to - p_period_from + 1;
  -- Auction Premium estimate: tariff × capacity × days/365
  v_premium := ROUND(p_surrendered_kwh_h * v_tariff / 365 * v_days, 2);

  INSERT INTO capacity_surrenders (
    contract_id, surrender_ref, point_code, direction, product_type,
    surrendered_kwh_h, period_from, period_to,
    status, reserve_price_eur_kwh_h, auction_premium_eur,
    surrendered_by
  ) VALUES (
    p_contract_id, v_ref, v_point, v_direction, v_product,
    p_surrendered_kwh_h, p_period_from, p_period_to,
    'PENDING', v_tariff, v_premium,
    p_user_id
  );

  RETURN QUERY SELECT v_ref, v_premium, 'PENDING'::VARCHAR;
END;
$$;

-- ── 8. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cap_tech_point
  ON capacity_technical (point_code, direction, gas_year);
