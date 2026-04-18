-- Migration 021: Virtual Trading Point (NC Art.11)
-- VTP = entry + exit from balancing perspective
-- Trade types: TITLE_TRANSFER (change of ownership), BALANCING (net position adjustment)

CREATE TABLE IF NOT EXISTS vtp_trades (
  id            SERIAL PRIMARY KEY,
  trade_ref     TEXT NOT NULL UNIQUE,
  shipper_id    UUID NOT NULL REFERENCES shippers(id),
  counterparty_id UUID REFERENCES shippers(id),
  gas_day       DATE NOT NULL,
  volume_kwh_h  NUMERIC(15,2) NOT NULL CHECK (volume_kwh_h > 0),
  direction     TEXT NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  trade_type    TEXT NOT NULL DEFAULT 'TITLE_TRANSFER' CHECK (trade_type IN ('TITLE_TRANSFER', 'BALANCING')),
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
  price_eur_mwh NUMERIC(10,4),
  notes         TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ,
  confirmed_by  UUID
);

CREATE INDEX IF NOT EXISTS idx_vtp_trades_shipper ON vtp_trades(shipper_id);
CREATE INDEX IF NOT EXISTS idx_vtp_trades_gas_day ON vtp_trades(gas_day);
CREATE INDEX IF NOT EXISTS idx_vtp_trades_status  ON vtp_trades(status);

-- Seed VTP trades for demo (Газпром ↔ NIS, WIEH ↔ MET Energy)
INSERT INTO vtp_trades (trade_ref, shipper_id, counterparty_id, gas_day, volume_kwh_h, direction, trade_type, status, price_eur_mwh, notes, created_by, confirmed_at) VALUES
  ('VTP-2026-00001', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', '2026-03-15', 500000, 'SELL', 'TITLE_TRANSFER', 'CONFIRMED', 28.50, 'Газпром sells to NIS — VTP title transfer', '11111111-0000-0000-0000-000000000001', NOW()),
  ('VTP-2026-00002', '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', '2026-03-15', 500000, 'BUY',  'TITLE_TRANSFER', 'CONFIRMED', 28.50, 'NIS buys from Газпром — matching leg', '11111111-0000-0000-0000-000000000001', NOW()),
  ('VTP-2026-00003', '22222222-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000003', '2026-04-01', 200000, 'SELL', 'BALANCING',       'CONFIRMED', 30.00, 'WIEH balancing trade with MET', '11111111-0000-0000-0000-000000000001', NOW()),
  ('VTP-2026-00004', '22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', '2026-04-01', 200000, 'BUY',  'BALANCING',       'CONFIRMED', 30.00, 'MET buys from WIEH — matching leg', '11111111-0000-0000-0000-000000000001', NOW()),
  ('VTP-2026-00005', '22222222-0000-0000-0000-000000000001', NULL,                                   '2026-04-10', 100000, 'BUY',  'BALANCING',       'PENDING',   NULL,   'Газпром open balancing buy — no counterparty yet', '11111111-0000-0000-0000-000000000001', NULL),
  ('VTP-2026-00006', '22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', '2026-04-15', 750000, 'SELL', 'TITLE_TRANSFER', 'PENDING',   27.80, 'NIS proposed title transfer to Газпром', '11111111-0000-0000-0000-000000000001', NULL)
ON CONFLICT (trade_ref) DO NOTHING;
