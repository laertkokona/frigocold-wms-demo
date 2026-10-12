import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/state";

export const GET = withRequestLog({ route: "/api/state", action: "state" }, async (_request, log) => {
  const user = await currentUser();
  if (!user) { log.reason("authentication_required"); return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  log.actor(user.id);
  return NextResponse.json(await getState(), { headers: { "Cache-Control": "no-store" } });
});
