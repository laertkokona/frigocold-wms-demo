import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { commandSchema, commandHash, DomainError, executeCommand } from "@/lib/server/commands";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/state";
import { StockError } from "@/lib/server/sale-rules";
import { getDb } from "@/lib/server/db";
import { z } from "zod";

export const POST = withRequestLog({ route: "/api/commands", action: "command" }, async (request, log) => {
  const user = await currentUser();
  if (!user) { log.reason("authentication_required"); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  log.actor(user.id);
  const body = await request.json().catch(() => null);
  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) { log.reason("validation_failed"); return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 }); }
  log.action(parsed.data.type);
  const requestId = z.string().uuid().safeParse(body?.requestId);
  if (requestId.success) log.operation(requestId.data);
  if ((parsed.data.type === "addShipment" || parsed.data.type === "finalizeSale") && !requestId.success) { log.reason("missing_operation_id"); return NextResponse.json({ error: "Request ID is required" }, { status: 400 }); }
  const includeState = request.headers.get("x-include-state") !== "0";
  try {
    const result = await executeCommand(parsed.data, user.id, requestId.success ? requestId.data : undefined);
    log.result(result.id); log.writeOutcome("completed");
    return NextResponse.json({ result, ...(includeState ? { state: await getState() } : {}) });
  } catch (error) {
    log.error(error);
    if (error instanceof DomainError || error instanceof StockError) { log.reason(error instanceof StockError ? "stock_conflict" : "domain_conflict"); return NextResponse.json({ error: error.message }, { status: 409 }); }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && requestId.success) {
      const previous = await getDb().operation.findUnique({ where: { key: requestId.data } });
      if (previous?.payloadHash === commandHash(parsed.data) && previous.kind === parsed.data.type && previous.resultId) {
        log.result(previous.resultId); log.writeOutcome("replayed");
        return NextResponse.json({ result: { id: previous.resultId }, ...(includeState ? { state: await getState() } : {}) });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) {
      log.reason(error.code === "P2002" ? "duplicate_record" : error.code === "P2034" ? "transaction_conflict" : "related_record_unavailable");
      return NextResponse.json({ error: error.code === "P2002" ? "Record already exists" : "Record changed or is unavailable" }, { status: 409 });
    }
    throw error;
  }
});
