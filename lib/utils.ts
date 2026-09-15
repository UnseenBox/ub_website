import type { Locale } from "@/types/content";

type ClassValue = string | false | null | undefined | 0;

/** Tiny className joiner — avoids pulling in clsx/tailwind-merge. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  // Latin digits keep dates consistent with the rest of the editorial UI.
  ar: "ar-u-nu-latn",
};

export function formatDate(
  iso: string | undefined,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  if (!iso) return "";
  const date = new Date(iso.length === 7 ? `${iso}-01` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", ...options }).format(date);
}

export function formatMonth(iso: string | undefined, locale: Locale): string {
  return formatDate(iso, locale, { year: "numeric", month: "short" });
}

/** "2024-11-03" -> "2024.11" — used for archive stamps. */
export function stampDate(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return m ? `${y}.${m}` : y;
}

export function pad(n: number, size = 2): string {
  return String(n).padStart(size, "0");
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function newId(prefix = "id"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

/** Split text into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
