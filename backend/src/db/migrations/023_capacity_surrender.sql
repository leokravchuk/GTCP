-- Migration 023: Capacity Surrender + UIOLI (NC Art.8, Art.10)
-- Art.8.3: Shipper can surrender contracted capacity back to TSO
-- Art.10: Use-It-Or-Lose-It — TSO can reclaim underutilized capacity

CREATE TABLE IF NOT EXISTS capacity_surrenders (
  id            SERIAL PRIMARY KEY,
  shipper_id    UUID NOT NULL REFERENCES shippers(id),
  booking_id    UUID REFERENCES capacity_bookings(id),
  point         TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('ENTRY', 'EXIT')),
  volume_kwh_h  NUMERIC(15,2) NOT NULL CHECK (volume_kwh_h > 0),
  surrender_type TEXT NOT NULL DEFAULT 'VOLUNTARY' CHECK (surrender_type IN ('VOLUNTARY', 'UIOLI')),
  effective_date DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reason        TEXT,
  reviewed_by   UUID,
  reviewed_at   TIMESTAMPTZ,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surrenders_shipper ON capacity_surrenders(shipper_id);
CREATE INDEX IF NOT EXISTS idx_surrenders_status ON capacity_surrenders(status);

-- Seed: 2 demo surrenders
INSERT INTO capacity_surrenders (shipper_id, point, direction, volume_kwh_h, surrender_type, effective_date, status, reason, created_by) VALUES
  ('22222222-0000-0000-0000-000000000004', 'KIREVO-ENTRY', 'ENTRY', 100000, 'VOLUNTARY', '2026-05-01', 'APPROVED', 'WIEH reducing Q3 position — seasonal adjustment', '11111111-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000003', 'HORGOS-EXIT', 'EXIT', 50000, 'UIOLI', '2026-04-15', 'PENDING', 'TSO UIOLI check: MET Energy utilization < 80% for 3 consecutive months', '11111111-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Interruptions table (NC Art.14)
CREATE TABLE IF NOT EXISTS interruptions (
  id            SERIAL PRIMARY KEY,
  booking_id    UUID REFERENCES capacity_bookings(id),
  shipper_id    UUID NOT NULL REFERENCES shippers(id),
  gas_day       DATE NOT NULL,
  point         TEXT NOT NULL,
  hours_interrupted INTEGER NOT NULL CHECK (hours_interrupted > 0 AND hours_interrupted <= 24),
  interrupted_kwh_h NUMERIC(15,2) NOT NULL,
  reason        TEXT NOT NULL,
  penalty_multiplier NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  penalty_eur   NUMERIC(12,2),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPENSATED', 'DISPUTED')),
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interruptions_shipper ON interruptions(shipper_id);
CREATE INDEX IF NOT EXISTS idx_interruptions_gas_day ON interruptions(gas_day);
