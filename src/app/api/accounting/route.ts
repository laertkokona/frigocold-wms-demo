import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/session";
import { getAccountingReport } from "@/lib/server/accounting-report";

const query = z.object({ period: z.enum(["month", "quarter", "year", "all"]).default("month"), product: z.string().uuid().or(z.literal("")).default(""), lotPage: z.coerce.number().int().min(1).max(100000).default(1) });

export async function GET(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  return NextResponse.json(await getAccountingReport(parsed.data.period, parsed.data.product, parsed.data.lotPage), { headers: { "Cache-Control": "no-store" } });
}
