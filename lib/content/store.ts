import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { seedContent } from "@/data/seed";
import { ensureReady, getSql, hasDatabase } from "@/lib/db/client";
import {
  EXPERIENCE_COLUMNS,
  GAME_COLUMNS,
  SERVICE_COLUMNS,
  experienceParams,
  gameParams,
  json,
  serviceParams,
  toExperience,
  toGame,
  toMessage,
  toService,
  toStudio,
  type ExperienceRow,
  type GameRow,
  type MessageRow,
  type ServiceRow,
} from "@/lib/db/rows";
import { UNIQUE_VIOLATION } from "@/lib/db/schema";
import {
  TOUCH_META,
  UPSERT_EXPERIENCE,
  UPSERT_GAME,
  UPSERT_SERVICE,
  UPSERT_STUDIO,
} from "@/lib/db/statements";
import type {
  ContactMessage,
  Experience,
  Game,
  Service,
  SiteContent,
  StudioInfo,
} from "@/types/content";

/**
 * Storage adapter.
 *
 *  - PostgresStore → Neon: one row per game / service / archive entry
 *  - FileStore     → local development without a database (.data/*.json)
 *  - ReadOnlyStore → deployed without a database: seed content, no saves
 *
 * Every write is a single entity, so two editors saving different items can
 * no longer overwrite each other the way a whole-document write would.
 */
export interface ContentStore {
  readonly kind: "postgres" | "file" | "readonly";
  readonly writable: boolean;

  readContent(): Promise<SiteContent | null>;

  saveGame(game: Game): Promise<void>;
  deleteGame(id: string): Promise<void>;
  saveService(service: Service): Promise<void>;
  saveServices(services: Service[]): Promise<void>;
  deleteService(id: string): Promise<void>;
  saveExperience(experience: Experience): Promise<void>;
  deleteExperience(id: string): Promise<void>;
  saveStudio(studio: StudioInfo): Promise<void>;

  listMessages(): Promise<ContactMessage[]>;
  addMessage(message: ContactMessage): Promise<void>;
  setMessageRead(id: string, read: boolean): Promise<void>;
  deleteMessage(id: string): Promise<void>;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Content storage is read-only. Connect a Neon database (DATABASE_URL) and redeploy to save changes.");
    this.name = "StorageNotConfiguredError";
  }
}

/** A slug is already taken, or another constraint rejected the write. */
export class ContentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentConflictError";
  }
}

/** Keeps the inbox bounded; older messages are pruned on insert. */
export const MESSAGE_LIMIT = 1000;

/* ------------------------------------------------------------------ */
/* Neon                                                                */
/* ------------------------------------------------------------------ */

class PostgresStore implements ContentStore {
  readonly kind = "postgres" as const;
  readonly writable = true;

  private async run<T>(statement: string, params: unknown[] = []): Promise<T[]> {
    await ensureReady();
    try {
      return (await getSql().query(statement, params)) as T[];
    } catch (error) {
      const code = (error as { code?: string }).code;
      const detail = (error as { detail?: string }).detail ?? "";
      if (code === UNIQUE_VIOLATION) {
        const slug = detail.match(/\(slug\)=\(([^)]*)\)/)?.[1];
        throw new ContentConflictError(
          slug ? `Another entry already uses the slug "${slug}".` : "That entry conflicts with an existing one.",
        );
      }
      throw error;
    }
  }

  async readContent(): Promise<SiteContent | null> {
    await ensureReady();
    const [meta, studio, games, services, experiences] = await Promise.all([
      this.run<{ version: number; updated_at: Date | string }>(`select version, updated_at from site_meta`),
      this.run<{ data: unknown }>(`select data from studio`),
      this.run<GameRow>(`select ${GAME_COLUMNS} from games order by sort_order`),
      this.run<ServiceRow>(`select ${SERVICE_COLUMNS} from services order by sort_order`),
      this.run<ExperienceRow>(`select ${EXPERIENCE_COLUMNS} from experiences order by date desc, sort_order`),
    ]);

    // No studio row means the database has never been seeded: let the caller
    // fall back to the built-in content rather than render an empty site.
    if (!studio[0]) return null;

    const updatedAt = meta[0]?.updated_at;
    return {
      version: meta[0]?.version ?? 1,
      updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? new Date().toISOString()),
      studio: toStudio(studio[0].data),
      games: games.map(toGame),
      services: services.map(toService),
      experiences: experiences.map(toExperience),
    };
  }

  private touch() {
    return this.run(TOUCH_META);
  }

  async saveGame(game: Game) {
    await this.run(UPSERT_GAME, gameParams({ ...game, updatedAt: new Date().toISOString() }));
    await this.touch();
  }

  async deleteGame(id: string) {
    await this.run(`delete from games where id = $1`, [id]);
    await this.touch();
  }

  async saveService(service: Service) {
    await this.run(UPSERT_SERVICE, serviceParams(service));
    await this.touch();
  }

  async saveServices(services: Service[]) {
    await ensureReady();
    const sql = getSql();
    await sql.transaction(services.map((service) => sql.query(UPSERT_SERVICE, serviceParams(service))));
    await this.touch();
  }

  async deleteService(id: string) {
    await this.run(`delete from services where id = $1`, [id]);
    await this.touch();
  }

  async saveExperience(experience: Experience) {
    await this.run(UPSERT_EXPERIENCE, experienceParams(experience));
    await this.touch();
  }

  async deleteExperience(id: string) {
    await this.run(`delete from experiences where id = $1`, [id]);
    await this.touch();
  }

  async saveStudio(studio: StudioInfo) {
    await this.run(UPSERT_STUDIO, [json(studio)]);
    await this.touch();
  }

  async listMessages() {
    const rows = await this.run<MessageRow>(
      `select id, name, email, topic, message, locale, created_at, read
       from messages order by created_at desc limit ${MESSAGE_LIMIT}`,
    );
    return rows.map(toMessage);
  }

  async addMessage(message: ContactMessage) {
    await this.run(
      `insert into messages (id, name, email, topic, message, locale, created_at, read)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [
        message.id,
        message.name,
        message.email,
        message.topic,
        message.message,
        message.locale,
        message.createdAt,
        message.read,
      ],
    );
    await this.run(
      `delete from messages where id in (
         select id from messages order by created_at desc offset ${MESSAGE_LIMIT}
       )`,
    );
  }

  async setMessageRead(id: string, read: boolean) {
    await this.run(`update messages set read = $2 where id = $1`, [id, read]);
  }

  async deleteMessage(id: string) {
    await this.run(`delete from messages where id = $1`, [id]);
  }
}

/* ------------------------------------------------------------------ */
/* Local files                                                         */
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

  /** Read → mutate → write, the document equivalent of a row update. */
  private async edit(mutator: (content: SiteContent) => void) {
    const content = (await this.readContent()) ?? structuredClone(seedContent);
    mutator(content);
    content.updatedAt = new Date().toISOString();
    content.version = (content.version ?? 0) + 1;
    await this.writeJson("content.json", content);
  }

  private static upsert<T extends { id: string }>(list: T[], item: T) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index === -1) list.push(item);
    else list[index] = item;
  }

  async saveGame(game: Game) {
    await this.edit((content) => {
      if (content.games.some((other) => other.slug === game.slug && other.id !== game.id)) {
        throw new ContentConflictError(`Another game already uses the slug "${game.slug}".`);
      }
      FileStore.upsert(content.games, { ...game, updatedAt: new Date().toISOString() });
    });
  }

  async deleteGame(id: string) {
    await this.edit((content) => {
      content.games = content.games.filter((game) => game.id !== id);
    });
  }

  async saveService(service: Service) {
    await this.edit((content) => FileStore.upsert(content.services, service));
  }

  async saveServices(services: Service[]) {
    await this.edit((content) => {
      for (const service of services) FileStore.upsert(content.services, service);
    });
  }

  async deleteService(id: string) {
    await this.edit((content) => {
      content.services = content.services.filter((service) => service.id !== id);
    });
  }

  async saveExperience(experience: Experience) {
    await this.edit((content) => {
      if (content.experiences.some((other) => other.slug === experience.slug && other.id !== experience.id)) {
        throw new ContentConflictError(`Another entry already uses the slug "${experience.slug}".`);
      }
      FileStore.upsert(content.experiences, experience);
    });
  }

  async deleteExperience(id: string) {
    await this.edit((content) => {
      content.experiences = content.experiences.filter((experience) => experience.id !== id);
    });
  }

  async saveStudio(studio: StudioInfo) {
    await this.edit((content) => {
      content.studio = studio;
    });
  }

  async listMessages() {
    return (await this.readJson<ContactMessage[]>("messages.json")) ?? [];
  }

  private async writeMessages(messages: ContactMessage[]) {
    await this.writeJson("messages.json", messages.slice(0, MESSAGE_LIMIT));
  }

  async addMessage(message: ContactMessage) {
    await this.writeMessages([message, ...(await this.listMessages())]);
  }

  async setMessageRead(id: string, read: boolean) {
    const messages = await this.listMessages();
    await this.writeMessages(messages.map((message) => (message.id === id ? { ...message, read } : message)));
  }

  async deleteMessage(id: string) {
    const messages = await this.listMessages();
    await this.writeMessages(messages.filter((message) => message.id !== id));
  }
}

/* ------------------------------------------------------------------ */
/* No storage                                                          */
/* ------------------------------------------------------------------ */

class ReadOnlyStore implements ContentStore {
  readonly kind = "readonly" as const;
  readonly writable = false;

  async readContent() {
    return null;
  }
  private reject(): never {
    throw new StorageNotConfiguredError();
  }
  async saveGame() {
    this.reject();
  }
  async deleteGame() {
    this.reject();
  }
  async saveService() {
    this.reject();
  }
  async saveServices() {
    this.reject();
  }
  async deleteService() {
    this.reject();
  }
  async saveExperience() {
    this.reject();
  }
  async deleteExperience() {
    this.reject();
  }
  async saveStudio() {
    this.reject();
  }
  async listMessages() {
    return [];
  }
  async addMessage() {
    this.reject();
  }
  async setMessageRead() {
    this.reject();
  }
  async deleteMessage() {
    this.reject();
  }
}

/* ------------------------------------------------------------------ */

let store: ContentStore | undefined;

export function getStore(): ContentStore {
  if (store) return store;
  if (hasDatabase()) store = new PostgresStore();
  else if (process.env.VERCEL) store = new ReadOnlyStore();
  else store = new FileStore();
  return store;
}
