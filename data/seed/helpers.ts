import type { LocalizedString } from "@/types/content";

/** Compact localized-string constructor for seed files. */
export const L = (en: string, fr: string, ar: string): LocalizedString => ({ en, fr, ar });

export const SEED_DATE = "2026-09-01T09:00:00.000Z";

export const gameMedia = (slug: string) => ({
  poster: `/media/games/${slug}/poster.webp`,
  cover: `/media/games/${slug}/cover.webp`,
  screenshots: [1, 2, 3, 4].map((n) => `/media/games/${slug}/shot-${n}.webp`),
});

export const experienceMedia = (slug: string) => ({
  cover: `/media/experiences/${slug}/cover.webp`,
  images: [1, 2, 3].map((n) => `/media/experiences/${slug}/image-${n}.webp`),
});
