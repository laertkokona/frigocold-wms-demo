-- A load entered by mistake (e.g. saved twice) can be cancelled while nothing has been sold from it.
-- The ledger stays append-only: cancelling marks the shipment and appends a CANCEL movement that
-- reverses its IN movement, so its balance becomes zero and the original rows are kept.
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP(3);

ALTER TABLE movements DROP CONSTRAINT movements_direction_check;
ALTER TABLE movements ADD CONSTRAINT movements_direction_check CHECK (
  (type = 'IN' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NULL) OR
  (type = 'OUT' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NOT NULL) OR
  (type = 'CANCEL' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NULL)
);
