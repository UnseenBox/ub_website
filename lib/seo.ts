import type { Metadata } from "next";
import { LOCALES, LOCALE_META, localePath, type Locale } from "@/lib/i18n/config";
import { resolveImageSrc } from "@/lib/images/drive";
import { siteUrl } from "@/lib/utils";

interface PageMetaInput {
  locale: Locale;
  /** Path without locale, e.g. "/games/pale-orbit". */
  path: string;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
  /** Use the title as-is instead of applying the "— UnseenBox" template. */
  absoluteTitle?: boolean;
}

export function languageAlternates(path: string) {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[LOCALE_META[locale].hreflang] = localePath(locale, path);
  languages["x-default"] = localePath("en", path);
  return languages;
}

export function buildMetadata({
  locale,
  path,
  title,
  description,
  image,
  type = "website",
  absoluteTitle,
}: PageMetaInput): Metadata {
  const resolved = resolveImageSrc(image) ?? "/media/og/default.png";
  const url = localePath(locale, path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: "UnseenBox",
      locale: LOCALE_META[locale].ogLocale,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => LOCALE_META[l].ogLocale),
      images: [{ url: resolved, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolved],
    },
  };
}

export function absoluteUrl(path: string) {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Serialise JSON-LD safely for a <script> tag. */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
