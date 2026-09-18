import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { seedContent } from "@/data/seed";
import type { Experience, Game, PublicSettings, RatingSummary, Review, Service, SiteContent } from "@/types/content";
import { getStore } from "./store";

export const CONTENT_TAG = "site-content";
export const REVIEWS_TAG = "site-reviews";
export const SETTINGS_TAG = "site-settings";

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

/* ------------------------------------------------------------------ */
/* Community reviews                                                   */
/* ------------------------------------------------------------------ */

/** Approved reviews only — the pending queue is admin-side. */
const readCachedReviews = unstable_cache(
  async (): Promise<Review[]> => {
    try {
      return await getStore().listReviews("approved");
    } catch (error) {
      console.error("[reviews] Could not load reviews:", error);
      return [];
    }
  },
  ["site-reviews-v1"],
  { tags: [REVIEWS_TAG] },
);

export const getApprovedReviews = cache(readCachedReviews);

export async function getReviewsForGame(gameId: string): Promise<Review[]> {
  return (await getApprovedReviews()).filter((review) => review.gameId === gameId);
}

/** Average rating per game, keyed by game id. */
export async function getRatings(): Promise<Map<string, RatingSummary>> {
  const summaries = new Map<string, RatingSummary>();
  for (const review of await getApprovedReviews()) {
    const current = summaries.get(review.gameId) ?? { gameId: review.gameId, average: 0, count: 0 };
    const total = current.average * current.count + review.rating;
    current.count += 1;
    current.average = total / current.count;
    summaries.set(review.gameId, current);
  }
  return summaries;
}

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

/**
 * Only the fields a page may render. The admin credentials in the same row
 * never leave this module — see lib/auth/credentials.ts for those.
 */
const readCachedSettings = unstable_cache(
  async (): Promise<PublicSettings> => {
    try {
      const settings = await getStore().readSettings();
      return { favicon: settings?.favicon, shareImage: settings?.shareImage };
    } catch (error) {
      console.error("[settings] Could not load settings:", error);
      return {};
    }
  },
  ["site-settings-v1"],
  { tags: [SETTINGS_TAG] },
);

export const getPublicSettings = cache(readCachedSettings);
