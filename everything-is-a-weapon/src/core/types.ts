import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Zone } from '../hazards/Zone';

/** Shared by every link of one cause-and-effect chain, so multi-kills and tiers are counted once. */
export interface ChainRoot {
  readonly id: number;
  readonly startedAt: number;
  readonly originUid: number;
  readonly originLabel: string;
  kills: number;
  maxLen: number;
  rewardedLen: number;
}

export interface Chain {
  readonly root: ChainRoot;
  readonly steps: readonly string[];
}

export interface WallThing {
  readonly kind: 'wall';
  readonly uid: number;
  readonly tags: Set<string>;
  readonly label: string;
  chain: Chain | null;
  chainAt: number;
}

export const WALL_THING: WallThing = {
  kind: 'wall',
  uid: 0,
  tags: new Set(['wall', 'solid']),
  label: 'WALL',
  chain: null,
  chainAt: -999,
};

export type Entity = PhysicsObject | Enemy | Player;
export type Creature = Enemy | Player;
/** Anything the interaction rules can match against. */
export type Thing = Entity | Zone | WallThing;

export type DamageType = 'impact' | 'shock' | 'fire' | 'glass' | 'explosion' | 'slam' | 'water';

export interface DamageCause {
  readonly type: DamageType;
  readonly source: Thing | null;
  readonly chain: Chain | null;
  readonly label: string;
  readonly dirX: number;
  readonly dirY: number;
}

let nextUid = 10;
export function newUid(): number {
  return nextUid++;
}
