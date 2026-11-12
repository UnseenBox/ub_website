import { EDGE_STACK_CAP, edgeStacks, isEdgeId, type EdgeId } from './Edges';
import { CAMPAIGN_ROOMS } from './Campaign';

export interface RunState {
  runActive: boolean;
  runFloor: number;
  runStreak: number;
  runBoosts: string[];
  runScore: number;
  runInsuranceUsed: boolean;
  /** Up to three offered Edge ids while a draft is pending (new in v6). */
  runOffer: string[];
  /** Night Shift route: room indices entered, in order (new in v9). */
  runPath: number[];
  /** Pending Night Shift doors, up to three room indices (new in v9). */
  runDoors: number[];
  /** Seed for this shift's door choices (new in v9). */
  runSeed: number;
  /** Temporary armour from a door, spent on the next room (new in v9). */
  runArmor: number;
}

export interface RunSnapshot {
  floor: number;      // 1-based room the run is on
  streak: number;
  score: number;
  types: number;      // distinct Edge ids
  stacks: number;     // total Edge copies
  boosts: string[];
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function startRun(save: RunState, index: number): void {
  save.runActive = true;
  save.runFloor = whole(index);
  save.runStreak = 0;
  save.runBoosts = [];
  save.runScore = 0;
  save.runInsuranceUsed = false;
  save.runOffer = [];
  save.runPath = [];
  save.runDoors = [];
  save.runSeed = 0;
  save.runArmor = 0;
}

export function recordClear(save: RunState, index: number, score: number): void {
  save.runActive = true;
  save.runFloor = whole(index) + 1;
  save.runStreak = whole(save.runStreak) + 1;
  save.runScore = whole(score);
}

/** Resets streak and rolls the run score back to the room start. Never ends the run. */
export function recordFail(save: RunState, scoreAtStart: number): void {
  save.runActive = true;
  save.runStreak = 0;
  save.runScore = whole(scoreAtStart);
}

/** False when this Edge is already at three stacks. */
export function chooseEdge(save: RunState, id: EdgeId): boolean {
  if (edgeStacks(save.runBoosts, id) >= EDGE_STACK_CAP) return false;
  save.runBoosts.push(id);
  return true;
}

export function endRun(save: RunState): void {
  save.runActive = false;
  save.runBoosts = [];
  save.runScore = 0;
  save.runStreak = 0;
  save.runInsuranceUsed = false;
  save.runOffer = [];
  save.runPath = [];
  save.runDoors = [];
  save.runArmor = 0;
}

/**
 * Repairs a loaded run. A run one floor past the deepest clear is legitimate:
 * it is the room the player just failed or is about to continue.
 */
export function sanitizeRun(
  save: RunState,
  unlockedRoom: number,
  deepest: number,
  maxFloor?: number,
): void {
  const kept: string[] = [];
  for (const id of save.runBoosts) {
    if (!isEdgeId(id)) continue;
    if (edgeStacks(kept, id) >= EDGE_STACK_CAP) continue;
    kept.push(id);
  }
  save.runBoosts = kept;
  save.runOffer = offerIds(save.runOffer);
  save.runFloor = whole(save.runFloor);
  save.runStreak = whole(save.runStreak);
  save.runScore = whole(save.runScore);
  save.runSeed = whole(save.runSeed);
  save.runArmor = Math.min(3, whole(save.runArmor));
  save.runPath = routeIds(save.runPath);
  save.runDoors = routeIds(save.runDoors).slice(0, 3);
  const furthest = Math.max(maxFloor ?? 0, whole(unlockedRoom), whole(deepest) + 1);
  if (save.runFloor > furthest) {
    save.runActive = false;
    // A dead run never pins an offer or a door on the results screen.
    save.runOffer = [];
    save.runDoors = [];
    save.runPath = [];
  }
  if (!save.runActive) {
    save.runPath = [];
    save.runDoors = [];
    save.runArmor = 0;
  }
}

/** One draft offers up to this many distinct Edges. */
const OFFER_LIMIT = 3;

/** Known room indices only, in route order and without repeats. */
function routeIds(value: readonly number[]): number[] {
  const out: number[] = [];
  for (const raw of value) {
    const index = whole(raw);
    if (index >= CAMPAIGN_ROOMS || out.includes(index)) continue;
    out.push(index);
  }
  return out;
}

/** Known, unique Edge ids only, capped at one draft's worth. */
function offerIds(value: string[]): string[] {
  const out: string[] = [];
  for (const id of value) {
    if (!isEdgeId(id) || out.includes(id)) continue;
    out.push(id);
    if (out.length >= OFFER_LIMIT) break;
  }
  return out;
}

export function runSnapshot(save: RunState): RunSnapshot {
  return {
    floor: whole(save.runFloor) + 1,
    streak: whole(save.runStreak),
    score: whole(save.runScore),
    types: new Set(save.runBoosts).size,
    stacks: save.runBoosts.length,
    boosts: [...save.runBoosts],
  };
}
