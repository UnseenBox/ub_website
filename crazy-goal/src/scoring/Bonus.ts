import type { ShotResult } from './ShotAnalyzer';

/**
 * BONUS OBJECTIVES: one optional extra per campaign match, for variety and replays. A goal that meets it pays
 * a bonus once and shows BONUS on the goal card. Each one is a fact of the shot, the same facts the Crazy Score
 * is worked out from, so the sweep can count how many shots meet it.
 */

/** Which control the objective needs: a lofted shot (air) or a bent one (bend). Ground shots need neither. */
export type BonusKick = 'ground' | 'air' | 'bend';

export type BonusId =
  | 'two-bounces'
  | 'air-shot'
  | 'bend-in'
  | 'post'
  | 'bumper'
  | 'tyre'
  | 'taxi'
  | 'crate'
  | 'hedge'
  | 'glass'
  | 'bell'
  | 'mimi'
  | 'pipe'
  | 'wind'
  | 'spin'
  | 'sand'
  | 'scooter'
  | 'rocket';

export interface BonusObjective {
  /** The line the player reads on the pill and the goal card (English; tr() translates it). */
  label: string;
  kick: BonusKick;
  /** True when the shot meets the objective. Only called for a goal. */
  met: (r: ShotResult) => boolean;
}

export const BONUS_OBJECTIVES: Readonly<Record<BonusId, BonusObjective>> = {
  'two-bounces': { label: 'SCORE OFF 2 BOUNCES', kick: 'ground', met: (r) => r.bounces >= 2 },
  'air-shot': { label: 'SCORE WITH AN AIR SHOT', kick: 'air', met: (r) => r.maxHeight > 30 },
  'bend-in': { label: 'BEND IT IN', kick: 'bend', met: (r) => r.turned > 0.4 },
  post: { label: 'HIT THE POST AND SCORE', kick: 'ground', met: (r) => (r.touched.post ?? 0) > 0 },
  bumper: { label: 'SCORE OFF THE BUMPER', kick: 'ground', met: (r) => r.did.has('bumper') },
  tyre: { label: 'SCORE OFF THE TYRE', kick: 'ground', met: (r) => r.did.has('boing') },
  taxi: { label: 'SCORE OFF THE TAXI', kick: 'ground', met: (r) => (r.touched.car ?? 0) > 0 },
  crate: { label: 'SCORE OFF A CRATE', kick: 'ground', met: (r) => (r.touched.crate ?? 0) > 0 },
  hedge: { label: 'SCORE OFF THE HEDGE', kick: 'ground', met: (r) => (r.touched.hedge ?? 0) > 0 },
  glass: { label: 'SMASH THE GLASS AND SCORE', kick: 'ground', met: (r) => r.did.has('smash') },
  bell: { label: 'RING THE BELL', kick: 'ground', met: (r) => r.did.has('bell') },
  mimi: { label: 'SCORE OFF MIMI', kick: 'ground', met: (r) => r.did.has('save') },
  pipe: { label: 'OUT OF THE MANHOLE', kick: 'ground', met: (r) => r.did.has('pipe') },
  wind: { label: 'SCORE IN THE WIND', kick: 'ground', met: (r) => r.did.has('wind') },
  spin: { label: 'OFF THE SPINNER', kick: 'ground', met: (r) => r.did.has('spin') },
  sand: { label: 'THROUGH THE SAND', kick: 'ground', met: (r) => r.did.has('sand') },
  scooter: { label: 'OFF THE SCOOTER', kick: 'ground', met: (r) => r.did.has('scooter') },
  rocket: { label: 'SCORE WITH A ROCKET', kick: 'ground', met: (r) => r.entrySpeed > 1000 },
};

export const BONUS_IDS = Object.keys(BONUS_OBJECTIVES) as readonly BonusId[];

/** True when this goal meets the objective. A miss never does. */
export function bonusMet(id: BonusId, r: ShotResult): boolean {
  return r.goal && BONUS_OBJECTIVES[id].met(r);
}

/** The coins a bonus pays, the first time its match meets its objective. */
export const BONUS_COINS = 25;
