-- ============================================================
-- Migration 000 — Initial Schema (consolidated from 001–008)
-- Creates all base tables needed before migrations 009+
-- ============================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(64)  NOT NULL UNIQUE,
  email         VARCHAR(255),
  password_hash TEXT         NOT NULL,
  role          VARCHAR(32)  NOT NULL DEFAULT 'dispatcher',
  full_name     VARCHAR(255),
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Shippers ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shippers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(20)  NOT NULL UNIQUE,
  name             VARCHAR(255) NOT NULL,
  country          VARCHAR(64),
  eic_code         VARCHAR(32),
  credit_limit     NUMERIC(18,2) DEFAULT 0,
  current_exposure NUMERIC(18,2) DEFAULT 0,
  is_active        BOOLEAN       DEFAULT true,
  rating_exempt    BOOLEAN       DEFAULT false,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Interconnection Points ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interconnection_points (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(32) NOT NULL UNIQUE,
  name        VARCHAR(255),
  eic_code    VARCHAR(32),
  country     VARCHAR(8),
  direction   VARCHAR(16),
  point_type  VARCHAR(32),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Contracts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_no      VARCHAR(32)  NOT NULL UNIQUE,
  shipper_id       UUID         REFERENCES shippers(id),
  contract_type    VARCHAR(32)  NOT NULL,
  flow_direction   VARCHAR(64),
  nc_route_type    VARCHAR(30),
  entry_point_code VARCHAR(32),
  exit_point_code  VARCHAR(32),
  is_bundled       BOOLEAN DEFAULT false,
  booking_period   VARCHAR(32),
  capacity_type    VARCHAR(32),
  cap_entry_kwh_h  NUMERIC(18,2),
  cap_exit_kwh_h   NUMERIC(18,2),
  capacity_kwh_h   NUMERIC(18,2),
  capacity_kwh_day NUMERIC(18,2),
  tariff_entry_eur_kwh_h NUMERIC(12,6),
  tariff_exit_eur_kwh_h  NUMERIC(12,6),
  tariff_entry_eur_kwh_day NUMERIC(12,6),
  tariff_exit_eur_kwh_day  NUMERIC(12,6),
  billing_model    VARCHAR(32) DEFAULT 'CAPACITY',
  max_daily_mwh    NUMERIC(18,2),
  tariff_eur_mwh   NUMERIC(12,6),
  start_date       DATE         NOT NULL,
  end_date         DATE         NOT NULL,
  status           VARCHAR(32)  DEFAULT 'DRAFT',
  notes            TEXT,
  signed_date      DATE,
  auction_ref      VARCHAR(64),
  gta_number       VARCHAR(64),
  created_by       UUID,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Capacity Bookings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capacity_bookings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref    VARCHAR(32) UNIQUE,
  shipper_id     UUID         REFERENCES shippers(id),
  contract_id    UUID         REFERENCES contracts(id),
  point          VARCHAR(32)  NOT NULL,
  direction      VARCHAR(16),
  booking_type   VARCHAR(32),
  product_type   VARCHAR(32) DEFAULT 'FIRM_YEARLY',
  capacity_mwh_d NUMERIC(18,2),
  capacity_kwh_h NUMERIC(18,2),
  allocated_mwh_d NUMERIC(18,2),
  start_date     DATE,
  end_date       DATE,
  period_from    DATE,
  period_to      DATE,
  status         VARCHAR(32)  DEFAULT 'ACTIVE',
  created_by     UUID,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Invoices ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no          VARCHAR(32)  NOT NULL UNIQUE,
  shipper_id          UUID         REFERENCES shippers(id),
  contract_id         UUID         REFERENCES contracts(id),
  period_from         DATE,
  period_to           DATE,
  billing_days        INTEGER,
  flow_direction      VARCHAR(64),
  volume_mwh          NUMERIC(18,4),
  tariff_eur_mwh      NUMERIC(12,6),
  amount_eur          NUMERIC(18,2),
  transit_amount_eur  NUMERIC(18,2),
  capacity_kwh_h      NUMERIC(18,2),
  capacity_fee_eur    NUMERIC(18,2),
  cap_entry_kwh_h     NUMERIC(18,2),
  cap_exit_kwh_h      NUMERIC(18,2),
  cap_entry_fee_eur   NUMERIC(18,2),
  cap_exit_fee_eur    NUMERIC(18,2),
  fuel_gas_rate_pct   NUMERIC(8,4),
  fuel_gas_volume_mwh NUMERIC(18,4),
  fuel_gas_price_eur_mwh NUMERIC(12,4),
  fuel_gas_amount_eur NUMERIC(18,2),
  fuel_gas_kwh        NUMERIC(18,2),
  fuel_gas_volume_nm3 NUMERIC(18,2),
  balancing_gas_mwh   NUMERIC(18,4),
  balancing_gas_eur   NUMERIC(18,2),
  total_amount_eur    NUMERIC(18,2),
  late_payment_days   INTEGER,
  late_payment_eur    NUMERIC(18,2),
  due_date            DATE,
  paid_at             TIMESTAMPTZ,
  erp_synced_at       TIMESTAMPTZ,
  erp_ref             VARCHAR(128),
  status              VARCHAR(32)  DEFAULT 'DRAFT',
  created_by          UUID,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Nominations ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nominations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference        VARCHAR(64) UNIQUE,
  shipper_id       UUID         REFERENCES shippers(id),
  contract_id      UUID         REFERENCES contracts(id),
  gas_day          DATE         NOT NULL,
  direction        VARCHAR(16),
  point            VARCHAR(32),
  volume_mwh       NUMERIC(18,4),
  volume_kwh_h     NUMERIC(18,2),
  contracted_kwh_h NUMERIC(18,2),
  matched_kwh_h    NUMERIC(18,2),
  status           VARCHAR(32)  DEFAULT 'PENDING',
  parent_id        UUID,
  gas_day_cycle    INTEGER      DEFAULT 0,
  tso_status       VARCHAR(32),
  tso_response     JSONB,
  notes            TEXT,
  submitted_by     UUID,
  submitted_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Auction Calendar ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_calendar (
  id                   SERIAL PRIMARY KEY,
  product_type         VARCHAR(32),
  capacity_type        VARCHAR(32),
  point_code           VARCHAR(32),
  flow_direction       VARCHAR(64),
  gas_year             INTEGER,
  delivery_start       DATE,
  delivery_end         DATE,
  auction_start_date   TIMESTAMPTZ,
  auction_end_date     TIMESTAMPTZ,
  status               VARCHAR(32) DEFAULT 'UPCOMING',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auction Bids ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_bids (
  id                     SERIAL PRIMARY KEY,
  auction_calendar_id    INTEGER REFERENCES auction_calendar(id),
  shipper_id             UUID    REFERENCES shippers(id),
  bid_capacity_kwh_h     NUMERIC(18,2),
  offered_price_eur      NUMERIC(12,6),
  auction_price_eur      NUMERIC(12,6),
  capacity_allocated_kwh_h NUMERIC(18,2),
  credit_checked         BOOLEAN DEFAULT false,
  credit_blocked_eur     NUMERIC(18,2),
  status                 VARCHAR(32) DEFAULT 'DRAFT',
  notes                  TEXT,
  created_by             UUID,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── System Parameters ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_params (
  key        VARCHAR(128) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit Log ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  action_type VARCHAR(64),
  entity_type VARCHAR(64),
  entity_id   VARCHAR(128),
  user_id     VARCHAR(128),
  username    VARCHAR(64),
  ip_address  VARCHAR(45),
  description TEXT,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shipper Changes (NC Art.3.5 audit) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipper_changes (
  id          SERIAL PRIMARY KEY,
  shipper_id  UUID REFERENCES shippers(id),
  changed_by  UUID,
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  field_name  VARCHAR(64),
  old_value   TEXT,
  new_value   TEXT,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Point Details (NC reference data) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_details (
  id          SERIAL PRIMARY KEY,
  point_code  VARCHAR(32) REFERENCES interconnection_points(code),
  nc_ref      TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Balance Charges (NC Art.15) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS balance_charges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipper_id  UUID REFERENCES shippers(id),
  gas_day     DATE,
  imbalance_kwh NUMERIC(18,2),
  charge_eur  NUMERIC(18,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Gas Quality (NC Art.17) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gas_quality_daily (
  id          SERIAL PRIMARY KEY,
  gas_day     DATE,
  point_code  VARCHAR(32),
  gcv_kwh_nm3 NUMERIC(10,4),
  wobbe_index NUMERIC(10,4),
  h2s_mg_nm3  NUMERIC(8,4),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Margin Calls (NC Art.5.5) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS margin_calls (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipper_id  UUID REFERENCES shippers(id),
  exposure_eur NUMERIC(18,2),
  limit_eur   NUMERIC(18,2),
  status      VARCHAR(32) DEFAULT 'OPEN',
  issued_by   UUID,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RBP Sync Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rbp_sync_log (
  id          SERIAL PRIMARY KEY,
  operation   VARCHAR(64),
  status      VARCHAR(32),
  request     JSONB,
  response    JSONB,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
