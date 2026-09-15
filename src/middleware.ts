import { NextResponse, type NextRequest } from "next/server";
export function middleware(req: NextRequest) {
  const authed = req.cookies.get("fc_session")?.value === "1";
  const { pathname } = req.nextUrl;
  if (pathname === "/login") { return authed ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next(); }
  if (!authed) { const url = new URL("/login", req.url); url.searchParams.set("next", pathname); return NextResponse.redirect(url); }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json).*)"] };
