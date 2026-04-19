-- Migration 024: Auction Rounds + Clearing Price (CAM NC Art.17-18)
-- Ascending clock: multiple rounds with announced price, aggregate demand.
-- Even for sealed-bid (current impl), we store 1 round per auction.

CREATE TABLE IF NOT EXISTS auction_rounds (
  id              SERIAL PRIMARY KEY,
  auction_id      INTEGER NOT NULL REFERENCES auction_calendar(id),
  round_number    INTEGER NOT NULL DEFAULT 1,
  announced_price NUMERIC(12,6) NOT NULL,
  price_step_pct  NUMERIC(5,2) DEFAULT 0,
  aggregate_demand_kwh_h NUMERIC(18,2) DEFAULT 0,
  available_supply_kwh_h NUMERIC(18,2) NOT NULL,
  round_status    TEXT NOT NULL DEFAULT 'OPEN' CHECK (round_status IN ('OPEN', 'CLOSED', 'CLEARANCE', 'OVERSUB', 'UNDERSELL')),
  round_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  round_end       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_rounds_auction ON auction_rounds(auction_id);

-- Add clearing_price and auction_premium to auction_bids (if not exists)
DO $$ BEGIN
  ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS clearing_price_eur NUMERIC(12,6);
  ALTER TABLE auction_bids ADD COLUMN IF NOT EXISTS auction_premium_total_eur NUMERIC(18,2);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add uniform_clearing_price to auction_calendar
DO $$ BEGIN
  ALTER TABLE auction_calendar ADD COLUMN IF NOT EXISTS clearing_price_eur NUMERIC(12,6);
  ALTER TABLE auction_calendar ADD COLUMN IF NOT EXISTS total_demand_kwh_h NUMERIC(18,2);
  ALTER TABLE auction_calendar ADD COLUMN IF NOT EXISTS rounds_count INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
