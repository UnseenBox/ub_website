import type { Ragdoll } from './Ragdoll';
import type { PartName } from './rig';
import type { Projectile } from './Projectile';
import type { PhysicsObject } from './PhysicsObject';
import type { Gum, Puddle } from './SlimeSystem';
import type { FortressPiece } from '../game/Fortress';

/** Anything that can be coated in slime for a while. */
export interface Slimeable {
  slimeTimer: number;
}

/**
 * Stored in Fixture.userData. Contact handlers read these tags to decide
 * damage, friction, splats and visuals.
 */
export type Tag =
  | { kind: 'ground' }
  | { kind: 'platform' }
  | { kind: 'block'; piece: FortressPiece }
  | { kind: 'gum'; gum: Gum }
  | { kind: 'wall' }
  | { kind: 'puddle'; puddle: Puddle }
  | { kind: 'part'; ragdoll: Ragdoll; part: PartName; foot: boolean }
  | { kind: 'object'; obj: PhysicsObject }
  | { kind: 'projectile'; proj: Projectile };
