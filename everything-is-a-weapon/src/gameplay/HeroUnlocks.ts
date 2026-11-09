import { HEROES, type HeroId } from '../core/Hero';

/** The numbers an unlock rule may look at. All of them already live in the save. */
export interface HeroProgress {
  /** Deepest campaign room cleared (1-based). */
  deepest: number;
  endlessBestFloor: number;
  discoveries: number;
}

export interface HeroUnlock {
  readonly hero: HeroId;
  /** Shown on the locked card, e.g. "CLEAR 3 ROOMS". */
  readonly goal: string;
  readonly target: number;
  readonly current: (progress: HeroProgress) => number;
}

/**
 * The first hero is free, the next comes with the first session, the rest take a few
 * days of play: a visible next goal on the menu is half the reason to come back.
 */
export const HERO_UNLOCKS: readonly HeroUnlock[] = [
  { hero: 'flatmate', goal: 'CLEAR 3 ROOMS', target: 3, current: (p) => p.deepest },
  { hero: 'kid', goal: 'FIND 30 BAD IDEAS', target: 30, current: (p) => p.discoveries },
  { hero: 'gran', goal: 'REACH ENDLESS FLOOR 5', target: 5, current: (p) => p.endlessBestFloor },
];

export function unlockRule(hero: HeroId): HeroUnlock | null {
  return HERO_UNLOCKS.find((rule) => rule.hero === hero) ?? null;
}

export function heroMet(hero: HeroId, progress: HeroProgress): boolean {
  const rule = unlockRule(hero);
  return !rule || rule.current(progress) >= rule.target;
}

/** Heroes whose rule is met but are not yet in the owned list. */
export function newlyUnlocked(owned: readonly string[], progress: HeroProgress): HeroId[] {
  return HEROES.filter((hero) => !owned.includes(hero.id) && heroMet(hero.id, progress)).map((hero) => hero.id);
}

/** The owned list as it should be stored: tenant always, no unknown ids, no repeats. */
export function ownedHeroes(raw: readonly string[]): HeroId[] {
  const known = new Set(HEROES.map((hero) => hero.id as string));
  const out = new Set<HeroId>(['tenant']);
  for (const id of raw) if (known.has(id)) out.add(id as HeroId);
  return [...out];
}
