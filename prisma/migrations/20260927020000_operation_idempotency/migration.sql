CREATE TABLE "operations" (
    "key" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "result_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operations_pkey" PRIMARY KEY ("key")
);
