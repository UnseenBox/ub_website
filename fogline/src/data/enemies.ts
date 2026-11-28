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
  /** Share of its speed kept after a shot to the legs, when it is not the usual one. */
  legSlow?: number;
  /** Metres further out than the rest that it stops to strike: a tall one keeps its head in view. */
  standOff?: number;
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
    /** Gets back up once after a death that was not a headshot (Shambler). */
    rises?: { chance: number; health: number };
    /** Springs from side to side as it runs, then pounces on the wire from `pounceAt` metres (Hound). */
    leap?: { every: [number, number]; distance: [number, number]; seconds: number; pounceAt: number };
    /** Fades out on the way in and comes back right in front of the wire (Stalker). */
    vanish?: { times: number; at: [number, number]; gone: number; back: [number, number] };
    /** Dims the field as it nears; close in, it works a spell that blacks out the view (Wraith). */
    gloom?: { from: number; dim: number; castAt: number; windup: number; seconds: number; cooldown: number; casts: number };
    /** Rears back to roar every so often; while it does, the belly is a soft spot (Brute). */
    roar?: { first: number; every: number; seconds: number; belly: number };
    /** Its footfalls shake the bunker when it is close. */
    stomp?: boolean;
    /** Its spit is a slow bomb that can be shot out of the air, or acid that clouds the view. */
    shot?: 'bomb' | 'acid';
    /** Its scream shakes the player's aim for this long; a headshot during the wind-up cuts it off. */
    disrupt?: number;
    /** Winds up, then sprints at the wire; enough damage during the wind-up stops it (Crimson Brute). */
    rush?: { from: number; windup: number; speed: number };
    /** Armour that breaks off after this share of its health has been done to the body. */
    shatter?: number;
    /** Once, when hurt, it digs under and comes up this much closer (Lurker). */
    dive?: { below: number; seconds: number; closer: number };
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

/** Monsters that have been taken out, and which one stands in for each in old saves. */
export const RETIRED_ENEMIES: Readonly<Record<string, string>> = {
  runner: 'hollow_hound', crawler: 'shambler', plated: 'wraith', carrier: 'pumpkin_brood', howler: 'carrion_screamer',
  sapper: 'hollow_hound', juggernaut: 'crimson_brute', fogborn: 'stalker', sporeling: 'wraith',
};

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
    special: {
      rises: { chance: 0.3, health: 0.45 },
    },
    description: 'The bulk of the dead. Slow and relentless, and some get back up unless the head is taken.',
  },

  brute: {
    id: 'brute',
    intel: 'A Brute. Bullets barely mark its hide. Shoot the head, or the belly when it roars.',
    name: 'Brute',
    // Taller than a doorframe and twice as wide: a wall of dead flesh.
    height: 3.6,
    health: 2000,
    speed: 1.0,
    speedJitter: 0.12,
    // Thick fat soaks body shots; the head is the only soft spot.
    zoneMultiplier: { head: 1, torso: 0.28, legs: 0.28 },
    armoredZones: ['torso', 'legs'],
    standOff: 3,
    attackDamage: 70,
    attackInterval: 2.2,
    reward: 320,
    headshotBonus: 140,
    rig: 'bloat',
    look: 'brute',
    looks: 2,
    voice: 'groan_plated',
    groanInterval: [5, 9],
    // Bullets never stagger it; only a big blast shoves it.
    staggerThreshold: 9999,
    special: {
      roar: { first: 3, every: 7, seconds: 2.1, belly: 3 },
      stomp: true,
    },
    description: 'A giant, bloated hulk that takes an army of bullets. Aim for the head; when it rears back to roar, its swollen belly is soft. Armour-piercing rounds and explosives help.',
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
    special: {
      stomp: true,
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
    special: {
      shot: 'acid',
      ranged: { damage: 14, interval: 4.4, stopRange: [24, 32], shots: 3, windup: 0.75 } },
    tint: 0xc8e070,
    description: 'Holds out in the field and spits acid at the bunker. Kill it during the green wind-up.',
  },

  choir: {
    id: 'choir',
    intel: 'The Choir. A giant Screamer, and the whole horde moves to its voice. Only the head bleeds.',
    name: 'The Choir',
    // Tall, but low enough that its head, the only soft spot, stays clear of the boss bar.
    height: 3.2,
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
    look: 'screamer',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [3, 5],
    staggerThreshold: 1e9,
    special: {
      howl: {
        interval: 12, firstDelay: 6, radius: 60, speedMul: 1.4, duration: 5, maxHowls: 99, stopRange: [30, 34],
        summon: { id: 'hollow_hound', count: 1 },
      },
    },
    boss: {
      stopZ: 15,
      phases: [0.66, 0.33],
      rageSpeed: 1.3,
      summon: { id: 'carrion_screamer', count: 1, interval: 30 },
      nukeShare: 0.2,
      tint: 0xb0c0f0,
    },
    description: 'The voice of the horde. Every scream drives the dead faster. Only the head bleeds.',
  },

  ravager: {
    id: 'ravager',
    intel: 'A Ravager. A Brute with Stalkers folded inside. Kill it far out, or it bursts at the wire and they come at once.',
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
    special: { burstInto: { id: 'stalker', count: 2 } },
    tint: 0x9a7aa0,
    description: 'A mutated Brute. Bursts into two Stalkers when it dies, so kill it far from the wire.',
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
      summon: { id: 'stalker', count: 2, interval: 14 },
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
    special: {
      dive: { below: 0.6, seconds: 1.1, closer: 8 },
      burrow: { near: 16, far: 28 } },
    tint: 0x6a7058,
    description: 'Bursts out of the mud close to the wire, skipping the long walk. Watch the near field.',
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
  gorger: {
    id: 'gorger',
    intel: 'The Gorger. It ate the valley. It stays out in the yard and slams the ground; the whole field shakes when it lands.',
    name: 'The Gorger',
    // A huge, fat dead thing. Its head has to stay on screen, so it stops far out.
    height: 6.2,
    health: 13000,
    speed: 0.5,
    speedJitter: 0,
    zoneMultiplier: { head: 1.5, torso: 0.3, legs: 0.2 },
    armoredZones: [],
    attackDamage: 150,
    attackInterval: 2.2,
    reward: 3400,
    headshotBonus: 0,
    rig: 'bloat',
    look: 'gorger',
    looks: 1,
    voice: 'groan_plated',
    groanInterval: [2, 4],
    staggerThreshold: 1e9,
    // It stops out in the yard and hurls its slams at the bunker: close, it would fill the screen.
    special: { ranged: { damage: 34, interval: 3.6, stopRange: [24, 26], shots: 9999, windup: 1.2 } },
    boss: {
      stopZ: 26,
      phases: [0.66, 0.33],
      rageSpeed: 1.15,
      summon: { id: 'shambler', count: 4, interval: 12 },
      nukeShare: 0.12,
      tint: 0xd8c4c4,
    },
    description: 'The Gorger: a fat, huge dead thing that ate the valley. It stays in the yard and slams the ground. Only the head bleeds.',
  },
  wraith: {
    id: 'wraith',
    intel: 'Wraiths. They drift out of the fog without a sound. Their smoke hides them until they are close.',
    name: 'Wraith',
    height: 2.4,
    health: 240,
    speed: 2.2,
    speedJitter: 0.4,
    zoneMultiplier: { head: 1.4, torso: 1, legs: 0.8 },
    armoredZones: [],
    attackDamage: 18,
    attackInterval: 1.2,
    reward: 60,
    headshotBonus: 25,
    rig: 'run',
    look: 'wraith',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [2, 5],
    staggerThreshold: 40,
    special: {
      gloom: { from: 42, dim: 0.46, castAt: 15, windup: 1.2, seconds: 3.4, cooldown: 11, casts: 2 },
    },
    description: 'A smoke-thin thing that darkens the field as it nears and blinds you with a spell. Hurt it while its eyes burn to break the spell.',
  },
  stalker: {
    id: 'stalker',
    intel: 'Stalkers. Long arms, fast legs. They run straight at the wire and strike from a long reach.',
    name: 'Stalker',
    height: 2.6,
    health: 200,
    speed: 3.6,
    speedJitter: 0.5,
    zoneMultiplier: { head: 1.3, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 22,
    attackInterval: 0.9,
    reward: 55,
    headshotBonus: 20,
    rig: 'run',
    look: 'stalker',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [2, 5],
    staggerThreshold: 50,
    special: {
      vanish: { times: 1, at: [19, 30], gone: 1.5, back: [5.8, 7] },
    },
    description: 'A lanky, pale hunter. It flickers, vanishes, and comes back right in front of you. Be ready where it was heading.',
  },
  crimson_brute: {
    id: 'crimson_brute',
    intel: 'Crimson Brutes. Plates of bone over dead muscle. Aim for the head, or load armour-piercing rounds.',
    name: 'Crimson Brute',
    height: 3.4,
    standOff: 2,
    health: 1400,
    speed: 0.9,
    speedJitter: 0.1,
    zoneMultiplier: { head: 1.4, torso: 0.45, legs: 0.45 },
    armoredZones: ['torso', 'legs'],
    attackDamage: 60,
    attackInterval: 2.4,
    reward: 220,
    headshotBonus: 40,
    rig: 'heavy',
    look: 'crimson',
    looks: 1,
    voice: 'groan_plated',
    groanInterval: [3, 6],
    staggerThreshold: 60,
    special: {
      rush: { from: 28, windup: 1.0, speed: 4.2 },
      shatter: 0.35,
      stomp: true,
    },
    description: 'A heavy, slow brute plated in bone, with glowing red veins. Its fist shakes the ground when it lands.',
  },
  pumpkin_brood: {
    id: 'pumpkin_brood',
    intel: 'Pumpkin Broods. They stop at range and spit a glob that burns the sandbags. Their belly swells just before.',
    name: 'Pumpkin Brood',
    height: 3.0,
    health: 900,
    speed: 0.8,
    speedJitter: 0.1,
    zoneMultiplier: { head: 1.3, torso: 1, legs: 0.8 },
    armoredZones: [],
    attackDamage: 14,
    attackInterval: 1.2,
    reward: 150,
    headshotBonus: 30,
    rig: 'shamble',
    look: 'brood',
    looks: 1,
    voice: 'groan_carrier',
    groanInterval: [4, 8],
    staggerThreshold: 60,
    special: {
      shot: 'bomb',
      ranged: { damage: 26, interval: 3.2, stopRange: [14, 16], shots: 9999, windup: 1.0 } },
    description: 'A hunched, lumbering spitter. It stops at range and spits; watch the belly swell first.',
  },
  hollow_hound: {
    id: 'hollow_hound',
    intel: 'Hollow Hounds. They gallop low and fast, and rear up to pounce. Fast ones are hard to hit: lead them.',
    name: 'Hollow Hound',
    height: 1.2,
    health: 180,
    // The fastest thing in the fog: a full gallop, which a shot to a leg barely checks.
    speed: 7.4,
    speedJitter: 0.8,
    legSlow: 0.85,
    zoneMultiplier: { head: 1.4, torso: 1, legs: 0.8 },
    armoredZones: [],
    attackDamage: 16,
    attackInterval: 0.6,
    reward: 45,
    headshotBonus: 25,
    rig: 'run',
    look: 'hound',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [2, 5],
    staggerThreshold: 30,
    special: {
      leap: { every: [0.7, 1.4], distance: [2.2, 3.4], seconds: 0.34, pounceAt: 9 },
    },
    description: 'A low, very fast hound that leaps from side to side, crouches, and pounces on the wire. Hit it as it crouches.',
  },
  carrion_screamer: {
    id: 'carrion_screamer',
    intel: 'Carrion Screamers. They stop out in the fog and shriek. Every dead thing nearby hears it and speeds up.',
    name: 'Carrion Screamer',
    height: 2.6,
    health: 320,
    speed: 1.6,
    speedJitter: 0.2,
    zoneMultiplier: { head: 1.5, torso: 1, legs: 0.7 },
    armoredZones: [],
    attackDamage: 22,
    attackInterval: 1.6,
    reward: 90,
    headshotBonus: 35,
    rig: 'run',
    look: 'screamer',
    looks: 1,
    voice: 'groan_runner',
    groanInterval: [3, 6],
    staggerThreshold: 50,
    special: {
      disrupt: 2.6,
      howl: { interval: 4, firstDelay: 2, radius: 12, speedMul: 1.6, duration: 4, maxHowls: 3, stopRange: [18, 20] } },
    description: 'A skeletal bird on stilt legs. It shrieks from the fog and calls the dead to speed up.',
  },

};
