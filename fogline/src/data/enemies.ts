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
    /** Stops at a distance and spits acid at the sandbags (Spitter). */
    ranged?: { damage: number; interval: number; stopRange: [number, number]; shots: number; windup: number };
    /** Stops at a distance and howls: nearby dead speed up; the first howl calls more (Howler, the Choir). */
    howl?: {
      interval: number; firstDelay: number; radius: number; speedMul: number; duration: number; maxHowls: number;
      stopRange: [number, number]; summon?: { id: string; count: number };
    };
    /** Explodes when it dies, hurting the dead around it (Sapper). */
    deathBlast?: { radius: number; damage: number };
    /** Bursts out of the ground this close to the wire instead of walking in from the fog (Lurker). */
    burrow?: { near: number; far: number };
    /** Leaves a spore cloud where it dies that hides what is behind it (Sporeling). */
    sporeCloud?: { seconds: number; radiusM: number };
  };
  /** Multiplied into the body colour: tells reused bodies apart at a glance. */
  tint?: number;
  /** Dr. Varga's one-line radio briefing the first time this enemy shows up. */
  intel?: string;
  /** A boss: its own health bar, rage phases and summons. The nuke only wounds it. */
  boss?: {
    /** Stops this far from the bunker (a giant would fill the screen at the usual line). */
    stopZ: number;
    /** Health fractions where it enrages: faster, and calls in a pack. */
    phases: number[];
    /** Speed multiplier per phase reached. */
    rageSpeed: number;
    /** Every `interval` seconds it roars and calls `count` of `id` out of the fog. */
    summon: { id: string; count: number; interval: number };
    /** Share of its max health a nuke takes. */
    nukeShare: number;
    /** Multiplied into its body colour. */
    tint: number;
    /** Spore pods around it: while any lives it takes a fifth of the damage; they regrow once at half health. */
    pods?: number;
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
    intel: 'Sprinters. Fresh and fast. Shoot them before the slow ones.',
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
    intel: 'Riot armour. Shoot the visor, or load armour-piercing rounds.',
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
    intel: 'A Bloater. Pop it far out: it bursts into crawlers and explodes on the wall.',
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
  brute: {
    id: 'brute',
    intel: 'A Brute. Body shots barely hurt it. Aim for the head, or use explosives.',
    name: 'Brute',
    // Taller than a doorframe and twice as wide: a wall of dead flesh.
    height: 3.6,
    health: 900,
    speed: 1.3,
    speedJitter: 0.12,
    // Thick fat soaks body shots; the head is the only soft spot.
    zoneMultiplier: { head: 1, torso: 0.45, legs: 0.35 },
    armoredZones: [],
    attackDamage: 55,
    attackInterval: 2.2,
    reward: 180,
    headshotBonus: 90,
    rig: 'bloat',
    look: 'brute',
    looks: 2,
    voice: 'groan_plated',
    groanInterval: [5, 9],
    // Bullets never stagger it; only a big blast shoves it.
    staggerThreshold: 9999,
    description: 'A giant, bloated hulk. Bullets barely slow it and body shots bounce off the fat. Aim for the head, or use explosives.',
  },
  colossus: {
    id: 'colossus',
    intel: 'There it is. Only the head bleeds. It gets angrier as it weakens.',
    name: 'The Colossus',
    // Tall enough to dwarf a Brute, short enough that its head (the weak point) stays on screen at its stop line.
    height: 4.4,
    health: 6500,
    speed: 0.75,
    speedJitter: 0,
    // Hide like armour plate; the head is the way in.
    zoneMultiplier: { head: 1.4, torso: 0.22, legs: 0.18 },
    armoredZones: [],
    attackDamage: 110,
    attackInterval: 2.6,
    reward: 1500,
    headshotBonus: 0,
    rig: 'bloat',
    look: 'brute',
    looks: 1,
    voice: 'groan_plated',
    groanInterval: [3, 6],
    staggerThreshold: 1e9,
    boss: {
      stopZ: 16,
      phases: [0.66, 0.33],
      rageSpeed: 1.35,
      summon: { id: 'shambler', count: 4, interval: 16 },
      nukeShare: 0.2,
      tint: 0xc89080,
    },
    description: 'The giant that broke the farm line. Body shots barely mark it. Only the head bleeds.',
  },
  spitter: {
    id: 'spitter',
    intel: 'Spitters. They stop out in the field and spit acid at the sandbags. The green glow means one is about to spit.',
    name: 'Spitter',
    height: 1.82,
    health: 110,
    speed: 1.85,
    speedJitter: 0.2,
    zoneMultiplier: { head: 1.25, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 10,
    attackInterval: 1.8,
    reward: 45,
    headshotBonus: 20,
    rig: 'shamble',
    look: 'shambler',
    looks: 1,
    voice: 'groan_carrier',
    groanInterval: [4, 8],
    staggerThreshold: 45,
    special: { ranged: { damage: 14, interval: 4.4, stopRange: [24, 32], shots: 3, windup: 0.75 } },
    tint: 0xc8e070,
    description: 'Holds out in the field and spits acid at the bunker. Kill it during the green wind-up.',
  },
  howler: {
    id: 'howler',
    intel: 'A Howler. Its scream speeds up every dead thing around it and calls more out of the fog. Kill it before it opens its mouth.',
    name: 'Howler',
    height: 1.88,
    health: 90,
    speed: 2.0,
    speedJitter: 0.2,
    zoneMultiplier: { head: 1.2, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 8,
    attackInterval: 1.8,
    reward: 55,
    headshotBonus: 25,
    rig: 'shamble',
    look: 'runner',
    looks: 2,
    voice: 'groan_runner',
    groanInterval: [3, 6],
    staggerThreshold: 40,
    special: {
      howl: {
        interval: 8, firstDelay: 5, radius: 30, speedMul: 1.35, duration: 4.5, maxHowls: 3, stopRange: [38, 44],
        summon: { id: 'shambler', count: 2 },
      },
    },
    tint: 0xa8b8e0,
    description: 'Stays back and screams. Everything near it speeds up, and its first scream calls two more.',
  },
  sapper: {
    id: 'sapper',
    intel: 'Sappers! Explosive vests. Listen for the beeping and drop them early. They take their friends with them.',
    name: 'Sapper',
    height: 1.78,
    health: 45,
    speed: 7.4,
    speedJitter: 0.6,
    zoneMultiplier: { head: 1.1, torso: 1, legs: 0.8 },
    armoredZones: [],
    attackDamage: 0,
    attackInterval: 99,
    reward: 40,
    headshotBonus: 15,
    rig: 'run',
    look: 'runner',
    looks: 2,
    voice: 'groan_runner',
    groanInterval: [2, 4],
    staggerThreshold: 25,
    special: { detonateDamage: 70, deathBlast: { radius: 4, damage: 60 } },
    tint: 0xffb878,
    description: 'Sprints in wearing a charge vest and blows up on the wall. Shoot it early, ideally in a crowd.',
  },
  juggernaut: {
    id: 'juggernaut',
    intel: 'A Juggernaut. Welded plate everywhere but the visor slit. Aim there, or bring armour-piercing and explosives.',
    name: 'Juggernaut',
    height: 2.35,
    health: 900,
    speed: 1.25,
    speedJitter: 0.05,
    zoneMultiplier: { head: 1.0, torso: 0.3, legs: 0.45 },
    armoredZones: ['torso', 'legs'],
    attackDamage: 42,
    attackInterval: 2.1,
    reward: 180,
    headshotBonus: 60,
    rig: 'heavy',
    look: 'plated',
    looks: 2,
    voice: 'groan_plated',
    groanInterval: [5, 9],
    staggerThreshold: 700,
    tint: 0x8a8e98,
    description: 'Slow, plated, and it hits like a truck. The visor is the only soft spot.',
  },
  choir: {
    id: 'choir',
    intel: 'The Choir. A giant Howler, and the whole horde moves to its voice. Only the head bleeds.',
    name: 'The Choir',
    height: 4.2,
    health: 7600,
    speed: 0.8,
    speedJitter: 0,
    zoneMultiplier: { head: 1.4, torso: 0.22, legs: 0.18 },
    armoredZones: [],
    attackDamage: 100,
    attackInterval: 2.4,
    reward: 1800,
    headshotBonus: 0,
    rig: 'shamble',
    look: 'runner',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [3, 5],
    staggerThreshold: 1e9,
    special: {
      howl: {
        interval: 12, firstDelay: 6, radius: 60, speedMul: 1.4, duration: 5, maxHowls: 99, stopRange: [30, 34],
        summon: { id: 'runner', count: 3 },
      },
    },
    boss: {
      stopZ: 15,
      phases: [0.66, 0.33],
      rageSpeed: 1.3,
      summon: { id: 'howler', count: 1, interval: 22 },
      nukeShare: 0.2,
      tint: 0xb0c0f0,
    },
    description: 'The voice of the horde. Every scream drives the dead faster. Only the head bleeds.',
  },
  // ---------------------------------------------------------- Act 3: fog-mutated elites
  fogborn: {
    id: 'fogborn',
    intel: 'Fogborn. Sprinters the fog has soaked through. Tougher, faster, and leg shots barely slow them. Heads.',
    name: 'Fogborn',
    height: 1.85,
    health: 150,
    speed: 6.0,
    speedJitter: 0.5,
    zoneMultiplier: { head: 1.3, torso: 0.85, legs: 0.6 },
    armoredZones: [],
    attackDamage: 14,
    attackInterval: 0.9,
    reward: 40,
    headshotBonus: 20,
    rig: 'run',
    look: 'runner',
    looks: 2,
    voice: 'groan_runner',
    groanInterval: [2, 4],
    staggerThreshold: 60,
    tint: 0x707890,
    description: 'A Sprinter mutated by the fog: faster, tougher, and barely slowed by leg hits.',
  },
  ravager: {
    id: 'ravager',
    intel: 'A Ravager. A Brute full of Fogborn. Kill it far out, or it bursts at the wire and they all come at once.',
    name: 'Ravager',
    height: 3.4,
    health: 2200,
    speed: 1.5,
    speedJitter: 0.08,
    zoneMultiplier: { head: 1.2, torso: 0.5, legs: 0.45 },
    armoredZones: [],
    attackDamage: 80,
    attackInterval: 2.2,
    reward: 320,
    headshotBonus: 80,
    rig: 'bloat',
    look: 'brute',
    looks: 2,
    voice: 'groan_plated',
    groanInterval: [4, 8],
    staggerThreshold: 9999,
    special: { burstInto: { id: 'fogborn', count: 3 } },
    tint: 0x9a7aa0,
    description: 'A mutated Brute. Bursts into three Fogborn when it dies, so kill it far from the wire.',
  },
  heart: {
    id: 'heart',
    intel: 'That is the Heart. The fog comes from it. It will not come to us: it spits and it calls. Only the head bleeds.',
    name: 'The Heart of the Fog',
    // A huge swollen mass that stays out in the yard; its head has to stay on screen.
    height: 6.4,
    health: 9000,
    speed: 0.7,
    speedJitter: 0,
    zoneMultiplier: { head: 1.5, torso: 0.2, legs: 0.15 },
    armoredZones: [],
    attackDamage: 120,
    attackInterval: 2.6,
    reward: 2500,
    headshotBonus: 0,
    rig: 'bloat',
    look: 'brute',
    looks: 1,
    voice: 'groan_plated',
    groanInterval: [2, 4],
    staggerThreshold: 1e9,
    // It stops out in the yard and spits fog at the bunker for as long as it lives.
    special: { ranged: { damage: 26, interval: 3.4, stopRange: [33, 35], shots: 9999, windup: 1.0 } },
    boss: {
      stopZ: 32,
      phases: [0.66, 0.33],
      rageSpeed: 1,
      summon: { id: 'fogborn', count: 3, interval: 14 },
      nukeShare: 0.15,
      tint: 0x8a5a78,
    },
    description: 'The source of the fog. It never comes to the wire: it spits from the yard and calls the dead. Only the head bleeds.',
  },
  // ---------------------------------------------------------- Act 4: the fog returns
  lurker: {
    id: 'lurker',
    intel: 'Lurkers. They wait in the mud and come up right in front of the wire. Watch the near field.',
    name: 'Lurker',
    height: 1.75,
    health: 120,
    speed: 3.4,
    speedJitter: 0.4,
    zoneMultiplier: { head: 1.3, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 16,
    attackInterval: 1.0,
    reward: 45,
    headshotBonus: 20,
    rig: 'run',
    look: 'shambler',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [2, 5],
    staggerThreshold: 50,
    special: { burrow: { near: 16, far: 28 } },
    tint: 0x6a7058,
    description: 'Bursts out of the mud close to the wire, skipping the long walk. Watch the near field.',
  },
  sporeling: {
    id: 'sporeling',
    intel: 'Sporelings. Kill one and it bursts into a spore cloud. You cannot see through it, but they can walk through it.',
    name: 'Sporeling',
    height: 1.9,
    health: 170,
    speed: 1.7,
    speedJitter: 0.15,
    zoneMultiplier: { head: 1.2, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 12,
    attackInterval: 1.6,
    reward: 50,
    headshotBonus: 20,
    rig: 'bloat',
    look: 'carrier',
    looks: 1,
    voice: 'groan_carrier',
    groanInterval: [4, 8],
    staggerThreshold: 60,
    special: { sporeCloud: { seconds: 5, radiusM: 3.2 } },
    tint: 0xb8c890,
    description: 'Bursts into a spore cloud when it dies. Kill it far out, or the cloud hides the dead behind it.',
  },
  bloom: {
    id: 'bloom',
    intel: 'The Bloom. A spore flower the size of a house. Those pods around it shield it. Burst the pods, then the head.',
    name: 'The Bloom',
    height: 6.8,
    health: 11000,
    speed: 0.6,
    speedJitter: 0,
    zoneMultiplier: { head: 1.5, torso: 0.2, legs: 0.15 },
    armoredZones: [],
    attackDamage: 120,
    attackInterval: 2.6,
    reward: 3000,
    headshotBonus: 0,
    rig: 'bloat',
    look: 'brute',
    looks: 1,
    voice: 'groan_plated',
    groanInterval: [2, 4],
    staggerThreshold: 1e9,
    special: { ranged: { damage: 22, interval: 3.2, stopRange: [30, 32], shots: 9999, windup: 1.0 } },
    boss: {
      stopZ: 29,
      phases: [0.66, 0.33],
      rageSpeed: 1,
      summon: { id: 'lurker', count: 3, interval: 15 },
      nukeShare: 0.12,
      tint: 0xd070a0,
      pods: 4,
    },
    description: "The Heart's last spore, grown in Fort Ashby's yard. Its pods shield it: burst them first. Only the head bleeds.",
  },
  crawler: {
    id: 'crawler',
    intel: 'Crawlers, low in the grass. Aim down.',
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
