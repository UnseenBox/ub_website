import type {
  ContactMessage,
  DevNote,
  Experience,
  ExperienceType,
  ExternalLink,
  Game,
  GameStatus,
  Glyph,
  LocalizedString,
  Locale,
  Platform,
  Service,
  StudioInfo,
} from "@/types/content";

/**
 * Row ⇄ domain-object mapping.
 *
 * JSONB columns come back from the driver already parsed, but parameters must
 * be stringified explicitly: the pg protocol would otherwise turn a JS array
 * into a Postgres array literal instead of JSON.
 */

export const json = (value: unknown): string => JSON.stringify(value ?? null);

const localized = (value: unknown): LocalizedString => {
  const raw = (value ?? {}) as Partial<LocalizedString>;
  return { en: raw.en ?? "", fr: raw.fr ?? "", ar: raw.ar ?? "" };
};

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Drop empty optional strings so they stay absent rather than blank. */
const text = (value: unknown): string | undefined => {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? raw : undefined;
};

const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? new Date().toISOString());

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

export interface GameRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  release_date: string | null;
  estimated_release: unknown;
  progress: number | null;
  tagline: unknown;
  summary: unknown;
  description: unknown;
  genre: unknown;
  platforms: unknown;
  poster: string;
  cover: string;
  screenshots: unknown;
  trailer_url: string | null;
  links: unknown;
  features: unknown;
  dev_notes: unknown;
  engine: string | null;
  accent: string | null;
  featured: boolean;
  upcoming: boolean;
  sort_order: number;
  updated_at: Date | string;
}

export function toGame(row: GameRow): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: localized(row.tagline),
    summary: localized(row.summary),
    description: localized(row.description),
    genre: localized(row.genre),
    platforms: list<Platform>(row.platforms),
    status: row.status as GameStatus,
    releaseDate: text(row.release_date),
    estimatedRelease: row.estimated_release ? localized(row.estimated_release) : undefined,
    progress: row.progress ?? undefined,
    poster: row.poster,
    cover: row.cover,
    screenshots: list<string>(row.screenshots),
    trailerUrl: text(row.trailer_url),
    links: list<ExternalLink>(row.links),
    features: list<LocalizedString>(row.features),
    devNotes: list<DevNote>(row.dev_notes),
    engine: text(row.engine),
    accent: text(row.accent),
    featured: row.featured,
    upcoming: row.upcoming,
    order: row.sort_order,
    updatedAt: iso(row.updated_at),
  };
}

/** Parameters for the games upsert, in column order. */
export function gameParams(game: Game): unknown[] {
  return [
    game.id,
    game.slug,
    game.title,
    game.status,
    game.releaseDate || null,
    game.estimatedRelease ? json(game.estimatedRelease) : null,
    typeof game.progress === "number" ? game.progress : null,
    json(game.tagline),
    json(game.summary),
    json(game.description),
    json(game.genre),
    json(game.platforms),
    game.poster,
    game.cover,
    json(game.screenshots),
    game.trailerUrl || null,
    json(game.links),
    json(game.features),
    json(game.devNotes),
    game.engine || null,
    game.accent || null,
    game.featured,
    game.upcoming,
    game.order,
    game.updatedAt || new Date().toISOString(),
  ];
}

export const GAME_COLUMNS = `id, slug, title, status, release_date, estimated_release, progress,
  tagline, summary, description, genre, platforms, poster, cover, screenshots, trailer_url,
  links, features, dev_notes, engine, accent, featured, upcoming, sort_order, updated_at`;

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

export interface ServiceRow {
  id: string;
  title: unknown;
  kicker: unknown;
  description: unknown;
  deliverables: unknown;
  glyph: string;
  sort_order: number;
}

export function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    title: localized(row.title),
    kicker: localized(row.kicker),
    description: localized(row.description),
    deliverables: list<LocalizedString>(row.deliverables),
    glyph: row.glyph as Glyph,
    order: row.sort_order,
  };
}

export function serviceParams(service: Service): unknown[] {
  return [
    service.id,
    json(service.title),
    json(service.kicker),
    json(service.description),
    json(service.deliverables),
    service.glyph,
    service.order,
  ];
}

export const SERVICE_COLUMNS = `id, title, kicker, description, deliverables, glyph, sort_order`;

/* ------------------------------------------------------------------ */
/* Experiences                                                         */
/* ------------------------------------------------------------------ */

export interface ExperienceRow {
  id: string;
  slug: string;
  title: unknown;
  type: string;
  date: string;
  location: unknown;
  client: string | null;
  summary: unknown;
  body: unknown;
  cover: string;
  images: unknown;
  link: string | null;
  sort_order: number;
}

export function toExperience(row: ExperienceRow): Experience {
  return {
    id: row.id,
    slug: row.slug,
    title: localized(row.title),
    type: row.type as ExperienceType,
    date: row.date,
    location: localized(row.location),
    client: text(row.client),
    summary: localized(row.summary),
    body: localized(row.body),
    cover: row.cover,
    images: list<string>(row.images),
    link: text(row.link),
    order: row.sort_order,
  };
}

export function experienceParams(experience: Experience): unknown[] {
  return [
    experience.id,
    experience.slug,
    json(experience.title),
    experience.type,
    experience.date,
    json(experience.location),
    experience.client || null,
    json(experience.summary),
    json(experience.body),
    experience.cover,
    json(experience.images),
    experience.link || null,
    experience.order,
  ];
}

export const EXPERIENCE_COLUMNS = `id, slug, title, type, date, location, client, summary, body,
  cover, images, link, sort_order`;

/* ------------------------------------------------------------------ */
/* Studio + messages                                                   */
/* ------------------------------------------------------------------ */

export function toStudio(data: unknown): StudioInfo {
  return data as StudioInfo;
}

export interface MessageRow {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  locale: string;
  created_at: Date | string;
  read: boolean;
}

export function toMessage(row: MessageRow): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    topic: row.topic,
    message: row.message,
    locale: row.locale as Locale,
    createdAt: iso(row.created_at),
    read: row.read,
  };
}
