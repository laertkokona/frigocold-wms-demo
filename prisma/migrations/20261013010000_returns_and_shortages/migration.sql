-- Client returns: a returned quantity comes back as a new load linked to the sale line it was sold on,
-- carrying the credit price given to the client and the reason. Idempotent.
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS return_of_line_id UUID;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS return_reason VARCHAR(200);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS return_price_per_kg DECIMAL(12,4);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipments_return_of_line_id_fkey') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_return_of_line_id_fkey FOREIGN KEY (return_of_line_id) REFERENCES sale_lines(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS shipments_return_of_line_id_idx ON shipments(return_of_line_id);

-- Stock shortages: kilograms (and units) found missing from a load, with a reason and date.
-- Each is mirrored by an ADJUST movement, so stock stays the signed sum of the append-only ledger.
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  kg DECIMAL(12,3) NOT NULL,
  qty INTEGER,
  reason VARCHAR(30) NOT NULL,
  note VARCHAR(300),
  date VARCHAR(10) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT stock_adjustments_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT stock_adjustments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT stock_adjustments_quantities_check CHECK (kg > 0 AND (qty IS NULL OR qty > 0))
);
CREATE INDEX IF NOT EXISTS stock_adjustments_shipment_id_idx ON stock_adjustments(shipment_id);

ALTER TABLE movements DROP CONSTRAINT movements_direction_check;
ALTER TABLE movements ADD CONSTRAINT movements_direction_check CHECK (
  (type = 'IN' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NULL) OR
  (type = 'OUT' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NOT NULL) OR
  (type IN ('CANCEL', 'ADJUST') AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NULL)
);
