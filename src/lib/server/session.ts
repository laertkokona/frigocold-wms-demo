import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";

export const COOKIE = "frigocold_session";
const TTL = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function signSession(userId: string) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${TTL}s`).sign(secret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch { return null; }
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  const userId = token ? await verifySession(token) : null;
  return userId ? getDb().user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, username: true } }) : null;
}

export async function setSession(userId: string) {
  (await cookies()).set(COOKIE, await signSession(userId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
