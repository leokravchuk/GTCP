-- ═══════════════════════════════════════════════════════════════════════════════
-- GTCP — Initial Schema Migration v1.0
-- PostgreSQL 15+
-- Tables: users, shippers, nominations, invoices, contracts,
--         capacity_bookings, margin_calls, audit_log
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Enable extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: users
-- Stores login credentials and role assignments.
-- Roles: dispatcher | credit | billing | contracts | admin
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(64) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,          -- Argon2id hash
    role          VARCHAR(32) NOT NULL
                    CHECK (role IN ('dispatcher','credit','billing','contracts','admin')),
    full_name     VARCHAR(255),
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role     ON users(role);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: shippers
-- Gas shippers operating on the transit corridor (Horgoš/Gospođinci, Serbia)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shippers (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    code          VARCHAR(20) NOT NULL UNIQUE,   -- e.g. "SHP-001"
    name          VARCHAR(255) NOT NULL,
    country       VARCHAR(64),
    eic_code      VARCHAR(16),                   -- ENTSO-G EIC identifier
    credit_limit  NUMERIC(18,2) NOT NULL DEFAULT 0,
    current_exposure NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shippers_code      ON shippers(code);
CREATE INDEX idx_shippers_is_active ON shippers(is_active);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: nominations
-- Gas nominations per Gas Day (06:00 CET – 06:00 CET next day)
-- status: PENDING | MATCHED | PARTIALLY_MATCHED | REJECTED | RENOMINATED
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nominations (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference      VARCHAR(32)  NOT NULL UNIQUE,  -- e.g. "NOM-2026-00001"
    shipper_id     UUID         NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,
    gas_day        DATE         NOT NULL,          -- YYYY-MM-DD (06:00 CET start)
    direction      VARCHAR(8)   NOT NULL CHECK (direction IN ('ENTRY','EXIT')),
    point          VARCHAR(64)  NOT NULL,          -- e.g. "Horgoš / Gospođinci"
    volume_mwh     NUMERIC(14,3) NOT NULL CHECK (volume_mwh >= 0),
    matched_volume NUMERIC(14,3) NOT NULL DEFAULT 0,
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','MATCHED','PARTIALLY_MATCHED','REJECTED','RENOMINATED')),
    parent_id      UUID         REFERENCES nominations(id), -- for renominations
    submitted_by   UUID         NOT NULL REFERENCES users(id),
    submitted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    gas_day_cycle  SMALLINT     NOT NULL DEFAULT 1,  -- D, D+1 renomination cycle
    notes          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nominations_shipper_id ON nominations(shipper_id);
CREATE INDEX idx_nominations_gas_day    ON nominations(gas_day);
CREATE INDEX idx_nominations_status     ON nominations(status);
CREATE INDEX idx_nominations_reference  ON nominations(reference);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: invoices
-- Billing records; invoice_no format: INV-YYYY-NNNN
-- status: DRAFT | ISSUED | PAID | OVERDUE | CANCELLED
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no     VARCHAR(20) NOT NULL UNIQUE,   -- INV-2026-0001
    shipper_id     UUID        NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,
    period_from    DATE        NOT NULL,
    period_to      DATE        NOT NULL,
    volume_mwh     NUMERIC(14,3) NOT NULL DEFAULT 0,
    tariff_eur_mwh NUMERIC(10,4) NOT NULL DEFAULT 0,
    amount_eur     NUMERIC(18,2) NOT NULL DEFAULT 0,
    currency       VARCHAR(3)  NOT NULL DEFAULT 'EUR',
    status         VARCHAR(12) NOT NULL DEFAULT 'DRAFT'
                     CHECK (status IN ('DRAFT','ISSUED','PAID','OVERDUE','CANCELLED')),
    due_date       DATE,
    paid_at        TIMESTAMPTZ,
    erp_synced_at  TIMESTAMPTZ,                   -- last successful 1С ERP sync
    erp_ref        VARCHAR(64),                   -- 1С document reference
    created_by     UUID        NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_shipper_id ON invoices(shipper_id);
CREATE INDEX idx_invoices_status     ON invoices(status);
CREATE INDEX idx_invoices_period     ON invoices(period_from, period_to);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 5: contracts
-- Commercial contracts between TSO and shippers
-- contract_type: FIRM | INTERRUPTIBLE
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contracts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_no     VARCHAR(32) NOT NULL UNIQUE,  -- e.g. "CTR-2026-001"
    shipper_id      UUID        NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,
    contract_type   VARCHAR(16) NOT NULL CHECK (contract_type IN ('FIRM','INTERRUPTIBLE')),
    start_date      DATE        NOT NULL,
    end_date        DATE        NOT NULL,
    max_daily_mwh   NUMERIC(14,3) NOT NULL DEFAULT 0,  -- MDQ – Max Daily Quantity
    tariff_eur_mwh  NUMERIC(10,4) NOT NULL DEFAULT 0,
    status          VARCHAR(12) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','TERMINATED')),
    signed_date     DATE,
    notes           TEXT,
    created_by      UUID        NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_shipper_id ON contracts(shipper_id);
CREATE INDEX idx_contracts_status     ON contracts(status);
CREATE INDEX idx_contracts_dates      ON contracts(start_date, end_date);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 6: capacity_bookings
-- CAM NC compliant capacity bookings at entry/exit points
-- booking_type: FIRM | INTERRUPTIBLE
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS capacity_bookings (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_ref     VARCHAR(32)  NOT NULL UNIQUE,  -- e.g. "CAP-2026-001"
    shipper_id      UUID         NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,
    point           VARCHAR(64)  NOT NULL,          -- e.g. "Horgoš", "Gospođinci"
    direction       VARCHAR(8)   NOT NULL CHECK (direction IN ('ENTRY','EXIT')),
    booking_type    VARCHAR(16)  NOT NULL CHECK (booking_type IN ('FIRM','INTERRUPTIBLE')),
    capacity_mwh_d  NUMERIC(14,3) NOT NULL DEFAULT 0,  -- daily contracted capacity
    allocated_mwh_d NUMERIC(14,3) NOT NULL DEFAULT 0,  -- currently allocated
    period_from     DATE         NOT NULL,
    period_to       DATE         NOT NULL,
    status          VARCHAR(12)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','EXPIRED','CANCELLED')),
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capacity_shipper_id ON capacity_bookings(shipper_id);
CREATE INDEX idx_capacity_point      ON capacity_bookings(point);
CREATE INDEX idx_capacity_dates      ON capacity_bookings(period_from, period_to);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 7: margin_calls
-- Margin call events issued when exposure > credit limit
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS margin_calls (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipper_id     UUID         NOT NULL REFERENCES shippers(id) ON DELETE RESTRICT,
    issued_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    exposure_eur   NUMERIC(18,2) NOT NULL,
    limit_eur      NUMERIC(18,2) NOT NULL,
    excess_eur     NUMERIC(18,2) GENERATED ALWAYS AS (exposure_eur - limit_eur) STORED,
    status         VARCHAR(16)  NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED','ESCALATED')),
    resolved_at    TIMESTAMPTZ,
    issued_by      UUID         NOT NULL REFERENCES users(id),
    notes          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mc_shipper_id ON margin_calls(shipper_id);
CREATE INDEX idx_mc_status     ON margin_calls(status);
CREATE INDEX idx_mc_issued_at  ON margin_calls(issued_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TABLE 8: audit_log
-- Immutable event log for compliance (FR-15)
-- action_type: LOGIN | LOGOUT | CREATE | UPDATE | DELETE | MARGIN_CALL |
--              NOMINATION_SUBMIT | NOMINATION_MATCH | RENOMINATION |
--              INVOICE_CREATE | ERP_SYNC | SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
    id           BIGSERIAL    PRIMARY KEY,
    action_type  VARCHAR(32)  NOT NULL,
    entity_type  VARCHAR(32),                    -- e.g. "nomination", "invoice"
    entity_id    UUID,                           -- FK to affected record
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    username     VARCHAR(64),                    -- denormalised for log immutability
    ip_address   INET,
    description  TEXT         NOT NULL,
    old_value    JSONB,
    new_value    JSONB,
    occurred_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id     ON audit_log(user_id);
CREATE INDEX idx_audit_entity      ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_occurred_at ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_action_type ON audit_log(action_type);

-- ── updated_at auto-trigger helper ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['users','shippers','nominations','invoices',
                               'contracts','capacity_bookings','margin_calls']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

COMMIT;
