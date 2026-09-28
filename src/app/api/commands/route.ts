import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { commandSchema, commandHash, DomainError, executeCommand } from "@/lib/server/commands";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/state";
import { StockError } from "@/lib/server/sale-rules";
import { getDb } from "@/lib/server/db";
import { z } from "zod";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  const requestId = z.string().uuid().safeParse(body?.requestId);
  if ((parsed.data.type === "addShipment" || parsed.data.type === "finalizeSale") && !requestId.success) return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
  const includeState = request.headers.get("x-include-state") !== "0";
  try {
    const result = await executeCommand(parsed.data, user.id, requestId.success ? requestId.data : undefined);
    return NextResponse.json({ result, ...(includeState ? { state: await getState() } : {}) });
  } catch (error) {
    if (error instanceof DomainError || error instanceof StockError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && requestId.success) {
      const previous = await getDb().operation.findUnique({ where: { key: requestId.data } });
      if (previous?.payloadHash === commandHash(parsed.data) && previous.kind === parsed.data.type && previous.resultId) return NextResponse.json({ result: { id: previous.resultId }, ...(includeState ? { state: await getState() } : {}) });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) {
      return NextResponse.json({ error: error.code === "P2002" ? "Record already exists" : "Record changed or is unavailable" }, { status: 409 });
    }
    throw error;
  }
}
