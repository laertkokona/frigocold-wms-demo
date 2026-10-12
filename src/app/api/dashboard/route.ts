import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";
import { getDashboard } from "@/lib/server/dashboard";

export const GET = withRequestLog({ route: "/api/dashboard", action: "dashboard" }, async (_request, log) => {
  const user = await currentUser();
  if (!user) { log.reason("authentication_required"); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  log.actor(user.id);
  return NextResponse.json(await getDashboard(), { headers: { "Cache-Control": "no-store" } });
});
