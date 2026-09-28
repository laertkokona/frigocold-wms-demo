import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";
import { getDashboard } from "@/lib/server/dashboard";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getDashboard(), { headers: { "Cache-Control": "no-store" } });
}
