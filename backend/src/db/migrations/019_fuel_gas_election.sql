-- Migration 019: Fuel Gas Election (NC Art.18.1.1)
-- Purpose: per-shipper election between in-kind delivery and cash reimbursement
-- of Fuel Gas, valid for the full Gas Year (Art.18.1.2).
-- Sprint 17 · US-1709 (FG-03) · 15.04.2026
--
-- Binding rule (CLAUDE.md "Fuel Gas Allocation Rules"):
--   election = 'CASH'    → FG fee calculated per Art.18.4.1 (if route is transit)
--   election = 'IN_KIND' → shipper provides FG via Nomination; FG fee = 0
--                          (edge-case Art.18.4.2 handled separately).

BEGIN;

ALTER TABLE shippers
  ADD COLUMN IF NOT EXISTS fuel_gas_election TEXT
    CHECK (fuel_gas_election IN ('IN_KIND', 'CASH'))
    DEFAULT 'CASH';

-- Seed alignment:
--   Gazprom Export (SHP-001): CASH — foreign shipper, buys FG from TSO tender.
--   Naftna Industrija Srbije (SHP-002): IN_KIND — domestic supplier with own gas;
--     irrelevant anyway because KIREVO_EXIT_SERBIA is not FG_APPLICABLE.
UPDATE shippers SET fuel_gas_election = 'CASH'    WHERE code = 'SHP-001';
UPDATE shippers SET fuel_gas_election = 'IN_KIND' WHERE code = 'SHP-002';

COMMENT ON COLUMN shippers.fuel_gas_election IS
  'NC Art.18.1.1 election: IN_KIND (provide FG via Nomination) or CASH (reimburse TSO at tender price).';

COMMIT;
