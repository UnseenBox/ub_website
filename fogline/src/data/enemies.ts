// Enemy catalogue. The rig/look is chosen by `rig` + `look`; behaviour by the
// numeric fields and `special`.

export type HitZone = 'head' | 'torso' | 'legs';
export type RigStyle = 'shamble' | 'run' | 'heavy' | 'bloat' | 'crawl';

export interface EnemyDef {
  id: string;
  name: string;
  /** Height in metres (crawlers are low to the ground). */
  height: number;
  health: number;
  /** Walking speed in metres/second (before wave multiplier). */
  speed: number;
  speedJitter: number;
  /** Damage multiplier per zone; values < 1 are armour. */
  zoneMultiplier: Record<HitZone, number>;
  /** Zones that armour-piercing rounds treat as unarmoured. */
  armoredZones: HitZone[];
  /** Bunker damage per strike and seconds between strikes. */
  attackDamage: number;
  attackInterval: number;
  reward: number;
  headshotBonus: number;
  rig: RigStyle;
  /** Texture set prefix for body parts (see rendering/ZombieArt.ts). */
  look: string;
  looks: number;
  /** Groan sound key prefix and seconds between groans. */
  voice: string;
  groanInterval: [number, number];
  /** Ignores stagger from bullets below this damage. */
  staggerThreshold: number;
  special?: {
    /** Spawns these enemies where it dies. */
    burstInto?: { id: string; count: number };
    /** Detonates against the bunker instead of clawing it. */
    detonateDamage?: number;
  };
  description: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
  shambler: {
    id: 'shambler',
    name: 'Shambler',
    height: 1.78,
    health: 80,
    speed: 2.3,
    speedJitter: 0.35,
    zoneMultiplier: { head: 1, torso: 1, legs: 0.75 },
    armoredZones: [],
    attackDamage: 12,
    attackInterval: 1.5,
    reward: 20,
    headshotBonus: 15,
    rig: 'shamble',
    look: 'shambler',
    looks: 3,
    voice: 'groan_shambler',
    groanInterval: [5, 12],
    staggerThreshold: 60,
    description: 'The bulk of the dead. Slow, relentless, folds to a clean headshot.',
  },
  runner: {
    id: 'runner',
    name: 'Sprinter',
    height: 1.74,
    health: 55,
    speed: 6.8,
    speedJitter: 0.8,
    zoneMultiplier: { head: 1, torso: 1, legs: 0.8 },
    armoredZones: [],
    attackDamage: 9,
    attackInterval: 0.85,
    reward: 30,
    headshotBonus: 20,
    rig: 'run',
    look: 'runner',
    looks: 2,
    voice: 'groan_runner',
    groanInterval: [3, 6],
    staggerThreshold: 30,
    description: 'Fresh and fast. Closes the distance in seconds — shoot it first.',
  },
  plated: {
    id: 'plated',
    name: 'Riot Husk',
    height: 1.86,
    health: 210,
    speed: 1.9,
    speedJitter: 0.2,
    zoneMultiplier: { head: 1, torso: 0.25, legs: 0.6 },
    armoredZones: ['torso', 'legs'],
    attackDamage: 26,
    attackInterval: 1.6,
    reward: 60,
    headshotBonus: 35,
    rig: 'heavy',
    look: 'plated',
    looks: 2,
    voice: 'groan_plated',
    groanInterval: [6, 12],
    staggerThreshold: 140,
    description: 'Dead riot police in body armour. The cracked visor is the weak point. AP rounds punch through.',
  },
  carrier: {
    id: 'carrier',
    name: 'Bloater',
    height: 1.9,
    health: 340,
    speed: 1.35,
    speedJitter: 0.15,
    zoneMultiplier: { head: 1, torso: 1.15, legs: 0.7 },
    armoredZones: [],
    attackDamage: 0,
    attackInterval: 99,
    reward: 85,
    headshotBonus: 25,
    rig: 'bloat',
    look: 'carrier',
    looks: 1,
    voice: 'groan_carrier',
    groanInterval: [4, 8],
    staggerThreshold: 400,
    special: { burstInto: { id: 'crawler', count: 3 }, detonateDamage: 160 },
    description: 'Swollen with crawling parasites. Bursts into Crawlers when killed and detonates on the wall. Kill it far out.',
  },
  crawler: {
    id: 'crawler',
    name: 'Crawler',
    height: 0.7,
    health: 30,
    speed: 4.4,
    speedJitter: 0.6,
    zoneMultiplier: { head: 1, torso: 1, legs: 1 },
    armoredZones: [],
    attackDamage: 6,
    attackInterval: 0.7,
    reward: 10,
    headshotBonus: 5,
    rig: 'crawl',
    look: 'crawler',
    looks: 1,
    voice: 'groan_crawler',
    groanInterval: [2, 5],
    staggerThreshold: 999,
    description: 'Low, quick and hard to hit.',
  },
};
