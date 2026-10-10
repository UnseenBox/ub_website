import type { MetadataRoute } from "next";
import { getContent, getPlayables } from "@/lib/content/queries";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { playGamePath } from "@/lib/play";
import { languageAlternates } from "@/lib/seo";
import { siteUrl } from "@/lib/utils";

const STATIC_PATHS = ["/", "/games", "/upcoming", "/services", "/experiences", "/community", "/about", "/contact", "/play"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [{ games, experiences, updatedAt }, playables] = await Promise.all([getContent(), getPlayables()]);

  const entries: { path: string; lastModified: string; priority: number }[] = [
    ...STATIC_PATHS.map((path) => ({ path, lastModified: updatedAt, priority: path === "/" ? 1 : 0.8 })),
    ...games.map((game) => ({ path: `/games/${game.slug}`, lastModified: game.updatedAt, priority: 0.9 })),
    ...playables.map((game) => ({ path: playGamePath(game), lastModified: game.updatedAt, priority: 0.8 })),
    ...experiences.map((item) => ({ path: `/experiences/${item.slug}`, lastModified: updatedAt, priority: 0.6 })),
  ];

  return entries.flatMap(({ path, lastModified, priority }) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(path)).map(([lang, href]) => [lang, `${base}${href}`]),
    );
    return LOCALES.map((locale) => ({
      url: `${base}${localePath(locale, path)}`,
      lastModified: new Date(lastModified),
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages },
    }));
  });
}
