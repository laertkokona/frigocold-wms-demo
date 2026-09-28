-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "weight_type" VARCHAR(20) NOT NULL,
    "fixed_kg" DECIMAL(10,3),
    "origin" VARCHAR(100),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "contact" VARCHAR(150),
    "phone" VARCHAR(50),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "contact" VARCHAR(150),
    "phone" VARCHAR(50),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "order_nr" VARCHAR(100) NOT NULL,
    "load_type" VARCHAR(20) NOT NULL,
    "count_doc" INTEGER NOT NULL,
    "count_actual" INTEGER NOT NULL,
    "net_kg_doc" DECIMAL(12,3) NOT NULL,
    "net_kg_actual" DECIMAL(12,3) NOT NULL,
    "cost_per_kg" DECIMAL(12,4) NOT NULL,
    "date_mode" VARCHAR(20) NOT NULL,
    "prod_from" VARCHAR(10) NOT NULL,
    "prod_to" VARCHAR(10),
    "exp_from" VARCHAR(10) NOT NULL,
    "exp_to" VARCHAR(10),
    "entry_date" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lots" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "lot_number" VARCHAR(100) NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "shipment_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lines" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "qty" INTEGER NOT NULL,
    "kg" DECIMAL(12,3) NOT NULL,
    "price_per_kg" DECIMAL(12,4) NOT NULL,
    "weights" JSONB,
    "fixed_kg" DECIMAL(10,3),

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "sale_id" UUID,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "kg" DECIMAL(12,3) NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "expiry_days" INTEGER NOT NULL,
    "low_shipment_count" INTEGER NOT NULL,
    "low_product_kg" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE INDEX "shipments_product_id_exp_from_idx" ON "shipments"("product_id", "exp_from");

-- CreateIndex
CREATE INDEX "shipments_supplier_id_idx" ON "shipments"("supplier_id");

-- CreateIndex
CREATE INDEX "shipments_order_nr_idx" ON "shipments"("order_nr");

-- CreateIndex
CREATE INDEX "shipment_lots_lot_number_idx" ON "shipment_lots"("lot_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_lots_shipment_id_lot_number_key" ON "shipment_lots"("shipment_id", "lot_number");

-- CreateIndex
CREATE INDEX "sales_client_id_date_idx" ON "sales"("client_id", "date");

-- CreateIndex
CREATE INDEX "sale_lines_shipment_id_idx" ON "sale_lines"("shipment_id");

-- CreateIndex
CREATE INDEX "movements_shipment_id_idx" ON "movements"("shipment_id");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lots" ADD CONSTRAINT "shipment_lots_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity checks for the quantities that drive stock and margin calculations.
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_quantities_check" CHECK ("count_doc" >= 0 AND "count_actual" > 0 AND "net_kg_doc" >= 0 AND "net_kg_actual" > 0 AND "cost_per_kg" > 0);
ALTER TABLE "shipment_lots" ADD CONSTRAINT "shipment_lots_qty_check" CHECK ("qty" > 0);
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_quantities_check" CHECK ("qty" > 0 AND "kg" > 0 AND "price_per_kg" >= 0);
ALTER TABLE "movements" ADD CONSTRAINT "movements_direction_check" CHECK (("type" = 'IN' AND "kg" > 0 AND "qty" > 0 AND "sale_id" IS NULL) OR ("type" = 'OUT' AND "kg" < 0 AND "qty" < 0 AND "sale_id" IS NOT NULL));

CREATE FUNCTION reject_movement_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'movements are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER movements_append_only BEFORE UPDATE OR DELETE ON "movements" FOR EACH ROW EXECUTE FUNCTION reject_movement_change();

