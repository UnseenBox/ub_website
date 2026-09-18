import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getStore } from "@/lib/content/store";
import type { SiteSettings } from "@/types/content";

/**
 * Admin credentials.
 *
 * ADMIN_USERNAME / ADMIN_PASSWORD from the environment are the starting
 * point. Once an admin changes them in Settings, the stored pair takes over:
 * the username in plain text, the password only as a scrypt hash. The
 * environment values stay as a fallback, so a forgotten password can still be
 * reset by editing the environment variables and clearing the stored ones.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Constant-time comparison that does not leak length. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function readSettings(): Promise<SiteSettings | null> {
  try {
    return await getStore().readSettings();
  } catch (error) {
    console.error("[auth] Could not read settings; falling back to the environment:", error);
    return null;
  }
}

/** The username a session must carry to count as the admin. */
export async function currentUsername(): Promise<string> {
  const settings = await readSettings();
  return settings?.adminUsername?.trim() || process.env.ADMIN_USERNAME || "";
}

export async function credentialsConfigured(): Promise<boolean> {
  const settings = await readSettings();
  if (settings?.adminPasswordHash && settings.adminUsername) return true;
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

/** True when the pair matches the stored credentials, or the environment ones. */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const settings = await readSettings();

  if (settings?.adminPasswordHash && settings.adminUsername) {
    // Evaluate both sides so a wrong username costs the same as a wrong password.
    const userOk = safeEqual(username, settings.adminUsername);
    const passOk = verifyPassword(password, settings.adminPasswordHash);
    return userOk && passOk;
  }

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}

/** Saves a new username and/or password. The password is hashed before storage. */
export async function saveCredentials(username: string, password?: string): Promise<void> {
  const store = getStore();
  const current = (await store.readSettings()) ?? { updatedAt: new Date().toISOString() };
  await store.writeSettings({
    ...current,
    adminUsername: username,
    adminPasswordHash: password ? hashPassword(password) : current.adminPasswordHash,
    updatedAt: new Date().toISOString(),
  });
}
