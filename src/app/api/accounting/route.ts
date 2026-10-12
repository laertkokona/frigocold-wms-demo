import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/session";
import { getAccountingReport } from "@/lib/server/accounting-report";

const query = z.object({ period: z.enum(["month", "quarter", "year", "all"]).default("month"), product: z.string().uuid().or(z.literal("")).default(""), lotPage: z.coerce.number().int().min(1).max(100000).default(1) });

export const GET = withRequestLog({ route: "/api/accounting", action: "accounting" }, async (request, log) => {
  const user = await currentUser();
  if (!user) { log.reason("authentication_required"); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  log.actor(user.id);
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) { log.reason("validation_failed"); return NextResponse.json({ error: "Invalid query" }, { status: 400 }); }
  return NextResponse.json(await getAccountingReport(parsed.data.period, parsed.data.product, parsed.data.lotPage), { headers: { "Cache-Control": "no-store" } });
});
