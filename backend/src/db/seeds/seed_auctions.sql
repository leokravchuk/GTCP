-- ============================================================
-- GTCP Auction Calendar Seed -- GY2025/2026
-- Source: MAR0277-24 ENTSOG + NC Gastrans Art.7
-- ============================================================

BEGIN;

-- === YEARLY FIRM (Art.7.4.2.1) -- 1st Monday July ===
-- NC Art.7.1.2: ONLY if LT surrendered. In our scenario: no surrenders.
INSERT INTO auction_calendar (product_type, capacity_type, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, notes) VALUES
('YEARLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2025-07-07 07:00+00', '2025-07-07 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 'No LT surrendered'),
('YEARLY', 'FIRM', 'HORGOS-EXIT',  2025, '2025-07-07 07:00+00', '2025-07-07 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 'No LT surrendered'),
('YEARLY', 'FIRM', 'EXIT-SERBIA',  2025, '2025-07-07 07:00+00', '2025-07-07 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.1+7.1.2', 'No LT surrendered');

-- === CR YEARLY (Art.7.4.3.1) -- 3rd Monday July ===
INSERT INTO auction_calendar (product_type, capacity_type, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('YEARLY', 'COMMERCIAL_REVERSE', 'HORGOS-ENTRY',     2025, '2025-07-21 07:00+00', '2025-07-21 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 3.25),
('YEARLY', 'COMMERCIAL_REVERSE', 'EXIT-SERBIA-ENTRY', 2025, '2025-07-21 07:00+00', '2025-07-21 16:00+00', '2025-10-01', '2026-10-01', 'CLOSED', 'Art.7.4.3.1', 1.99);

-- === QUARTERLY FIRM (Art.7.4.2.2) -- 4 rounds ===
-- Round 1: 1st Mon Aug (Q1+Q2+Q3+Q4)
INSERT INTO auction_calendar (product_type, capacity_type, auction_round, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('QUARTERLY', 'FIRM', 1, 'KIREVO-ENTRY', 2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 1.81),
('QUARTERLY', 'FIRM', 1, 'KIREVO-ENTRY', 2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.78),
('QUARTERLY', 'FIRM', 1, 'KIREVO-ENTRY', 2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80),
('QUARTERLY', 'FIRM', 1, 'KIREVO-ENTRY', 2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81),
('QUARTERLY', 'FIRM', 1, 'HORGOS-EXIT',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 2.07),
('QUARTERLY', 'FIRM', 1, 'HORGOS-EXIT',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 2.03),
('QUARTERLY', 'FIRM', 1, 'HORGOS-EXIT',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05),
('QUARTERLY', 'FIRM', 1, 'HORGOS-EXIT',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07),
('QUARTERLY', 'FIRM', 1, 'EXIT-SERBIA',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2025-10-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.2', 1.27),
('QUARTERLY', 'FIRM', 1, 'EXIT-SERBIA',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.24),
('QUARTERLY', 'FIRM', 1, 'EXIT-SERBIA',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25),
('QUARTERLY', 'FIRM', 1, 'EXIT-SERBIA',  2025, '2025-08-04 07:00+00', '2025-08-04 16:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27);

-- Round 2: 1st Mon Nov (Q2+Q3+Q4)
INSERT INTO auction_calendar (product_type, capacity_type, auction_round, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('QUARTERLY', 'FIRM', 2, 'KIREVO-ENTRY', 2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.78),
('QUARTERLY', 'FIRM', 2, 'KIREVO-ENTRY', 2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80),
('QUARTERLY', 'FIRM', 2, 'KIREVO-ENTRY', 2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81),
('QUARTERLY', 'FIRM', 2, 'HORGOS-EXIT',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 2.03),
('QUARTERLY', 'FIRM', 2, 'HORGOS-EXIT',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05),
('QUARTERLY', 'FIRM', 2, 'HORGOS-EXIT',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07),
('QUARTERLY', 'FIRM', 2, 'EXIT-SERBIA',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-01-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.2', 1.24),
('QUARTERLY', 'FIRM', 2, 'EXIT-SERBIA',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25),
('QUARTERLY', 'FIRM', 2, 'EXIT-SERBIA',  2025, '2025-11-03 08:00+00', '2025-11-03 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27);

-- Round 3: 1st Mon Feb (Q3+Q4)
INSERT INTO auction_calendar (product_type, capacity_type, auction_round, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('QUARTERLY', 'FIRM', 3, 'KIREVO-ENTRY', 2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.80),
('QUARTERLY', 'FIRM', 3, 'KIREVO-ENTRY', 2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.81),
('QUARTERLY', 'FIRM', 3, 'HORGOS-EXIT',  2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 2.05),
('QUARTERLY', 'FIRM', 3, 'HORGOS-EXIT',  2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 2.07),
('QUARTERLY', 'FIRM', 3, 'EXIT-SERBIA',  2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-04-01', '2026-07-01', 'CLOSED', 'Art.7.4.2.2', 1.25),
('QUARTERLY', 'FIRM', 3, 'EXIT-SERBIA',  2025, '2026-02-02 08:00+00', '2026-02-02 17:00+00', '2026-07-01', '2026-10-01', 'CLOSED', 'Art.7.4.2.2', 1.27);

-- Round 4: 1st Mon May (Q4 only)
INSERT INTO auction_calendar (product_type, capacity_type, auction_round, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('QUARTERLY', 'FIRM', 4, 'KIREVO-ENTRY', 2025, '2026-05-04 07:00+00', '2026-05-04 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 1.81),
('QUARTERLY', 'FIRM', 4, 'HORGOS-EXIT',  2025, '2026-05-04 07:00+00', '2026-05-04 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 2.07),
('QUARTERLY', 'FIRM', 4, 'EXIT-SERBIA',  2025, '2026-05-04 07:00+00', '2026-05-04 16:00+00', '2026-07-01', '2026-10-01', 'UPCOMING', 'Art.7.4.2.2', 1.27);

-- === MONTHLY FIRM (Art.7.4.2.3) -- 3rd Monday M-1 ===
-- Oct-Mar delivery: CLOSED, Apr: OPEN, May+: UPCOMING
INSERT INTO auction_calendar (product_type, capacity_type, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
-- Oct 2025 (31d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2025-09-15 07:00+00', '2025-09-15 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.66),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2025-09-15 07:00+00', '2025-09-15 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.76),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2025-09-15 07:00+00', '2025-09-15 16:00+00', '2025-10-01', '2025-11-01', 'CLOSED', 'Art.7.4.2.3', 0.46),
-- Nov 2025 (30d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2025-10-20 07:00+00', '2025-10-20 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.64),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2025-10-20 07:00+00', '2025-10-20 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.73),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2025-10-20 07:00+00', '2025-10-20 16:00+00', '2025-11-01', '2025-12-01', 'CLOSED', 'Art.7.4.2.3', 0.45),
-- Dec 2025 (31d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2025-11-17 08:00+00', '2025-11-17 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.66),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2025-11-17 08:00+00', '2025-11-17 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.76),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2025-11-17 08:00+00', '2025-11-17 17:00+00', '2025-12-01', '2026-01-01', 'CLOSED', 'Art.7.4.2.3', 0.46),
-- Jan 2026 (31d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2025-12-15 08:00+00', '2025-12-15 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.66),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2025-12-15 08:00+00', '2025-12-15 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.76),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2025-12-15 08:00+00', '2025-12-15 17:00+00', '2026-01-01', '2026-02-01', 'CLOSED', 'Art.7.4.2.3', 0.46),
-- Feb 2026 (28d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-01-19 08:00+00', '2026-01-19 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.60),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-01-19 08:00+00', '2026-01-19 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.68),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-01-19 08:00+00', '2026-01-19 17:00+00', '2026-02-01', '2026-03-01', 'CLOSED', 'Art.7.4.2.3', 0.42),
-- Mar 2026 (31d)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-02-16 08:00+00', '2026-02-16 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.66),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-02-16 08:00+00', '2026-02-16 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.76),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-02-16 08:00+00', '2026-02-16 17:00+00', '2026-03-01', '2026-04-01', 'CLOSED', 'Art.7.4.2.3', 0.46),
-- Apr 2026 (30d) -- OPEN (current)
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-03-16 08:00+00', '2026-03-16 17:00+00', '2026-04-01', '2026-05-01', 'OPEN', 'Art.7.4.2.3', 0.64),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-03-16 08:00+00', '2026-03-16 17:00+00', '2026-04-01', '2026-05-01', 'OPEN', 'Art.7.4.2.3', 0.73),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-03-16 08:00+00', '2026-03-16 17:00+00', '2026-04-01', '2026-05-01', 'OPEN', 'Art.7.4.2.3', 0.45),
-- May 2026 (31d) -- UPCOMING
('MONTHLY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-04-20 07:00+00', '2026-04-20 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.66),
('MONTHLY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-04-20 07:00+00', '2026-04-20 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.76),
('MONTHLY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-04-20 07:00+00', '2026-04-20 16:00+00', '2026-05-01', '2026-06-01', 'UPCOMING', 'Art.7.4.2.3', 0.46);

-- === DAILY FIRM (Art.7.4.2.4) -- D-1, 16:30-17:00 CET ===
-- Seed today + tomorrow as examples
INSERT INTO auction_calendar (product_type, capacity_type, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h) VALUES
('DAILY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-03-30 15:30+00', '2026-03-30 16:00+00', '2026-03-31', '2026-04-01', 'CLOSED', 'Art.7.4.2.4', 0.0329),
('DAILY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-03-30 15:30+00', '2026-03-30 16:00+00', '2026-03-31', '2026-04-01', 'CLOSED', 'Art.7.4.2.4', 0.0375),
('DAILY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-03-30 15:30+00', '2026-03-30 16:00+00', '2026-03-31', '2026-04-01', 'CLOSED', 'Art.7.4.2.4', 0.0230),
('DAILY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-03-31 14:30+00', '2026-03-31 15:00+00', '2026-04-01', '2026-04-02', 'OPEN', 'Art.7.4.2.4', 0.0329),
('DAILY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-03-31 14:30+00', '2026-03-31 15:00+00', '2026-04-01', '2026-04-02', 'OPEN', 'Art.7.4.2.4', 0.0375),
('DAILY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-03-31 14:30+00', '2026-03-31 15:00+00', '2026-04-01', '2026-04-02', 'OPEN', 'Art.7.4.2.4', 0.0230);

-- === WITHIN-DAY (Art.7.4.2.5) -- continuous, not discrete ===
INSERT INTO auction_calendar (product_type, capacity_type, point_code, gas_year, auction_start_date, auction_end_date, delivery_start, delivery_end, status, cam_nc_reference, reserve_price_eur_kwh_h, notes) VALUES
('WITHIN_DAY', 'FIRM', 'KIREVO-ENTRY', 2025, '2026-03-31 05:00+00', '2026-04-01 01:30+00', '2026-03-31', '2026-04-01', 'OPEN', 'Art.7.4.2.5', 0.0021, 'Continuous hourly, 30min bid window'),
('WITHIN_DAY', 'FIRM', 'HORGOS-EXIT',  2025, '2026-03-31 05:00+00', '2026-04-01 01:30+00', '2026-03-31', '2026-04-01', 'OPEN', 'Art.7.4.2.5', 0.0023, 'Continuous hourly, 30min bid window'),
('WITHIN_DAY', 'FIRM', 'EXIT-SERBIA',  2025, '2026-03-31 05:00+00', '2026-04-01 01:30+00', '2026-03-31', '2026-04-01', 'OPEN', 'Art.7.4.2.5', 0.0014, 'Continuous hourly, 30min bid window');

COMMIT;
