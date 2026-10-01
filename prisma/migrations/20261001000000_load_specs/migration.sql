-- A product is now a category (e.g. "Kofshë pule"); each load (shipment) carries its own specification.
ALTER TABLE "shipments" ADD COLUMN "fixed_kg" DECIMAL(10,3);
ALTER TABLE "shipments" ADD COLUMN "origin" VARCHAR(100);
ALTER TABLE "shipments" ADD COLUMN "specs" VARCHAR(200);

-- Carry the old product-level spec onto existing loads so nothing changes for them.
UPDATE "shipments" s SET "fixed_kg" = p."fixed_kg"
  FROM "products" p WHERE p."id" = s."product_id" AND p."weight_type" = 'FIXED' AND s."load_type" = 'CARTON';
UPDATE "shipments" s SET "origin" = p."origin"
  FROM "products" p WHERE p."id" = s."product_id" AND p."origin" IS NOT NULL;

-- Product-level weight type is now only a legacy default.
ALTER TABLE "products" ALTER COLUMN "weight_type" SET DEFAULT 'VARIABLE';
