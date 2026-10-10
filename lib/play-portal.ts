import { localePath, t, type Locale } from "@/lib/i18n/config";
import { playGamePath, playReviewId } from "@/lib/play";
import type { Playable, PlayMood, RatingSummary } from "@/types/content";

export type PlayBadge = "new" | "top";

/** A playable game as the portal shows it: already localized, safe to hand to client components. */
export interface PortalGame {
  slug: string;
  title: string;
  /** The game's own page, locale included. */
  href: string;
  poster: string;
  genre: string;
  summary: string;
  moods: PlayMood[];
  badges: PlayBadge[];
  rating?: { average: number; count: number };
}

/** A game needs at least this average before it is called top rated. */
const TOP_RATED_FROM = 4;

/** Every playable game, in listing order, with its badges worked out. */
export function presentPlayables(
  games: Playable[],
  locale: Locale,
  ratings: Map<string, RatingSummary>,
): PortalGame[] {
  // Listing order breaks ties, so the first of several games added on one day is the new one.
  const newest = games.reduce<Playable | undefined>((a, b) => (!a || b.added > a.added ? b : a), undefined);
  const rated = games.map((game) => ({ game, rating: ratings.get(playReviewId(game)) }));
  const best = rated
    .filter(({ rating }) => rating && rating.average >= TOP_RATED_FROM)
    .sort((a, b) => b.rating!.average - a.rating!.average || b.rating!.count - a.rating!.count)[0]?.game;

  return rated.map(({ game, rating }) => ({
    slug: game.slug,
    title: game.title,
    href: localePath(locale, playGamePath(game)),
    poster: game.poster,
    genre: t(game.genre, locale),
    summary: t(game.summary, locale),
    moods: game.moods,
    badges: [...(game === newest ? ["new" as const] : []), ...(game === best ? ["top" as const] : [])],
    rating: rating && { average: rating.average, count: rating.count },
  }));
}
