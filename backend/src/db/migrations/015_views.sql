-- ============================================================
-- Migration 015 — SQL Views for reporting and validation
-- ============================================================

BEGIN;

-- ── v_capacity_available — free capacity per IP (used by auctions bid validation) ──
CREATE OR REPLACE VIEW v_capacity_available AS
SELECT
  ip.code AS point_code,
  ip.direction,
  COALESCE(tc.tech_kwh_h, 0) AS tech_kwh_h,
  COALESCE(tc.reserved_kwh_h, 0) AS reserved_kwh_h,
  COALESCE(tc.tech_kwh_h, 0) - COALESCE(tc.reserved_kwh_h, 0) AS min_service_kwh_h,
  COALESCE(cb_sum.contracted_kwh_h, 0) AS contracted_kwh_h
FROM interconnection_points ip
LEFT JOIN LATERAL (
  SELECT
    CASE ip.code
      WHEN 'KIREVO-ENTRY' THEN 15280488
      WHEN 'HORGOS-EXIT' THEN 10240233
      WHEN 'EXIT-SERBIA' THEN 5040256
      ELSE 0
    END AS tech_kwh_h,
    CASE ip.code
      WHEN 'KIREVO-ENTRY' THEN 13752230
      WHEN 'HORGOS-EXIT' THEN 9216209
      WHEN 'EXIT-SERBIA' THEN 4536021
      ELSE 0
    END AS reserved_kwh_h
) tc ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(capacity_mwh_d * 1000.0 / 24.0), 0) AS contracted_kwh_h
  FROM capacity_bookings
  WHERE point = ip.code AND status = 'ACTIVE'
    AND period_from <= CURRENT_DATE AND period_to >= CURRENT_DATE
) cb_sum ON true
WHERE ip.is_active = true;

-- ── v_available_credit — per shipper (used by auctions bid credit check) ────
CREATE OR REPLACE VIEW v_available_credit AS
SELECT
  s.id AS shipper_id,
  s.code,
  s.credit_limit,
  s.current_exposure,
  (s.credit_limit - s.current_exposure) AS available_credit_eur
FROM shippers s
WHERE s.is_active = true;

-- ── v_bid_lifecycle — full bid info with auction details ────────────────────
CREATE OR REPLACE VIEW v_bid_lifecycle AS
SELECT
  ab.id AS bid_id,
  ab.auction_calendar_id,
  ab.shipper_id,
  ab.bid_capacity_kwh_h,
  ab.offered_price_eur,
  ab.status AS bid_status,
  ab.won_capacity_kwh_h,
  ab.final_price_eur,
  ab.credit_blocked_eur,
  ab.created_at AS bid_created_at,
  ac.product_type,
  ac.capacity_type,
  ac.point_code,
  ac.status AS auction_status,
  ac.delivery_start,
  ac.delivery_end,
  s.code AS shipper_code,
  s.name AS shipper_name
FROM auction_bids ab
JOIN auction_calendar ac ON ac.id = ab.auction_calendar_id
JOIN shippers s ON s.id = ab.shipper_id;

-- ── v_upcoming_auctions — next auctions per IP ─────────────────────────────
CREATE OR REPLACE VIEW v_upcoming_auctions AS
SELECT
  ac.*,
  EXTRACT(DAY FROM ac.auction_start_date - NOW()) AS days_until_open
FROM auction_calendar ac
WHERE ac.status IN ('UPCOMING', 'OPEN')
  AND ac.delivery_end > NOW()
ORDER BY ac.auction_start_date ASC;

-- ── v_auction_overview — calendar with stats ────────────────────────────────
CREATE OR REPLACE VIEW v_auction_overview AS
SELECT
  ac.*,
  COALESCE(bid_stats.bid_count, 0) AS bid_count,
  COALESCE(bid_stats.total_bid_capacity, 0) AS total_bid_capacity_kwh_h
FROM auction_calendar ac
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS bid_count, COALESCE(SUM(bid_capacity_kwh_h), 0) AS total_bid_capacity
  FROM auction_bids WHERE auction_calendar_id = ac.id
) bid_stats ON true;

COMMIT;
