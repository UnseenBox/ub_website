import { LOCALES, type Locale, type LocalizedString } from "@/types/content";

export { LOCALES };
export type { Locale };

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_META: Record<
  Locale,
  { label: string; short: string; dir: "ltr" | "rtl"; hreflang: string; ogLocale: string }
> = {
  en: { label: "English", short: "EN", dir: "ltr", hreflang: "en", ogLocale: "en_US" },
  fr: { label: "Français", short: "FR", dir: "ltr", hreflang: "fr", ogLocale: "fr_FR" },
  ar: { label: "العربية", short: "ع", dir: "rtl", hreflang: "ar", ogLocale: "ar_AR" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale) {
  return LOCALE_META[locale].dir;
}

/** Read a localized field, falling back to English, then any non-empty value. */
export function t(value: LocalizedString | undefined, locale: Locale): string {
  if (!value) return "";
  return value[locale]?.trim() || value.en?.trim() || value.fr?.trim() || value.ar?.trim() || "";
}

/** Prefix an internal path with the locale: ("fr", "/games") -> "/fr/games". */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Replace the locale segment of a pathname. */
export function swapLocale(pathname: string, next: Locale): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) {
    parts[1] = next;
    return parts.join("/") || `/${next}`;
  }
  return localePath(next, pathname);
}

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { base: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((item) => !Number.isNaN(item.q))
    .sort((a, b) => b.q - a.q);
  return ranked.find((item) => isLocale(item.base))?.base as Locale | undefined ?? DEFAULT_LOCALE;
}
