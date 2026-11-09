import type { EnemyTypeId } from '../entities/EnemyTypes';
import { generateRoom } from './RoomGenerator';
import type { RoomDefinition } from './Room';

/**
 * ENDLESS: one hero, one long night. Rooms are generated one after another and the crew
 * grows with every floor; hearts carry over (you only heal a little between floors), and
 * every fifth floor a boss walks in. The run ends when the hero goes down. Score, floor and
 * scrap are what you take home, and "one more floor" is the whole hook.
 */

/** Generated rooms start at index 8 (depth 1); floor 1 reuses the gentlest generated depth. */
const INDEX_OFFSET = 7;
/** The generator's crew budget keeps climbing; past this depth rooms are as hard as they get. */
export const MAX_DEPTH = 40;
export const BOSS_EVERY = 5;
export const FLOOR_BONUS = 150;
export const BOSS_BONUS = 400;
/** Hearts won back by clearing a floor, and a boss floor. Generous while you are still learning. */
export const HEAL_FLOOR = 1;
export const HEAL_BOSS = 2;
export const HEAL_EARLY = 2;
export const HEAL_EARLY_BOSS = 3;
/** Floors up to this one use the early heal. */
export const EARLY_FLOORS = 5;

const BOSS_ORDER: readonly EnemyTypeId[] = [
  'chairman', 'flusher', 'kraken', 'fridgezilla', 'piano', 'mower', 'mom',
  'vacuumasaurus', 'hydra', 'fan', 'popcorn', 'cables', 'cooker', 'train',
  'junk', 'clock', 'toybox', 'dishwasher', 'house', 'cardboard',
];

export interface EndlessRun {
  /** 1-based floor being played (or reached, once the run is over). */
  floor: number;
  seed: number;
  /** Hearts to start the next floor with. */
  hp: number;
  scrap: number;
  bosses: number;
  /** The saved records when the run began, so "new best" survives banking along the way. */
  bestFloorAtStart: number;
  bestScoreAtStart: number;
}

export interface EndlessSummary {
  floor: number;
  score: number;
  scrap: number;
  bosses: number;
  bestFloor: number;
  bestScore: number;
  newBestFloor: boolean;
  newBestScore: boolean;
  canContinue: boolean;
  adMissed?: boolean;
}

export function newEndlessRun(
  seed: number,
  hp: number,
  records: { bestFloor: number; bestScore: number } = { bestFloor: 0, bestScore: 0 },
): EndlessRun {
  return {
    floor: 1, seed: Math.floor(seed) >>> 0, hp, scrap: 0, bosses: 0,
    bestFloorAtStart: records.bestFloor, bestScoreAtStart: records.bestScore,
  };
}

export function isBossFloor(floor: number): boolean {
  return floor >= BOSS_EVERY && floor % BOSS_EVERY === 0;
}

/** The boss waiting on this floor, or null. They cycle through the whole roster. */
export function endlessBoss(floor: number): EnemyTypeId | null {
  if (!isBossFloor(floor)) return null;
  return BOSS_ORDER[(floor / BOSS_EVERY - 1) % BOSS_ORDER.length]!;
}

/** Room index used for the generator and the HUD: floor 1 is depth 1. */
export function endlessIndex(floor: number): number {
  return INDEX_OFFSET + Math.min(MAX_DEPTH, Math.max(1, Math.floor(floor)));
}

/** Same run seed and floor always make the same room. */
export function endlessRoom(run: EndlessRun): RoomDefinition {
  const seed = (Math.imul(run.seed ^ 0x9e3779b9, 31) + run.floor * 0x85ebca6b) >>> 0;
  const def = generateRoom(endlessIndex(run.floor), seed);
  return { ...def, id: `endless-${run.seed}-${run.floor}`, name: `Floor ${run.floor} · ${def.name}` };
}

export function healAfter(floor: number): number {
  const early = floor <= EARLY_FLOORS;
  if (isBossFloor(floor)) return early ? HEAL_EARLY_BOSS : HEAL_BOSS;
  return early ? HEAL_EARLY : HEAL_FLOOR;
}
