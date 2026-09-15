import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/** Constant-time comparison that does not leak length. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  // Evaluate both to avoid short-circuit timing differences.
  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Data-access-layer guard. Call at the top of every admin page and every
 * admin Server Action — proxy.ts is only the first line of defence.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/* Naive per-instance login throttle: 8 attempts / 10 minutes per key. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function isThrottled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
