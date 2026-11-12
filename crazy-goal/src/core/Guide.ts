import type { GuideDef } from '../levels/LevelDefinition';
import type { ShotType } from '../physics/Flight';

/** How the next shot is struck, as the player set it. */
export interface KickSetting {
  type: ShotType;
  /** -1 (left) to 1 (right). */
  bend: number;
}

/** What the lesson still needs the player to switch on before the shot can be shown. */
export type GuideNeed = 'air' | 'bend' | null;

/** The bend control snaps to the ends and to zero, so "full bend" and "straight" are easy to hit. */
export function snapBend(bend: number): number {
  const v = Math.max(-1, Math.min(1, bend));
  if (Math.abs(v) <= 0.12) return 0;
  if (Math.abs(v) >= 0.75) return Math.sign(v);
  return v;
}

export function guideNeed(def: GuideDef, kick: KickSetting): GuideNeed {
  if (def.move === 'air' && kick.type !== 'air') return 'air';
  if (def.move === 'bend' && Math.abs(kick.bend) < 1) return 'bend';
  return null;
}

/** The shot the ghost shows: mirrored when the player bends the other way (the pitch is symmetric). */
export function guideShot(def: GuideDef, kick: KickSetting): { angle: number; power: number; air: boolean; bend: number } {
  const s = def.show;
  const flip = def.move === 'bend' && kick.bend < 0;
  return { angle: flip ? -180 - s.angle : s.angle, power: s.power, air: s.air, bend: flip ? -s.bend : s.bend };
}

/** What the controls are set to when the lesson helps after missed shots. */
export function guideAssist(def: GuideDef): KickSetting {
  return { type: def.show.air ? 'air' : 'ground', bend: def.show.bend };
}

/** Misses on one lesson before it sets the controls for the player. */
export const GUIDE_ASSIST_MISSES = 2;
