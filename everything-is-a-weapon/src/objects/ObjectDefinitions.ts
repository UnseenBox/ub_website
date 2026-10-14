import type { Shape } from '../physics/RigidBody';
import type { ZoneKind } from '../hazards/Zone';
import type { MaterialId } from './Materials';

/** Tall things that can be knocked over; the collider changes when they land. */
export interface TipSpec {
  readonly length: number;
  readonly fallenShape: Shape;
  readonly minImpulse: number;
  readonly slamDamage: number;
  readonly slamRadius: number;
  /** Only falls across its long axis (a shelf), instead of in any direction (a lamp). */
  readonly perpendicular?: boolean;
}

/** A hazard zone carried around by the object while the given tag is present. */
export interface ZoneEmitter {
  readonly zone: ZoneKind;
  readonly radius: number;
  /** Distance in front of the object (along its angle). */
  readonly offset?: number;
  /** Tag that must be present for the emitter to stay alive (default: always). */
  readonly whileTag?: string;
  /** Extra tags on the zone, so rules can tell one emitter from another. */
  readonly tags?: readonly string[];
}

/**
 * Things an object does on its own, without being hit. Each kind is implemented once in
 * entities/Behaviors.ts; the numbers live here with the rest of the object's data.
 */
export type BehaviorSpec =
  /** Drives itself round the room, turning when it bumps into something. */
  | { readonly kind: 'wander'; readonly speed: number }
  /** Once thrown, chases the nearest intruder and nips at it until it winds down. */
  | { readonly kind: 'seek'; readonly speed: number; readonly seconds: number; readonly bite: number; readonly every: number; readonly discovery?: string }
  /** Once thrown, flies out, turns round and comes back to the thrower's hand. */
  | { readonly kind: 'boomerang'; readonly seconds: number; readonly discovery?: string }
  /** Thrashes about for a while after it appears. */
  | { readonly kind: 'flop'; readonly seconds: number }
  /** Sets itself when left alone on the floor. `rearm` 0 means only picking it up resets it. */
  | { readonly kind: 'trap'; readonly rearm: number };

export interface ObjectDefinition {
  readonly id: string;
  readonly name: string;
  readonly material: MaterialId;
  readonly shape: Shape;
  readonly mass: number;
  /** Visual extrusion height; also how far things fall from it when it is a surface. */
  readonly height: number;
  readonly health: number;
  readonly breakable: boolean;
  readonly flammable: boolean;
  readonly conductive: boolean;
  readonly throwable: boolean;
  readonly explosive?: boolean;
  readonly electronic?: boolean;
  readonly rolls?: boolean;
  /** Ridiculous weapon: kills with it earn the style bonus. */
  readonly funny?: boolean;
  readonly removeOnBreak?: boolean;
  /** Smaller objects can rest on top of it. */
  readonly surface?: boolean;
  /** Built in or plumbed in: never moves and cannot be picked up. */
  readonly fixed?: boolean;
  /** A signature noise when it hits something. */
  readonly quirk?: 'squeak' | 'gong';
  readonly restitution?: number;
  readonly groundFriction?: number;
  readonly tip?: TipSpec;
  readonly emitters?: readonly ZoneEmitter[];
  /** Extra tags the interaction rules can match on. */
  readonly tags?: readonly string[];
  /** Key into the art registry; falls back to a generic drawing from shape + material. */
  readonly art?: string;
  /** What this object is good for, in a few words. Shown on its tag when you can pick it up. */
  readonly perk?: string;
  readonly behavior?: BehaviorSpec;
  /** 0..1: how much of gravity a throw ignores. A plate sails; a toolbox does not. */
  readonly glide?: number;
  /** Used up the moment it is picked up, instead of being held (gameplay/Pickups.ts). */
  readonly consume?: 'rage' | 'treat' | 'heal' | 'armor' | 'snooze';
}

/**
 * Every object in the game is just data. To add one, append a definition here
 * (or call ObjectRegistry.register) — physics, grabbing, damage, fire, electricity
 * and scoring all work from these fields and the derived tags.
 */
export const OBJECT_DEFINITIONS: readonly ObjectDefinition[] = [
  {
    id: 'chair', name: 'Chair', material: 'wood', shape: { kind: 'box', hw: 17, hh: 17 }, mass: 9, height: 13,
    health: 130, breakable: true, flammable: true, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'breaks into planks',
  },
  {
    id: 'table', name: 'Table', material: 'wood', shape: { kind: 'box', hw: 64, hh: 38 }, mass: 70, height: 22,
    health: 9999, breakable: false, flammable: true, conductive: false, throwable: false, surface: true,
    groundFriction: 1500, perk: 'too heavy to throw: shove it',
  },
  {
    id: 'lamp', name: 'Lamp', material: 'glass', shape: { kind: 'circle', r: 10 }, mass: 4, height: 60,
    health: 26, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    tip: { length: 62, fallenShape: { kind: 'box', hw: 31, hh: 6 }, minImpulse: 420, slamDamage: 38, slamRadius: 30 },
    perk: 'topples, then sparks',
  },
  {
    id: 'shoe', name: 'Shoe', material: 'rubber', shape: { kind: 'box', hw: 11, hh: 6 }, mass: 0.8, height: 6,
    health: 9999, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    groundFriction: 620, perk: 'a slap that dazes',
  },
  {
    id: 'book', name: 'Book', material: 'paper', shape: { kind: 'box', hw: 12, hh: 9 }, mass: 1.3, height: 5,
    health: 9999, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    perk: 'never breaks, burns well',
  },
  {
    id: 'computer', name: 'Computer', material: 'electronic', shape: { kind: 'box', hw: 19, hh: 15 }, mass: 12,
    height: 18, health: 75, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    perk: 'sparks once smashed',
  },
  {
    id: 'trashcan', name: 'Trash Can', material: 'metal', shape: { kind: 'circle', r: 15 }, mass: 6, height: 20,
    health: 80, breakable: true, flammable: false, conductive: true, throwable: true, rolls: true,
    tags: ['container', 'wearable'], perk: 'fits over a head',
  },
  {
    id: 'bottle', name: 'Bottle', material: 'glass', shape: { kind: 'circle', r: 7 }, mass: 1.1, height: 15,
    health: 14, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    tags: ['liquid'], perk: 'leaves a puddle',
  },
  {
    id: 'flowerpot', name: 'Flowerpot', material: 'ceramic', shape: { kind: 'circle', r: 13 }, mass: 8, height: 13,
    health: 44, breakable: true, flammable: false, conductive: false, throwable: true, removeOnBreak: true,
    perk: 'its dirt smothers fire',
  },
  {
    id: 'fan', name: 'Fan', material: 'plastic', shape: { kind: 'box', hw: 12, hh: 16 }, mass: 7, height: 22,
    health: 60, breakable: true, flammable: false, conductive: true, throwable: true, electronic: true,
    emitters: [{ zone: 'wind', radius: 78, offset: 92, whileTag: 'powered' }],
    tags: ['powered'], perk: 'blows light things away',
  },
  {
    id: 'extinguisher', name: 'Fire Extinguisher', material: 'metal', shape: { kind: 'circle', r: 10 }, mass: 10,
    height: 24, health: 70, breakable: true, flammable: false, conductive: true, throwable: true,
    tags: ['pressurized'], perk: 'dent it for lift-off',
  },
  {
    id: 'candle', name: 'Candle', material: 'plastic', shape: { kind: 'circle', r: 6 }, mass: 0.6, height: 10,
    health: 9999, breakable: false, flammable: false, conductive: false, throwable: true, funny: true,
    emitters: [{ zone: 'fire', radius: 13, whileTag: 'lit' }],
    tags: ['lit'], perk: 'sets things alight',
  },
  {
    id: 'spraycan', name: 'Spray Can', material: 'metal', shape: { kind: 'circle', r: 7 }, mass: 1.5, height: 14,
    health: 24, breakable: true, flammable: false, conductive: true, throwable: true, explosive: true,
    removeOnBreak: true, rolls: true, perk: 'explodes near fire',
  },
  {
    id: 'bookshelf', name: 'Bookshelf', material: 'wood', shape: { kind: 'box', hw: 46, hh: 13 }, mass: 55, height: 44,
    health: 9999, breakable: false, flammable: true, conductive: false, throwable: false, groundFriction: 1500,
    tip: {
      length: 76, fallenShape: { kind: 'box', hw: 38, hh: 46 }, minImpulse: 2400, slamDamage: 70, slamRadius: 52,
      perpendicular: true,
    },
    perk: 'push it over on someone',
  },
  {
    id: 'ball', name: 'Rubber Ball', material: 'rubber', shape: { kind: 'circle', r: 9 }, mass: 1.2, height: 9,
    health: 9999, breakable: false, flammable: false, conductive: false, throwable: true, funny: true, rolls: true,
    restitution: 0.88, perk: 'hits harder off a wall',
  },
  // Spawned by other objects breaking, but perfectly valid to place in a room too.
  {
    id: 'plank', name: 'Plank', material: 'wood', shape: { kind: 'box', hw: 17, hh: 4 }, mass: 2.4, height: 4,
    health: 9999, breakable: false, flammable: true, conductive: false, throwable: true,
    perk: 'good kindling',
  },
  {
    id: 'paperball', name: 'Paper Ball', material: 'paper', shape: { kind: 'circle', r: 6 }, mass: 0.3, height: 5,
    health: 9999, breakable: false, flammable: true, conductive: false, throwable: true, funny: true,
    perk: 'catches fire at once',
  },
  {
    id: 'helmet', name: 'Saucepan', material: 'metal', shape: { kind: 'circle', r: 10 }, mass: 2, height: 8,
    health: 9999, breakable: false, flammable: false, conductive: true, throwable: true, funny: true, rolls: true,
    tags: ['guard'], perk: 'hold it up to block a lunge',
  },
];
