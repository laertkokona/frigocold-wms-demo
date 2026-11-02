-- Surplus ("Tepricë"): kilograms (and units) sold beyond what the system had on a load — the load physically held
-- more than recorded. Recorded with the sale that needed it, at no purchase cost, so the extra counts as pure profit.
-- Each is mirrored by a SURPLUS movement (+kg); cancelling that sale reverses it with a SURPLUS movement (−kg). Idempotent.
CREATE TABLE IF NOT EXISTS stock_surpluses (
  id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  user_id UUID NOT NULL,
  kg DECIMAL(12,3) NOT NULL,
  qty INTEGER,
  reason VARCHAR(300) NOT NULL,
  date VARCHAR(10) NOT NULL,
  cancelled_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stock_surpluses_pkey PRIMARY KEY (id),
  CONSTRAINT stock_surpluses_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT stock_surpluses_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT stock_surpluses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT stock_surpluses_quantities_check CHECK (kg >= 0 AND (qty IS NULL OR qty >= 0) AND (kg > 0 OR qty > 0))
);
CREATE INDEX IF NOT EXISTS stock_surpluses_shipment_id_idx ON stock_surpluses(shipment_id);
CREATE INDEX IF NOT EXISTS stock_surpluses_sale_id_idx ON stock_surpluses(sale_id);

ALTER TABLE movements DROP CONSTRAINT movements_direction_check;
ALTER TABLE movements ADD CONSTRAINT movements_direction_check CHECK (
  (type = 'IN' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NULL) OR
  (type = 'OUT' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NOT NULL) OR
  (type = 'VOID' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NOT NULL) OR
  (type IN ('CANCEL', 'ADJUST') AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NULL) OR
  (type = 'CORRECT' AND kg <> 0 AND qty IS NULL AND sale_id IS NULL) OR
  (type = 'SURPLUS' AND sale_id IS NULL AND (kg <> 0 OR COALESCE(qty, 0) <> 0) AND (
    (kg >= 0 AND (qty IS NULL OR qty >= 0)) OR (kg <= 0 AND (qty IS NULL OR qty <= 0))))
);
