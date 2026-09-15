/**
 * Stateless, signed admin session (HMAC-SHA256 via Web Crypto).
 * Runtime-agnostic so it can be used from proxy.ts and server code alike.
 *
 * Upgrade path: replace `createSessionToken` / `verifySessionToken` with a
 * provider (Auth.js, Clerk, WorkOS…) — every caller goes through
 * lib/auth/guard.ts, so nothing else needs to change.
 */

export const SESSION_COOKIE = "ub_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The signing secret. In production ADMIN_SESSION_SECRET is mandatory.
 * In development a secret is derived from the admin password so the panel
 * works out of the box.
 */
export function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_PASSWORD) {
    return `dev-only::${process.env.ADMIN_PASSWORD}::unseenbox-session`;
  }
  return null;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(subject: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is missing or shorter than 32 characters.");
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: subject, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64url(signature)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64url(signature) as BufferSource,
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.sub !== process.env.ADMIN_USERNAME) return null;
    return payload;
  } catch {
    return null;
  }
}
