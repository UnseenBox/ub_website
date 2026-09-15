import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContactMessage, SiteContent } from "@/types/content";

/**
 * Storage adapter. The site only ever needs two JSON documents:
 * the public content and the private contact inbox.
 *
 *  - FileStore   → local development / self-hosting (.data/*.json)
 *  - RedisStore  → Vercel production (Upstash REST API, zero dependencies)
 *  - ReadOnly    → Vercel without storage configured: seed content, no saves
 *
 * Add another adapter (Postgres, Vercel Blob, a headless CMS…) by implementing
 * this interface and returning it from getStore().
 */
export interface ContentStore {
  readonly kind: "file" | "redis" | "readonly";
  readonly writable: boolean;
  readContent(): Promise<SiteContent | null>;
  writeContent(content: SiteContent): Promise<void>;
  readMessages(): Promise<ContactMessage[]>;
  writeMessages(messages: ContactMessage[]): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Content storage is read-only. Connect Upstash Redis (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) to save changes in production.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

/* ------------------------------------------------------------------ */

class FileStore implements ContentStore {
  readonly kind = "file" as const;
  readonly writable = true;
  private dir = path.join(process.cwd(), ".data");

  private async readJson<T>(name: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(path.join(this.dir, name), "utf8");
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async writeJson(name: string, data: unknown) {
    await fs.mkdir(this.dir, { recursive: true });
    const target = path.join(this.dir, name);
    const temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(temp, target);
  }

  readContent() {
    return this.readJson<SiteContent>("content.json");
  }
  writeContent(content: SiteContent) {
    return this.writeJson("content.json", content);
  }
  async readMessages() {
    return (await this.readJson<ContactMessage[]>("messages.json")) ?? [];
  }
  writeMessages(messages: ContactMessage[]) {
    return this.writeJson("messages.json", messages);
  }
}

/* ------------------------------------------------------------------ */

class RedisStore implements ContentStore {
  readonly kind = "redis" as const;
  readonly writable = true;

  constructor(
    private url: string,
    private token: string,
    private prefix: string,
  ) {}

  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const payload = (await response.json()) as { result?: T; error?: string };
    if (!response.ok || payload.error) {
      throw new Error(`Redis command failed: ${payload.error ?? response.statusText}`);
    }
    return payload.result as T;
  }

  private async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.command<string | null>(["GET", `${this.prefix}:${key}`]);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  private async setJson(key: string, value: unknown) {
    await this.command(["SET", `${this.prefix}:${key}`, JSON.stringify(value)]);
  }

  readContent() {
    return this.getJson<SiteContent>("content");
  }
  writeContent(content: SiteContent) {
    return this.setJson("content", content);
  }
  async readMessages() {
    return (await this.getJson<ContactMessage[]>("messages")) ?? [];
  }
  writeMessages(messages: ContactMessage[]) {
    return this.setJson("messages", messages);
  }
}

/* ------------------------------------------------------------------ */

class ReadOnlyStore implements ContentStore {
  readonly kind = "readonly" as const;
  readonly writable = false;
  async readContent() {
    return null;
  }
  async writeContent(): Promise<void> {
    throw new StorageNotConfiguredError();
  }
  async readMessages() {
    return [];
  }
  async writeMessages(): Promise<void> {
    throw new StorageNotConfiguredError();
  }
}

/* ------------------------------------------------------------------ */

let store: ContentStore | undefined;

export function getStore(): ContentStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const prefix = process.env.CONTENT_KEY_PREFIX || "unseenbox";

  if (url && token) store = new RedisStore(url.replace(/\/$/, ""), token, prefix);
  else if (process.env.VERCEL) store = new ReadOnlyStore();
  else store = new FileStore();
  return store;
}
