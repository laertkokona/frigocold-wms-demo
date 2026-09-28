CREATE TABLE "login_attempts" (
    "key" VARCHAR(200) NOT NULL,
    "count" INTEGER NOT NULL,
    "first_attempt_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("key")
);
