/**
 * FRENZY: an endless run for players who want to keep shooting. A run plays random matches the player has already
 * cleared, one shot each. A goal adds to the streak and the score; a miss costs one of three lives. Every five goals
 * the next matches come from a harder world (if the player has cleared one), and a bonus life is given, up to three.
 */

/** Lives at the start of a run, and the most a run can hold. */
export const FRENZY_LIVES = 3;
/** Goals between one bonus life (and one step up in difficulty). */
export const FRENZY_BONUS_EVERY = 5;
/** Coins a goal pays in a run. */
export const FRENZY_COIN_PER_GOAL = 2;
/** FRENZY opens once this match (match 4) has been cleared. */
export const FRENZY_UNLOCK_ID = 'm04-ice-rink';

/** FRENZY is open once match 4 has been scored on. `goalsOf` gives a level's goals (0 when it was never scored). */
export const frenzyUnlocked = (goalsOf: (levelId: string) => number): boolean => goalsOf(FRENZY_UNLOCK_ID) > 0;

/** Lives after a goal: a bonus life every five goals, never more than three. */
export const livesAfterGoal = (lives: number, goals: number): number =>
  goals > 0 && goals % FRENZY_BONUS_EVERY === 0 ? Math.min(FRENZY_LIVES, lives + 1) : lives;

/**
 * The matches a run can pick its next shot from: the cleared ones of the world the run has reached. A run starts in
 * world 1. Every five goals it moves up a world, as far as the player has cleared a match there. When no cleared
 * match is in that world, the nearest cleared world below it is used. `cleared` holds level indices (matches only,
 * no tutorial lessons) and `chapterOf` gives a level's world, counted from 1.
 */
export function frenzyPool(cleared: readonly number[], chapterOf: (index: number) => number, goals: number): number[] {
  if (cleared.length === 0) return [];
  const tier = Math.floor(goals / FRENZY_BONUS_EVERY);
  const highest = Math.max(...cleared.map(chapterOf));
  const target = Math.min(highest, 1 + tier);
  const exact = cleared.filter((i) => chapterOf(i) === target);
  if (exact.length > 0) return exact;
  const below = cleared.map(chapterOf).filter((c) => c <= target);
  const world = below.length > 0 ? Math.max(...below) : Math.min(...cleared.map(chapterOf));
  return cleared.filter((i) => chapterOf(i) === world);
}

/** A run in progress, as the game keeps it. */
export interface FrenzyRun {
  lives: number;
  /** Goals in this run. */
  goals: number;
  /** Goals in a row (a miss breaks it). */
  streak: number;
  bestStreak: number;
  /** The run's score: the Crazy Score of every goal. */
  score: number;
  /** Coins this run has paid out. */
  coins: number;
  /** The run has ended: the RUN OVER card is up. */
  over: boolean;
}

export const newFrenzyRun = (): FrenzyRun => ({ lives: FRENZY_LIVES, goals: 0, streak: 0, bestStreak: 0, score: 0, coins: 0, over: false });
