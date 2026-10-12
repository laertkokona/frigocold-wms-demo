-- Unknown values remain NULL. Existing counts, costs and immutable movements are preserved.
ALTER TABLE shipments
  ALTER COLUMN supplier_id DROP NOT NULL,
  ALTER COLUMN order_nr DROP NOT NULL,
  ALTER COLUMN count_doc DROP NOT NULL,
  ALTER COLUMN count_actual DROP NOT NULL,
  ALTER COLUMN net_kg_doc DROP NOT NULL,
  ALTER COLUMN cost_per_kg DROP NOT NULL;
ALTER TABLE sale_lines ALTER COLUMN qty DROP NOT NULL;
ALTER TABLE movements ALTER COLUMN qty DROP NOT NULL;

ALTER TABLE shipments DROP CONSTRAINT shipments_quantities_check;
ALTER TABLE shipments ADD CONSTRAINT shipments_quantities_check CHECK (
  (count_doc IS NULL OR count_doc >= 0) AND
  (count_actual IS NULL OR count_actual > 0) AND
  (net_kg_doc IS NULL OR net_kg_doc >= 0) AND net_kg_actual > 0 AND
  (cost_per_kg IS NULL OR cost_per_kg > 0)
);
ALTER TABLE sale_lines DROP CONSTRAINT sale_lines_quantities_check;
ALTER TABLE sale_lines ADD CONSTRAINT sale_lines_quantities_check CHECK (
  (qty IS NULL OR qty > 0) AND kg > 0 AND price_per_kg >= 0 AND
  (method = 'TOTAL' OR qty IS NOT NULL)
);
ALTER TABLE movements DROP CONSTRAINT movements_direction_check;
ALTER TABLE movements ADD CONSTRAINT movements_direction_check CHECK (
  (type = 'IN' AND kg > 0 AND (qty IS NULL OR qty > 0) AND sale_id IS NULL) OR
  (type = 'OUT' AND kg < 0 AND (qty IS NULL OR qty < 0) AND sale_id IS NOT NULL)
);
