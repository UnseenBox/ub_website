import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { seedContent } from "@/data/seed";
import type { Experience, Game, Service, SiteContent } from "@/types/content";
import { getStore } from "./store";

export const CONTENT_TAG = "site-content";

/**
 * Public read path. Cached across requests with a tag so admin saves can
 * invalidate it (see lib/content/mutations.ts). React `cache` dedupes calls
 * within a single render.
 */
const readCachedContent = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const stored = await getStore().readContent();
      return stored ?? seedContent;
    } catch (error) {
      console.error("[content] Falling back to seed content:", error);
      return seedContent;
    }
  },
  ["site-content-v1"],
  { tags: [CONTENT_TAG] },
);

export const getContent = cache(readCachedContent);

/** Uncached read for the admin, which must always see the latest data. */
export async function getContentFresh(): Promise<SiteContent> {
  return (await getStore().readContent()) ?? structuredClone(seedContent);
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function getStudio() {
  return (await getContent()).studio;
}

export async function getGames(): Promise<Game[]> {
  return [...(await getContent()).games].sort(byOrder);
}

export async function getReleasedGames(): Promise<Game[]> {
  return (await getGames()).filter((game) => !game.upcoming);
}

export async function getUpcomingGames(): Promise<Game[]> {
  return (await getGames()).filter((game) => game.upcoming);
}

export async function getGameBySlug(slug: string): Promise<Game | undefined> {
  return (await getContent()).games.find((game) => game.slug === slug);
}

export async function getServices(): Promise<Service[]> {
  return [...(await getContent()).services].sort(byOrder);
}

export async function getExperiences(): Promise<Experience[]> {
  return [...(await getContent()).experiences].sort(
    (a, b) => b.date.localeCompare(a.date) || a.order - b.order,
  );
}

export async function getExperienceBySlug(slug: string): Promise<Experience | undefined> {
  return (await getContent()).experiences.find((item) => item.slug === slug);
}
