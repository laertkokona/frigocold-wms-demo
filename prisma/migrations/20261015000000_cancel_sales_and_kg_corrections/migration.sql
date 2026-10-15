-- Cancelled sales: a sale recorded by mistake (wrong load, wrong client, wrong quantity) is cancelled, not deleted.
-- Its rows stay; VOID movements put the kilograms (and units) back on the loads they came from. Idempotent.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP(3);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(300);

-- Kilogram corrections: the received weight of a load entered wrongly is corrected with a note.
-- The load keeps one row; each correction is kept here and mirrored by a CORRECT movement of the difference.
CREATE TABLE IF NOT EXISTS shipment_corrections (
  id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  kg_before DECIMAL(12,3) NOT NULL,
  kg_after DECIMAL(12,3) NOT NULL,
  doc_kg_before DECIMAL(12,3),
  doc_kg_after DECIMAL(12,3),
  note VARCHAR(300) NOT NULL,
  date VARCHAR(10) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT shipment_corrections_pkey PRIMARY KEY (id),
  CONSTRAINT shipment_corrections_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT shipment_corrections_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT shipment_corrections_kg_check CHECK (kg_after > 0 AND kg_before > 0 AND kg_after <> kg_before)
);
CREATE INDEX IF NOT EXISTS shipment_corrections_shipment_id_idx ON shipment_corrections(shipment_id);

ALTER TABLE movements DROP CONSTRAINT movements_direction_check;
ALTER TABLE movements ADD CONSTRAINT movements_direction_check CHECK (
  (type = 'IN' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NULL) OR
  (type = 'OUT' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NOT NULL) OR
  (type = 'VOID' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NOT NULL) OR
  (type IN ('CANCEL', 'ADJUST') AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NULL) OR
  (type = 'CORRECT' AND kg <> 0 AND qty IS NULL AND sale_id IS NULL)
);
