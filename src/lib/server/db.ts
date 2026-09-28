import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { frigocoldDb?: PrismaClient };

function createDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

export function getDb() {
  globalDb.frigocoldDb ??= createDb();
  return globalDb.frigocoldDb;
}
