import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/session";
import { browse } from "@/lib/server/browse";

const params = z.object({
  kind: z.enum(["clients", "suppliers", "inventory", "movements", "search"]),
  q: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().max(30).default(""),
  direction: z.enum(["asc", "desc"]).default("asc"),
  filter: z.string().max(20).default(""),
});

export const GET = withRequestLog({ route: "/api/browse", action: "browse" }, async (request, log) => {
  const user = await currentUser();
  if (!user) { log.reason("authentication_required"); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  log.actor(user.id);
  const parsed = params.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) { log.reason("validation_failed"); return NextResponse.json({ error: "Invalid query" }, { status: 400 }); }
  return NextResponse.json(await browse(parsed.data), { headers: { "Cache-Control": "no-store" } });
});
