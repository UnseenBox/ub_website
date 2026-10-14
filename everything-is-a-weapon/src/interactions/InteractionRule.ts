import type { GameEventType } from '../core/Events';
import type { DamageType } from '../core/types';
import type { ZoneKind } from '../hazards/Zone';
import type { BlastStyle } from '../core/Game';
import type { SoundName } from '../audio/AudioManager';

type Who = 'source' | 'target';

/**
 * Reusable building blocks a rule can trigger. Each one is implemented once in Effects.ts
 * and returns whether it actually changed anything, which gates discoveries.
 */
export type EffectSpec =
  | { readonly type: 'impactDamage'; readonly scale: number }
  | { readonly type: 'structuralDamage'; readonly scale: number }
  | { readonly type: 'slamDamage'; readonly to: Who; readonly minSpeed: number; readonly scale: number }
  | { readonly type: 'tip' }
  | { readonly type: 'boost'; readonly factor: number }
  | { readonly type: 'detonate'; readonly to: Who }
  | { readonly type: 'mark' }
  | { readonly type: 'slam' }
  | { readonly type: 'spawnZone'; readonly zone: ZoneKind; readonly radius: number; readonly ttl?: number; readonly attach?: boolean }
  | { readonly type: 'spill'; readonly radius: number }
  | { readonly type: 'spawnObject'; readonly object: string; readonly count: number }
  | { readonly type: 'rocket'; readonly duration: number }
  | { readonly type: 'explode'; readonly radius: number; readonly force: number; readonly damage: number; readonly at?: Who; readonly style?: BlastStyle }
  | { readonly type: 'energize' }
  | { readonly type: 'shock'; readonly damage: number; readonly stun: number }
  | { readonly type: 'ignite'; readonly rate: number }
  | { readonly type: 'burn'; readonly duration: number }
  | { readonly type: 'extinguish' }
  | { readonly type: 'hazardDamage'; readonly amount: number; readonly cause: DamageType }
  | { readonly type: 'slow'; readonly factor: number; readonly duration: number }
  | { readonly type: 'slip' }
  | { readonly type: 'confuse'; readonly duration: number }
  | { readonly type: 'push'; readonly force: number }
  | { readonly type: 'grow' }
  | { readonly type: 'transform'; readonly zone: ZoneKind }
  | { readonly type: 'remove'; readonly to: Who }
  | { readonly type: 'trip'; readonly to?: Who }
  /** A zone drags an object towards its centre (a magnet). `accel` is in px/s². */
  | { readonly type: 'pull'; readonly accel: number; readonly maxMass: number }
  /** Takes the saucepan off a Pan Head. */
  | { readonly type: 'unhelmet' }
  /** A trap zone goes off under an intruder. `hold` pins it to the spot for that many seconds. */
  | { readonly type: 'snap'; readonly damage: number; readonly stun: number; readonly hold?: number; readonly word: string }
  /** Starts a countdown that ends with the object breaking; `rocket` seconds of it are spent flying. */
  | { readonly type: 'fuse'; readonly to: Who; readonly seconds: number; readonly rocket?: number; readonly whistle?: boolean }
  | { readonly type: 'tag'; readonly to: Who; readonly tag: string; readonly seconds?: number; readonly word?: string }
  | { readonly type: 'untag'; readonly to: Who; readonly tag: string }
  /** The thrown object ends up on the intruder: over its head, or hanging off its face. */
  | { readonly type: 'wear'; readonly duration: number; readonly minSpeed?: number; readonly word: string }
  /** A noise intruders walk over to. */
  | { readonly type: 'lure'; readonly radius: number; readonly seconds: number; readonly sound?: SoundName }
  | { readonly type: 'stagger'; readonly seconds: number }
  /** Comes off a wall faster than it went in, and remembers it for a moment. */
  | { readonly type: 'ricochet'; readonly factor: number }
  | { readonly type: 'blaze'; readonly seconds: number }
  | { readonly type: 'stick'; readonly duration: number }
  | { readonly type: 'ring'; readonly duration: number }
  | { readonly type: 'shoot'; readonly speed: number };

/**
 * `impact`  — two physical things collided (source hit target) with at least `minImpulse`.
 * `overlap` — a hazard zone (source) overlaps a thing or another zone (target); evaluated ~12×/s.
 * `event`   — a gameplay event was emitted for a thing matching `source`.
 */
export type RuleTrigger = 'impact' | 'overlap' | 'event';

export interface InteractionRule {
  readonly id: string;
  readonly trigger: RuleTrigger;
  readonly event?: GameEventType;
  /** Tags the source must have. Prefix a tag with `!` to require its absence. */
  readonly source: readonly string[];
  readonly target?: readonly string[];
  readonly minImpulse?: number;
  /** Seconds before the same rule may fire again for the same pair. */
  readonly cooldown?: number;
  readonly effects: readonly EffectSpec[];
  /** Impact rules only: the source has to be the thing that was moving, not the thing walked into. */
  readonly moving?: boolean;
  /** The rule nudges its target but is not a cause worth recording in a chain reaction. */
  readonly noChain?: boolean;
  /** Discovery unlocked the first time this rule does something. */
  readonly discovery?: string;
}
