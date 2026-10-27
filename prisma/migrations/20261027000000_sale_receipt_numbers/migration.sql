-- Order sheet ("Fletë porosi") numbers: each sale gets the next number when it is saved, starting from 1.
-- Sales made before this change keep no number. Numbers are never reused (a cancelled sale keeps its own). Idempotent.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_nr INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS sales_receipt_nr_key ON sales(receipt_nr);
