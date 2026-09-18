import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { credentialsConfigured, currentUsername, verifyCredentials } from "./credentials";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

export const adminConfigured = credentialsConfigured;
export const checkCredentials = verifyCredentials;

/**
 * A session is valid when its signature holds AND it names the current admin,
 * so changing the username in Settings signs the old sessions out. proxy.ts
 * only checks the signature — it runs before the database is reachable — which
 * is why the identity check lives here, in front of every admin page.
 */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const expected = await currentUsername();
  return expected && session.sub === expected ? session : null;
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
