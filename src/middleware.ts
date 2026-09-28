import { jwtVerify } from "jose/jwt/verify";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  const token = req.cookies.get("frigocold_session")?.value;
  let authed = false;
  if (token && process.env.SESSION_SECRET) {
    try { await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET)); authed = true; } catch { /* Expired or invalid. */ }
  }
  if (pathname === "/login") return authed ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  if (!authed) { const url = new URL("/login", req.url); url.searchParams.set("next", pathname); return NextResponse.redirect(url); }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)"] };
