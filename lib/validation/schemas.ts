import { z } from "zod";
import {
  EXPERIENCE_TYPES,
  GAME_STATUSES,
  GLYPHS,
  LINK_KINDS,
  PLATFORMS,
  SOCIAL_PLATFORMS,
} from "@/types/content";

const text = (max: number) => z.string().trim().max(max).default("");

export const localized = (max = 4000) => z.object({ en: text(max), fr: text(max), ar: text(max) });

/** English is the fallback language, so it is required where content is essential. */
export const localizedRequired = (max = 4000) =>
  z.object({ en: z.string().trim().min(1, "English text is required").max(max), fr: text(max), ar: text(max) });

const imageRef = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || v.startsWith("/") || v.startsWith("https://") || v.startsWith("drive:"), {
    message: "Use a https:// URL, a Google Drive link, drive:<id> or a /media/ path",
  });

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\/[^\s]+$/.test(v), { message: "Must be a full http(s) URL" });

const optionalUrl = z.union([z.literal(""), httpUrl]).default("");
const isoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use YYYY-MM or YYYY-MM-DD")]);
const slug = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");
const id = z.string().trim().min(1).max(80);

export const gameSchema = z.object({
  id,
  slug,
  title: z.string().trim().min(1, "Title is required").max(120),
  tagline: localizedRequired(200),
  summary: localizedRequired(400),
  description: localized(8000),
  genre: localized(80),
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length),
  status: z.enum(GAME_STATUSES),
  releaseDate: isoDate.optional(),
  estimatedRelease: localized(60).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  poster: imageRef,
  cover: imageRef,
  screenshots: z.array(imageRef).max(40).transform((list) => list.filter(Boolean)),
  trailerUrl: optionalUrl.optional(),
  links: z
    .array(z.object({ kind: z.enum(LINK_KINDS), url: httpUrl, label: text(40).optional() }))
    .max(20),
  features: z.array(localized(200)).max(20).transform((list) => list.filter((f) => f.en || f.fr || f.ar)),
  devNotes: z
    .array(z.object({ id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"), text: localizedRequired(1000) }))
    .max(200),
  engine: text(60).optional(),
  accent: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #8f5bff")]).optional(),
  featured: z.boolean(),
  upcoming: z.boolean(),
  order: z.coerce.number().int().min(0).max(9999),
  updatedAt: z.string().optional(),
});

export const serviceSchema = z.object({
  id,
  title: localizedRequired(80),
  kicker: localized(160),
  description: localized(1200),
  deliverables: z.array(localized(60)).max(12).transform((list) => list.filter((d) => d.en || d.fr || d.ar)),
  glyph: z.enum(GLYPHS),
  order: z.coerce.number().int().min(0).max(9999),
});

export const experienceSchema = z.object({
  id,
  slug,
  title: localizedRequired(140),
  type: z.enum(EXPERIENCE_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use YYYY-MM or YYYY-MM-DD"),
  location: localized(120),
  client: text(120).optional(),
  summary: localizedRequired(400),
  body: localized(8000),
  cover: imageRef,
  images: z.array(imageRef).max(40).transform((list) => list.filter(Boolean)),
  link: optionalUrl.optional(),
  order: z.coerce.number().int().min(0).max(9999),
});

const belief = z.object({ id, title: localizedRequired(120), text: localized(400) });
const milestone = z.object({ id, year: z.string().trim().min(1).max(12), title: localizedRequired(120), text: localized(400) });

export const studioSchema = z.object({
  name: z.string().trim().min(1).max(60),
  foundedYear: z.string().trim().max(12),
  email: z.email("A valid email is required"),
  pressEmail: z.union([z.literal(""), z.email()]).optional(),
  phone: text(40).optional(),
  city: localized(80),
  country: localized(80),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown IANA time zone (e.g. Africa/Algiers)"),
  tagline: localizedRequired(200),
  intro: localizedRequired(4000),
  manifesto: localizedRequired(600),
  approach: localized(2000),
  ambition: localized(1000),
  beliefs: z.array(belief).max(12),
  timeline: z.array(milestone).max(40),
  socials: z
    .array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: z.union([z.literal(""), httpUrl]) }))
    .max(SOCIAL_PLATFORMS.length)
    .transform((list) => list.filter((s) => s.url)),
  availability: localized(160),
});

export type GameInput = z.input<typeof gameSchema>;

/** Flatten zod issues to "path: message" strings for the admin UI. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 12).map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
