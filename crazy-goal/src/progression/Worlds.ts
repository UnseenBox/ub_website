import type { Theme } from '../levels/LevelDefinition';
import { CHAPTERS, chapterOf, chapterStart, chapterTitle } from './Progression';

/**
 * WORLDS: the campaign's chapters, seen as milestones. The last match of each world is its BOSS MATCH. Clearing
 * it the first time completes the world: a trophy, a reward, and a WORLD COMPLETE panel that previews the next.
 */

/** Coins paid the first time a world is completed. */
export const WORLD_REWARD = 100;
/** Goals on a boss match pay twice the usual coins. */
export const BOSS_COIN_MULTIPLIER = 2;

/** How many worlds there are (one trophy each). */
export const WORLD_COUNT = CHAPTERS.length;

/** Index range [from, to) of a world's levels, given how many levels the campaign has. */
export function worldRange(world: number, count: number): [number, number] {
  const from = chapterStart(world);
  const to = world >= CHAPTERS.length ? count : Math.min(count, chapterStart(world + 1));
  return [from, to];
}

/** The index of each world's boss match: the last level of every world. */
export function bossIndices(count: number): number[] {
  return CHAPTERS.map((chapter, i) => (i === CHAPTERS.length - 1 ? count - 1 : Math.min(chapter.until, count) - 1));
}

/** True for the last level of a world. */
export const isBossIndex = (index: number, count: number): boolean => bossIndices(count).includes(index);

/** The world a level belongs to (counted from 1). */
export const worldOf = (index: number): number => chapterOf(index);

/** The world's English title; `tr()` translates it where it is shown. */
export const worldTitle = (world: number): string => chapterTitle(world);

/** The stars won in a world, and the most it can give (three for each level in it). */
export function worldStars(world: number, count: number, starsOf: (index: number) => number): { stars: number; max: number } {
  const [from, to] = worldRange(world, count);
  let stars = 0;
  for (let i = from; i < to; i++) stars += Math.min(3, Math.max(0, starsOf(i)));
  return { stars, max: 3 * (to - from) };
}

/** The world after this one, or null after the last. */
export const nextWorld = (world: number): number | null => (world < WORLD_COUNT ? world + 1 : null);

/** Coin multiplier and crowd excitement on a boss match: the crowd flashes harder than in any other match. */
export const BOSS_CROWD_EXCITEMENT = 0.55;

/** How a world's theme is named on the WORLD COMPLETE panel. */
export const worldThemeName = (theme: Theme | undefined): string => THEME_NAMES[theme ?? 'stadium'];

const THEME_NAMES: Readonly<Record<Theme, string>> = {
  street: 'STREET',
  pitch: 'PITCH',
  stadium: 'STADIUM',
  beach: 'BEACH',
  court: 'COURT',
  clay: 'CLAY',
  roof: 'ROOFTOP',
  snow: 'SNOW',
  sunset: 'SUNSET',
  night: 'NIGHT',
};
