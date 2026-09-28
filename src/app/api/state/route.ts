import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";
import { getState } from "@/lib/server/state";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getState(), { headers: { "Cache-Control": "no-store" } });
}
