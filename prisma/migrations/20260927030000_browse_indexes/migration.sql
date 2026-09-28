CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX clients_name_trgm_idx ON clients USING GIN (name gin_trgm_ops);
CREATE INDEX clients_city_trgm_idx ON clients USING GIN (city gin_trgm_ops);
CREATE INDEX clients_contact_trgm_idx ON clients USING GIN (contact gin_trgm_ops);
CREATE INDEX suppliers_name_trgm_idx ON suppliers USING GIN (name gin_trgm_ops);
CREATE INDEX suppliers_country_trgm_idx ON suppliers USING GIN (country gin_trgm_ops);
CREATE INDEX suppliers_contact_trgm_idx ON suppliers USING GIN (contact gin_trgm_ops);
CREATE INDEX products_name_trgm_idx ON products USING GIN (name gin_trgm_ops);
CREATE INDEX shipments_order_nr_trgm_idx ON shipments USING GIN (order_nr gin_trgm_ops);
CREATE INDEX shipment_lots_lot_number_trgm_idx ON shipment_lots USING GIN (lot_number gin_trgm_ops);

CREATE INDEX shipments_exp_from_idx ON shipments (exp_from);
CREATE INDEX shipments_entry_date_idx ON shipments (entry_date);
CREATE INDEX sales_date_idx ON sales (date);
CREATE INDEX sale_lines_sale_id_idx ON sale_lines (sale_id);
