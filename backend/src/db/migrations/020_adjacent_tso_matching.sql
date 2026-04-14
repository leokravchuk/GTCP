-- Migration 020: Adjacent TSO Matching (NC Art.13)
-- Purpose: record cross-border matching results with upstream/downstream TSOs
--          (Bulgartransgaz, FGSZ, TRANSPORTGAS SRBIJA) per NC Art.13 Lesser Rule.
-- Sprint 17 · US-1703 · 15.04.2026

BEGIN;

-- Add MATCHED_ADJACENT to nominations.status semantics (no CHECK alter — status is VARCHAR).
-- Active Active TSO logic: Gastrans is Active on entries, Passive on exits.

CREATE TABLE IF NOT EXISTS adjacent_tso_matches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nomination_id     UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  adjacent_tso      TEXT NOT NULL,                     -- Bulgartransgaz | FGSZ | TRANSPORTGAS SRBIJA
  ip_code           TEXT NOT NULL,                     -- KIREVO-ENTRY | HORGOS-EXIT | EXIT-SERBIA
  our_side_kwh_h    NUMERIC(18,2) NOT NULL,            -- Gastrans nominated
  their_side_kwh_h  NUMERIC(18,2) NOT NULL,            -- adjacent TSO nominated
  matched_kwh_h     NUMERIC(18,2) NOT NULL,            -- min(our, their) — Lesser Rule NC Art.13
  lesser_side       TEXT NOT NULL CHECK (lesser_side IN ('OURS','THEIRS','EQUAL')),
  match_status      TEXT NOT NULL DEFAULT 'MATCHED'    -- MATCHED | REJECTED | PENDING
                       CHECK (match_status IN ('MATCHED','REJECTED','PENDING')),
  matched_at        TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_adj_match_nom  ON adjacent_tso_matches(nomination_id);
CREATE INDEX IF NOT EXISTS idx_adj_match_tso  ON adjacent_tso_matches(adjacent_tso, matched_at DESC);
CREATE INDEX IF NOT EXISTS idx_adj_match_ip   ON adjacent_tso_matches(ip_code, matched_at DESC);

COMMENT ON TABLE adjacent_tso_matches IS
  'NC Art.13 Lesser Rule matching outcomes between Gastrans and adjacent TSOs.';
COMMENT ON COLUMN adjacent_tso_matches.lesser_side IS
  'Which side was the limiting quantity: OURS (our nomination < theirs), THEIRS (theirs < ours), EQUAL.';

COMMIT;
