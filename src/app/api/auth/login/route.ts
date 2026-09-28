import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/server/db";
import { setSession } from "@/lib/server/session";
import { loginAllowed, noteFailure, clearFailure } from "@/lib/server/login-throttle";

const input = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1) });
const ABSENT_USER_HASH = "$2b$12$D2MOdKxhiOIBl45pGoTEZ.0zlMCk4dqQxsDcRs7UcRzgBOhdT3Zlu";

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  const key = `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"}:${parsed.data.username.toLowerCase()}`.slice(0, 200);
  if (!(await loginAllowed(key))) return NextResponse.json({ error: "Too many attempts. Try later." }, { status: 429 });
  const user = await getDb().user.findUnique({ where: { username: parsed.data.username } });
  const validPassword = await compare(parsed.data.password, user?.passwordHash ?? ABSENT_USER_HASH);
  if (!user?.isActive || !validPassword) {
    await noteFailure(key);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await clearFailure(key);
  await setSession(user.id);
  return NextResponse.json({ username: user.username });
}
