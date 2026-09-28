import { getDb } from "./db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function loginAllowed(key: string) {
  const attempt = await getDb().loginAttempt.findUnique({ where: { key } });
  return !attempt || Date.now() - attempt.firstAttemptAt.getTime() > WINDOW_MS || attempt.count < MAX_ATTEMPTS;
}

export async function noteFailure(key: string) {
  const db = getDb();
  const now = new Date();
  const previous = await db.loginAttempt.findUnique({ where: { key } });
  if (!previous || now.getTime() - previous.firstAttemptAt.getTime() > WINDOW_MS) {
    await db.loginAttempt.upsert({ where: { key }, create: { key, count: 1, firstAttemptAt: now }, update: { count: 1, firstAttemptAt: now } });
  } else {
    await db.loginAttempt.update({ where: { key }, data: { count: { increment: 1 } } });
  }
  await db.loginAttempt.deleteMany({ where: { firstAttemptAt: { lt: new Date(now.getTime() - WINDOW_MS) } } });
}

export async function clearFailure(key: string) {
  await getDb().loginAttempt.deleteMany({ where: { key } });
}
