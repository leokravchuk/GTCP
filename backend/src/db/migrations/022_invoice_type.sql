-- Migration 022: Invoice type classification (NC Art.20.3.5)
-- Art.20.3.5: when shipper has >1 Capacity Product, Fuel Gas must be a separate invoice
-- Art.20.3.6: LT GTA shippers → FG invoiced per LT GTA, not per NC

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'CAPACITY'
  CHECK (invoice_type IN ('CAPACITY', 'FUEL_GAS', 'IMBALANCE'));

-- Index for filtering by invoice_type
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
