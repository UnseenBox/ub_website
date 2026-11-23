import type { Boost } from '../abilities/Cards';

/**
 * CLUB LEVEL: a player level that rises with every goal. A goal is worth its Crazy Score over 50, and never
 * less than 10 XP. A miss is worth nothing (the caller simply does not award it).
 *
 * `xp` is the progress into the current level, not a running total. Reaching level 2 takes 100 XP, and each step
 * after costs 60 more: 160 for level 3, 220 for level 4, and so on.
 */
export interface Club {
  level: number;
  xp: number;
}

export const CLUB_START: Club = { level: 1, xp: 0 };

/** XP a goal of this Crazy Score is worth: its score over 50, at least 10. */
export const xpForScore = (score: number): number => Math.max(10, Math.round(Math.max(0, score) / 50));

/** XP needed to go from `level` to `level + 1`: 100 for the first step, then 60 more each step. */
export const xpToNext = (level: number): number => 100 + 60 * (Math.max(1, level) - 1);

/** The free ability a level gives: levels 3, 6 and 9 each give one. */
const ABILITY_AT: Readonly<Partial<Record<number, Boost>>> = { 3: 'fire', 6: 'magnet', 9: 'rubber' };

export interface LevelReward {
  /** The level reached. */
  level: number;
  /** Coins paid for reaching it: 50 + 10 for each level. */
  coins: number;
  /** Every fifth level unlocks the next locked ball for free. */
  ball: boolean;
  /** Levels 3, 6 and 9 give a free charge of an ability. */
  ability: Boost | null;
}

export const rewardFor = (level: number): LevelReward => ({
  level,
  coins: 50 + 10 * level,
  ball: level % 5 === 0,
  ability: ABILITY_AT[level] ?? null,
});

export interface ClubGain {
  club: Club;
  /** Every level reached by this gain, in order. One big goal can take the player up several. */
  levels: LevelReward[];
}

/** Adds XP to a club and returns the new club and each level reached on the way. */
export function gainXp(club: Club, xp: number): ClubGain {
  let level = Math.max(1, club.level);
  let into = Math.max(0, club.xp) + Math.max(0, xp);
  const levels: LevelReward[] = [];
  while (into >= xpToNext(level)) {
    into -= xpToNext(level);
    level += 1;
    levels.push(rewardFor(level));
  }
  return { club: { level, xp: into }, levels };
}

/** Share of the current level already earned, from 0 to 1. */
export const clubProgress = (club: Club): number => Math.min(1, Math.max(0, club.xp) / xpToNext(club.level));

/** A ball is open when the player has the stars for it, or a club level has granted it. The free starter is always open. */
export const ballIsOpen = (skin: { need: number; id: string }, stars: number, granted: readonly string[]): boolean =>
  skin.need <= stars || granted.includes(skin.id);

/** The first ball still locked (in list order, which is by stars), or null when every ball is open. */
export function nextLockedBall<T extends { need: number; id: string }>(skins: readonly T[], stars: number, granted: readonly string[]): T | null {
  return skins.find((s) => !ballIsOpen(s, stars, granted)) ?? null;
}
