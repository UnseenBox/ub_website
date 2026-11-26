import type { Playable } from "@/types/content";

/**
 * Arcade text that went out of date after a store had already been seeded with it. Stored
 * rows win over the seed, so exactly the old line is swapped for the seed's current one.
 * Anything edited in the admin no longer matches, and is left alone. An entry can go once
 * the stored row has been updated.
 */
const OUTDATED_PHONE_TEXT: Record<string, string> = {
  play_fogline:
    "Best on a computer with a mouse and keyboard. The bunker line does not take touch controls yet.",
};

export function refreshOutdatedCopy(game: Playable, seeds: readonly Playable[]): Playable {
  if (OUTDATED_PHONE_TEXT[game.id] !== game.phoneControls.en) return game;
  const seed = seeds.find((item) => item.id === game.id);
  return seed ? { ...game, phoneControls: seed.phoneControls } : game;
}
