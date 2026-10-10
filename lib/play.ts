import { playables as seedPlayables } from "@/data/seed/playables";
import { PLAY_MOODS, type Playable, type PlayMood } from "@/types/content";

export { PLAY_MOODS, type PlayMood };

/**
 * Games that run directly in the browser: listed on /play, played on /play/<slug>.
 *
 * The arcade is managed in the admin (Arcade page) and stored with the rest of
 * the site content. This constant is the starter set: it feeds fresh stores
 * and stands in wherever stored content predates the arcade manager.
 */
export type PlayableGame = Playable;

export const PLAYABLE_GAMES: PlayableGame[] = seedPlayables;

/*
 * Playable games take reviews like catalogue games do. Their review id is
 * prefixed so it can never collide with a catalogue id (`game_…`).
 */
const PLAY_REVIEW_PREFIX = "play_";

export function playReviewId(game: { slug: string }): string {
  return `${PLAY_REVIEW_PREFIX}${game.slug}`;
}

export function findPlayableByReviewId(games: PlayableGame[], id: string): PlayableGame | undefined {
  return games.find((game) => playReviewId(game) === id);
}

export function findPlayable(games: PlayableGame[], slug: string): PlayableGame | undefined {
  return games.find((game) => game.slug === slug);
}

/** A playable game's own page, relative to the locale root. */
export function playGamePath(game: { slug: string }): string {
  return `/play/${game.slug}`;
}

/** Where a review's game lives on the site, relative to the locale root. */
export function reviewGamePath(review: { gameId: string; gameSlug: string }): string {
  return review.gameId.startsWith(PLAY_REVIEW_PREFIX)
    ? playGamePath({ slug: review.gameSlug })
    : `/games/${review.gameSlug}`;
}
