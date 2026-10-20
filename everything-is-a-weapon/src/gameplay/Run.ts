import { isEdgeId, type EdgeId } from './Edges';

export interface RunState {
  runActive: boolean;
  runFloor: number;
  runStreak: number;
  runBoosts: string[];
  runScore: number;
  runInsuranceUsed: boolean;
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
}

export function recordClear(save: RunState, index: number, score: number): void {
  save.runActive = true;
  save.runFloor = whole(index) + 1;
  save.runStreak = whole(save.runStreak) + 1;
  save.runScore = whole(score);
}

export function recordFail(
  save: RunState,
  index: number,
  scoreAtStart: number,
  handcraftedCount: number,
): { ended: boolean } {
  save.runStreak = 0;
  save.runScore = whole(scoreAtStart);
  return { ended: whole(index) >= whole(handcraftedCount) };
}

export function chooseEdge(save: RunState, id: EdgeId): void {
  save.runBoosts.push(id);
}

export function endRun(save: RunState): void {
  save.runActive = false;
  save.runBoosts = [];
  save.runScore = 0;
  save.runStreak = 0;
  save.runInsuranceUsed = false;
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
  save.runBoosts = save.runBoosts.filter((id) => isEdgeId(id));
  save.runFloor = whole(save.runFloor);
  save.runStreak = whole(save.runStreak);
  save.runScore = whole(save.runScore);
  const furthest = Math.max(maxFloor ?? 0, whole(unlockedRoom), whole(deepest) + 1);
  if (save.runFloor > furthest) save.runActive = false;
}
