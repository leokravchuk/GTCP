-- Migration 025: Interruptible auctions + auction_rounds seed
-- Closes compliance gap G-08 (Interruptible auctions missing from seed)

-- ── Interruptible Daily auctions (Art.7.4.3 — 1 hour after Daily Firm, D-1) ──
-- Only recent + upcoming months (Apr-Sep 2026)
INSERT INTO auction_calendar
  (point_code, product_type, capacity_type, gas_year, auction_start_date, auction_end_date,
   delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h, notes)
VALUES
  -- Apr 2026 (30d) — interruptible daily auctions run D-1
  ('KIREVO-ENTRY', 'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-14 16:30+00', '2026-04-14 17:30+00', '2026-04-15', '2026-04-16', 'CLOSED', 'Art.7.4.3.4', 0.0329, 'Interruptible Daily D-1'),
  ('HORGOS-EXIT',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-14 16:30+00', '2026-04-14 17:30+00', '2026-04-15', '2026-04-16', 'CLOSED', 'Art.7.4.3.4', 0.0375, 'Interruptible Daily D-1'),
  ('EXIT-SERBIA',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-14 16:30+00', '2026-04-14 17:30+00', '2026-04-15', '2026-04-16', 'CLOSED', 'Art.7.4.3.4', 0.0230, 'Interruptible Daily D-1'),
  -- Today
  ('KIREVO-ENTRY', 'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-18 16:30+00', '2026-04-18 17:30+00', '2026-04-19', '2026-04-20', 'CLOSED', 'Art.7.4.3.4', 0.0329, 'Interruptible Daily D-1'),
  ('HORGOS-EXIT',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-18 16:30+00', '2026-04-18 17:30+00', '2026-04-19', '2026-04-20', 'CLOSED', 'Art.7.4.3.4', 0.0375, 'Interruptible Daily D-1'),
  ('EXIT-SERBIA',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-18 16:30+00', '2026-04-18 17:30+00', '2026-04-19', '2026-04-20', 'CLOSED', 'Art.7.4.3.4', 0.0230, 'Interruptible Daily D-1'),
  -- Tomorrow
  ('KIREVO-ENTRY', 'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-19 16:30+00', '2026-04-19 17:30+00', '2026-04-20', '2026-04-21', 'UPCOMING', 'Art.7.4.3.4', 0.0329, 'Interruptible Daily D-1'),
  ('HORGOS-EXIT',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-19 16:30+00', '2026-04-19 17:30+00', '2026-04-20', '2026-04-21', 'UPCOMING', 'Art.7.4.3.4', 0.0375, 'Interruptible Daily D-1'),
  ('EXIT-SERBIA',  'DAILY', 'INTERRUPTIBLE', 2025, '2026-04-19 16:30+00', '2026-04-19 17:30+00', '2026-04-20', '2026-04-21', 'UPCOMING', 'Art.7.4.3.4', 0.0230, 'Interruptible Daily D-1')
ON CONFLICT DO NOTHING;

-- ── Yearly Interruptible (Art.7.4.3.1 — 3rd Monday July) ──
INSERT INTO auction_calendar
  (point_code, product_type, capacity_type, gas_year, auction_start_date, auction_end_date,
   delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h, notes)
VALUES
  ('KIREVO-ENTRY', 'YEARLY', 'INTERRUPTIBLE', 2025, '2025-07-20 07:00+00', '2025-07-20 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 6.00, 'Yearly Interruptible'),
  ('HORGOS-EXIT',  'YEARLY', 'INTERRUPTIBLE', 2025, '2025-07-20 07:00+00', '2025-07-20 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 6.85, 'Yearly Interruptible'),
  ('EXIT-SERBIA',  'YEARLY', 'INTERRUPTIBLE', 2025, '2025-07-20 07:00+00', '2025-07-20 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 4.19, 'Yearly Interruptible')
ON CONFLICT DO NOTHING;

-- ── Seed auction_rounds (1 round per auction, at reserve price) ──
-- Architectural readiness for ascending clock (CAM NC Art.17-18)
INSERT INTO auction_rounds (auction_id, round_number, announced_price, available_supply_kwh_h, round_status, round_start, round_end)
SELECT
  ac.id,
  1,
  COALESCE(ac.reserve_price_eur_kwh_h, 0),
  CASE ac.point_code
    WHEN 'KIREVO-ENTRY' THEN 1528049
    WHEN 'HORGOS-EXIT'  THEN 1024024
    WHEN 'EXIT-SERBIA'  THEN 504026
    WHEN 'HORGOS-ENTRY' THEN 9216210
    WHEN 'EXIT-SERBIA-ENTRY' THEN 4536230
    ELSE 0
  END,
  CASE WHEN ac.status = 'CLOSED' THEN 'CLEARANCE' ELSE 'OPEN' END,
  ac.auction_start_date,
  ac.auction_end_date
FROM auction_calendar ac
WHERE NOT EXISTS (SELECT 1 FROM auction_rounds ar WHERE ar.auction_id = ac.id)
ORDER BY ac.id;
