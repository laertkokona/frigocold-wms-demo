import { withRequestLog } from "@/lib/server/request-log";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/session";

export const POST = withRequestLog({ route: "/api/auth/logout", action: "logout" }, async () => {
  await clearSession();
  return NextResponse.json({ ok: true });
});
