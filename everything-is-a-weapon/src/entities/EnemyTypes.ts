import type { ZoneKind } from '../hazards/Zone';

export type EnemyTypeId =
  | 'basic' | 'fast' | 'heavy' | 'helmet' | 'shield' | 'electric'
  | 'fragile' | 'nested' | 'mini' | 'kaboom' | 'trolley'
  | 'gnat' | 'hurler' | 'bulwark'
  | 'chairman' | 'flusher' | 'kraken' | 'fridgezilla' | 'piano' | 'mower' | 'mom'
  | 'vacuumasaurus' | 'hydra' | 'fan' | 'popcorn' | 'cables' | 'cooker' | 'train'
  | 'junk' | 'house' | 'clock' | 'toybox' | 'dishwasher' | 'cardboard';

/** One boss phase: crossed once when hp falls below `below` (fraction of max). */
export interface BossPhase {
  readonly below: number;
  /** Speed multiplier applied from now on (multiplies with earlier phases). */
  readonly enrage?: number;
  /** Minions called in around the boss. */
  readonly summon?: { readonly type: EnemyTypeId; readonly count: number };
  /** An immediate shockwave slam when the phase turns. */
  readonly shockwave?: { readonly radius: number; readonly damage: number };
  /** Ransom-note announcement for the phase change. */
  readonly announce?: string;
}

/** A vacuum monster's appetite: drags loose objects in and eats them. */
export interface SuckSpec {
  /** How far the pull reaches. */
  readonly radius: number;
  /** Acceleration applied to loose objects inside, per second. */
  readonly pull: number;
}

/** A ground slam: telegraphed, then everything nearby regrets it. */
export interface SlamSpec {
  readonly radius: number;
  /** Player damage (always 1 plaster); objects just fly. */
  readonly damage: number;
  /** Seconds between slams. */
  readonly cooldown: number;
  /** Hazard left on the floor where it landed (the Flusher's puddle). */
  readonly spawnZone?: { readonly kind: ZoneKind; readonly radius: number; readonly ttl: number };
}

/** Throwing furniture back: grabs a loose object and hurls it at the player. */
export interface HurlSpec {
  /** How far away the player may be to start a throw. */
  readonly range: number;
  /** Seconds between throws. */
  readonly cooldown: number;
  /** Aim telegraph before release. */
  readonly windup: number;
  /**
   * Conjured ammunition (MOM's endless shoes, the Fridgezilla's frozen fish):
   * when nothing loose is in reach, this object is spawned and thrown instead.
   */
  readonly spawn?: string;
}

/** A tentacle lash: telegraphed cone attack that slaps and drags things in. */
export interface LashSpec {
  readonly range: number;
  /** Full cone width in radians. */
  readonly arc: number;
  readonly cooldown: number;
  readonly windup: number;
}

/** Sidestepping thrown objects at the last moment (MOM sees it coming). */
export interface DodgeSpec {
  /** Incoming throws are noticed this far out. */
  readonly radius: number;
  readonly cooldown: number;
}

/** Picking the room up and putting it somewhere else (MOM tidies mid-fight). */
export interface RearrangeSpec {
  readonly cooldown: number;
  /** How many loose objects get relocated per tidy-up. */
  readonly count: number;
}

/** A freezing aura that leaves slippery patches on the floor. */
export interface FrostSpec {
  readonly radius: number;
  readonly interval: number;
  readonly ttl: number;
}

/** Blinking across the room in a puff of popcorn smell. */
export interface TeleportSpec {
  readonly cooldown: number;
  /** Minimum distance from the player after the jump. */
  readonly minDist: number;
}

/** Oozing a hazard zone wherever it stands. */
export interface SeepSpec {
  readonly kind: ZoneKind;
  readonly radius: number;
  readonly interval: number;
  readonly ttl: number;
}

/** Stopping time in a bubble: you crawl, the furniture flies. */
export interface StasisSpec {
  readonly radius: number;
  readonly cooldown: number;
  /** Seconds the player stays slowed. */
  readonly slowDuration: number;
}

/** Popping out minions on a timer, escalating as the fight goes on. */
export interface SpawnSpec {
  readonly pool: readonly EnemyTypeId[];
  readonly interval: number;
  /** No new toys while this many summoned are still standing. */
  readonly maxAlive: number;
  /** Every Nth summon is the big one instead. */
  readonly escalateEvery?: number;
  readonly escalateType?: EnemyTypeId;
}

/** One shape of a shapeshifter: what it is, how fast, what it may do. */
export interface FormSpec {
  readonly key: string;
  readonly name: string;
  readonly speedMult: number;
  readonly slam?: boolean;
  readonly hurl?: boolean;
  readonly lungeRange?: number;
  readonly announce: string;
}

/** A crackling aura that zaps whatever stands too close. */
export interface ZapSpec {
  readonly radius: number;
  readonly interval: number;
}

/** A flying menace that seeds swirling wind currents around itself. */
export interface WindSpec {
  readonly radius: number;
  readonly interval: number;
  readonly ttl: number;
}

export interface EnemyType {
  readonly id: EnemyTypeId;
  readonly name: string;
  readonly hp: number;
  readonly speed: number;
  readonly mass: number;
  readonly radius: number;
  /** Seconds between noticing the player and acting on it. */
  readonly reaction: number;
  readonly awareness: number;
  /** Multiplier on damage from thrown/pushed objects. */
  readonly impactFactor: number;
  /** Extra multiplier when the object weighs less than 3. */
  readonly lightObjectFactor: number;
  /** Multiplier on stagger time and knockback. */
  readonly staggerFactor: number;
  readonly turnRate: number;
  readonly helmetHp?: number;
  /** A front board: blocks frontal hits until its HP runs out. */
  readonly shieldHp?: number;
  readonly shield?: boolean;
  readonly shockImmune?: boolean;
  readonly electric?: boolean;
  readonly weave?: boolean;
  readonly color: string;
  readonly shade: string;
  readonly scoreBonus: number;
  /** Base pitch of this intruder's voice, in Hz. */
  readonly voice: number;
  /** Cardboard and paper go up faster than timber. */
  readonly burnFactor: number;
  /** What is left behind when it is beaten: broken glass, two smaller boxes, or a crater. */
  readonly onDefeat?: 'glass' | 'split' | 'explode';
  /** A charge instead of a shove: how far away it starts, how fast and how long it runs. */
  readonly lungeRange?: number;
  readonly lungeSpeed?: number;
  readonly lungeTime?: number;
  readonly windup?: number;
  readonly recover?: number;
  /** Set on bosses: generalized defeat banners, mugshots, scrap and scheduling. */
  readonly boss?: boolean;
  /** Defeat stamp + discovery for this boss. */
  readonly bossTitle?: string;
  readonly bossDiscovery?: string;
  /** Arrival announcement for this boss. */
  readonly bossBanner?: string;
  readonly bossBlurb?: string;
  /** Phase changes, evaluated top to bottom as hp falls. */
  readonly phases?: readonly BossPhase[];
  /** Vacuum appetite. */
  readonly sucks?: SuckSpec;
  /** Ground-slam attack. */
  readonly slams?: SlamSpec;
  /** Throw-furniture-back attack. */
  readonly hurls?: HurlSpec;
  /** Tentacle-lash cone attack. */
  readonly lashes?: LashSpec;
  /** Sidestepping incoming throws (and catching them). */
  readonly dodges?: DodgeSpec;
  /** Relocating loose furniture mid-fight. */
  readonly rearranges?: RearrangeSpec;
  /** Freezing aura. */
  readonly frost?: FrostSpec;
  /** Shreds furniture while charging: debris, shake and noise. */
  readonly tramples?: boolean;
  /** Also inhales rival movers (and heals off them). */
  readonly voracious?: boolean;
  /** Blink teleport. */
  readonly teleports?: TeleportSpec;
  /** Oozes hazard zones. */
  readonly seeps?: SeepSpec;
  /** Time-freeze pulse. */
  readonly stasis?: StasisSpec;
  /** Summons minions on a timer. */
  readonly spawns?: SpawnSpec;
  /** Cycles combat forms (the King of Cardboard). */
  readonly forms?: readonly FormSpec[];
  /** Seconds between form changes. */
  readonly formInterval?: number;
  /** Crackling aura. */
  readonly zaps?: ZapSpec;
  /** Seeds wind currents. */
  readonly winds?: WindSpec;
}

/**
 * The Movers: a removal crew of living cardboard boxes. New variants are data — add an entry
 * here and a build in rendering/EnemyArt.ts.
 */
export const ENEMY_TYPES: Readonly<Record<EnemyTypeId, EnemyType>> = {
  basic: {
    id: 'basic', name: 'Box', hp: 44, speed: 102, mass: 45, radius: 16, reaction: 0.45, awareness: 360,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 1, turnRate: 9, burnFactor: 1.25,
    color: '#c9a070', shade: '#9c7446', scoreBonus: 0, voice: 172,
  },
  fast: {
    id: 'fast', name: 'Express', hp: 34, speed: 172, mass: 28, radius: 13, reaction: 0.25, awareness: 520,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 1.25, turnRate: 12, weave: true, burnFactor: 1.7,
    color: '#f6eed8', shade: '#d8ccac', scoreBonus: 50, voice: 258,
  },
  heavy: {
    id: 'heavy', name: 'Crate', hp: 170, speed: 58, mass: 120, radius: 23, reaction: 0.8, awareness: 380,
    impactFactor: 1, lightObjectFactor: 0.25, staggerFactor: 0.35, turnRate: 5, burnFactor: 1,
    color: '#b07a45', shade: '#7a4f28', scoreBonus: 200, voice: 92,
  },
  helmet: {
    id: 'helmet', name: 'Pan Head', hp: 70, speed: 90, mass: 50, radius: 16, reaction: 0.55, awareness: 340,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 0.8, turnRate: 9, helmetHp: 55, burnFactor: 1.25,
    color: '#c9a070', shade: '#9c7446', scoreBonus: 100, voice: 160,
  },
  shield: {
    id: 'shield', name: 'Bailiff', hp: 70, speed: 78, mass: 60, radius: 17, reaction: 0.6, awareness: 380,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 0.8, turnRate: 2.4, shield: true, shieldHp: 60, burnFactor: 1.25,
    color: '#b58d60', shade: '#86623c', scoreBonus: 150, voice: 135,
  },
  electric: {
    id: 'electric', name: 'Tangle', hp: 80, speed: 84, mass: 45, radius: 16, reaction: 0.5, awareness: 360,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 1, turnRate: 9, shockImmune: true, electric: true, burnFactor: 1.25,
    color: '#c9a070', shade: '#9c7446', scoreBonus: 150, voice: 208,
  },
  // Glassware. Goes down easily, and leaves the floor covered in what was inside.
  fragile: {
    id: 'fragile', name: 'Fragile', hp: 26, speed: 122, mass: 26, radius: 14, reaction: 0.4, awareness: 420,
    impactFactor: 1.2, lightObjectFactor: 1, staggerFactor: 1.2, turnRate: 10, burnFactor: 1.25, onDefeat: 'glass',
    color: '#dfeaf2', shade: '#b3c4d2', scoreBonus: 60, voice: 300,
  },
  // A box with a box inside it, with a box inside that.
  nested: {
    id: 'nested', name: 'Nesting Box', hp: 95, speed: 80, mass: 70, radius: 20, reaction: 0.6, awareness: 360,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.7, turnRate: 7, burnFactor: 1.25, onDefeat: 'split',
    color: '#c9a070', shade: '#9c7446', scoreBonus: 150, voice: 140,
  },
  mini: {
    id: 'mini', name: 'Small', hp: 20, speed: 150, mass: 14, radius: 10, reaction: 0.2, awareness: 600,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 1.5, turnRate: 13, burnFactor: 1.6,
    color: '#d9b687', shade: '#b08a5a', scoreBonus: 30, voice: 330,
  },
  // Somebody's fireworks, packed badly. Beat it next to its colleagues.
  kaboom: {
    id: 'kaboom', name: 'Kaboom', hp: 50, speed: 92, mass: 45, radius: 16, reaction: 0.5, awareness: 360,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 1, turnRate: 9, burnFactor: 2.4, onDefeat: 'explode',
    color: '#ef7a6c', shade: '#c9483f', scoreBonus: 120, voice: 190,
  },
  // A box on a sack truck: slow to line up, then it comes the whole length of the room.
  trolley: {
    id: 'trolley', name: 'Trolley', hp: 85, speed: 66, mass: 85, radius: 17, reaction: 0.7, awareness: 420,
    impactFactor: 1, lightObjectFactor: 0.8, staggerFactor: 0.6, turnRate: 3.2, burnFactor: 1,
    lungeRange: 250, lungeSpeed: 640, lungeTime: 0.62, windup: 0.8, recover: 1.25,
    color: '#b58d60', shade: '#86623c', scoreBonus: 180, voice: 118,
  },
  // A gnat: tiny, furious, and never alone. Swat the swarm before it nibbles you apart.
  gnat: {
    id: 'gnat', name: 'Gnat', hp: 12, speed: 195, mass: 8, radius: 8, reaction: 0.15, awareness: 620,
    impactFactor: 1.1, lightObjectFactor: 1, staggerFactor: 1.6, turnRate: 14, weave: true, burnFactor: 1.6,
    lungeRange: 10, lungeSpeed: 520, windup: 0.25, recover: 0.4,
    color: '#e0d24a', shade: '#9a8f2e', scoreBonus: 40, voice: 430,
  },
  // A chucker: picks up whatever is lying around and throws it back. Rude. Interruptible.
  hurler: {
    id: 'hurler', name: 'Chucker', hp: 65, speed: 88, mass: 50, radius: 16, reaction: 0.5, awareness: 430,
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 0.8, turnRate: 8, burnFactor: 1.25,
    color: '#b5654a', shade: '#7d3f2c', scoreBonus: 150, voice: 150,
    hurls: { range: 460, cooldown: 4.5, windup: 0.7 },
  },
  // A bulwark: a walking safe door. Front impacts clang off; burn it, shock it, or go around.
  bulwark: {
    id: 'bulwark', name: 'Bulwark', hp: 130, speed: 60, mass: 110, radius: 19, reaction: 0.7, awareness: 380,
    impactFactor: 0.9, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 1.6, shield: true, shieldHp: 95, helmetHp: 80,
    burnFactor: 1.4, color: '#5a6b7d', shade: '#3a4552', scoreBonus: 200, voice: 100,
  },
  // CHAIRMAN OF CHAOS: middle management fused to its office chair. Rolls at you,
  // staples whatever is at hand, and slams the desk when angry. No parachute.
  chairman: {
    id: 'chairman', name: 'Chairman', hp: 520, speed: 112, mass: 450, radius: 48, reaction: 0.5, awareness: 460,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.6, turnRate: 7, burnFactor: 1.1,
    lungeRange: 300, lungeSpeed: 620, lungeTime: 0.5, windup: 0.8, recover: 0.9,
    color: '#3a4a5c', shade: '#232e3b', scoreBonus: 400, voice: 120,
    boss: true, bossTitle: 'CHAIRMAN OUSTED', bossDiscovery: 'hostile_takeover',
    bossBanner: 'CHAIRMAN OF CHAOS', bossBlurb: 'your 9 a.m. has been rescheduled. forever.',
    hurls: { range: 480, cooldown: 2.4, windup: 0.5, spawn: 'paperball' },
    slams: { radius: 125, damage: 1, cooldown: 8 },
    phases: [
      {
        below: 0.5, enrage: 1.2, summon: { type: 'mini', count: 2 },
        announce: 'OVERTIME',
      },
    ],
  },
  // THE FLUSHER: the toilet achieved sentience and it is furious. Whirlpools drag
  // the room into its bowl; it spits plungers and leaves water wherever it sits.
  flusher: {
    id: 'flusher', name: 'Flusher', hp: 500, speed: 62, mass: 540, radius: 54, reaction: 0.7, awareness: 440,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 4.5, burnFactor: 1,
    color: '#dfeaf2', shade: '#9fb3c4', scoreBonus: 400, voice: 75,
    boss: true, bossTitle: 'FLUSHER UNBLOCKED', bossDiscovery: 'do_not_flush',
    bossBanner: 'THE FLUSHER', bossBlurb: 'do not stand downstream.',
    sucks: { radius: 240, pull: 850 },
    slams: { radius: 135, damage: 1, cooldown: 7, spawnZone: { kind: 'water', radius: 65, ttl: 10 } },
    hurls: { range: 440, cooldown: 4, windup: 0.7, spawn: 'plunger' },
    phases: [
      {
        below: 0.5, enrage: 1.25, shockwave: { radius: 160, damage: 1 },
        announce: 'OVERFLOW',
      },
    ],
  },
  // SOFA KRAKEN: the lounge display woke up with cushion tentacles and a spring
  // chassis. It hugs at range and sits on you up close. Allergic to open flame.
  kraken: {
    id: 'kraken', name: 'Sofa Kraken', hp: 580, speed: 60, mass: 570, radius: 58, reaction: 0.7, awareness: 440,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 4.5, burnFactor: 1.2,
    color: '#7a3b5c', shade: '#522741', scoreBonus: 500, voice: 65,
    boss: true, bossTitle: 'KRAKEN DEFLATED', bossDiscovery: 'release_the_kraken',
    bossBanner: 'SOFA KRAKEN', bossBlurb: 'it wants a hug. decline.',
    lashes: { range: 200, arc: 0.8, cooldown: 5, windup: 0.6 },
    slams: { radius: 135, damage: 1, cooldown: 7 },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'IT HUGS BACK' },
    ],
  },
  // FRIDGEZILLA: walks out of the kitchenette breathing frost. The floor freezes
  // wherever it stands and frozen fish fly wherever it looks. Poorly insulated
  // against its own supply chain: feed it fire.
  fridgezilla: {
    id: 'fridgezilla', name: 'Fridgezilla', hp: 580, speed: 52, mass: 600, radius: 58, reaction: 0.8, awareness: 420,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 3.5, burnFactor: 0.8,
    color: '#cfe0e8', shade: '#8fa8b8', scoreBonus: 500, voice: 70,
    boss: true, bossTitle: 'FRIDGEZILLA DEFROSTED', bossDiscovery: 'brain_freeze',
    bossBanner: 'FRIDGEZILLA', bossBlurb: 'serve chilled. serves you chilled.',
    hurls: { range: 470, cooldown: 3, windup: 0.6, spawn: 'fish' },
    frost: { radius: 48, interval: 4, ttl: 9 },
    slams: { radius: 125, damage: 1, cooldown: 8 },
    phases: [
      {
        below: 0.5, enrage: 1.2, summon: { type: 'fragile', count: 2 },
        announce: 'FROZEN GOODS',
      },
    ],
  },
  // PIANO SPIDER: the showroom grand grew eight legs and perfect pitch. It crawls
  // the aisles fast and every landing is a sonic boom. Applaud from a distance.
  piano: {
    id: 'piano', name: 'Piano Spider', hp: 640, speed: 118, mass: 570, radius: 58, reaction: 0.6, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 6, burnFactor: 1.1,
    color: '#26232e', shade: '#121017', scoreBonus: 600, voice: 55,
    boss: true, bossTitle: 'PIANO OUT OF TUNE', bossDiscovery: 'grand_finale',
    bossBanner: 'PIANO SPIDER', bossBlurb: 'tonight: one night only. every night.',
    slams: { radius: 170, damage: 1, cooldown: 7 },
    phases: [
      {
        below: 0.5, enrage: 1.3, summon: { type: 'gnat', count: 2 },
        announce: 'THE HIGH NOTES',
      },
    ],
  },
  // LAWN MOWER MANIAC: escaped the shed and mows everything, including the room.
  // It picks a lane, revs, and comes the whole length of it. Do not be a lane.
  mower: {
    id: 'mower', name: 'Mower Maniac', hp: 560, speed: 95, mass: 540, radius: 52, reaction: 0.5, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 5, burnFactor: 1.2,
    lungeRange: 380, lungeSpeed: 720, lungeTime: 0.8, windup: 0.9, recover: 1,
    color: '#c23b2e', shade: '#7d241c', scoreBonus: 500, voice: 90,
    boss: true, bossTitle: 'MOWER RETIRED', bossDiscovery: 'mow_no_mo',
    bossBanner: 'LAWN MOWER MANIAC', bossBlurb: 'the grass is always greener. you are the grass.',
    tramples: true,
    phases: [
      {
        below: 0.5, enrage: 1.3, shockwave: { radius: 140, damage: 1 },
        announce: 'BACKFIRE',
      },
    ],
  },
  // MOM — THE FINAL BOSS. Armed with a slipper and zero patience. She sidesteps
  // your throws (and catches the slow ones), tidies the arena mid-fight, throws
  // shoes back, and gets strictly worse in three phases. Bedtime is non-negotiable.
  mom: {
    id: 'mom', name: 'Mom', hp: 1000, speed: 95, mass: 510, radius: 58, reaction: 0.4, awareness: 560,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.5, turnRate: 10, burnFactor: 1,
    color: '#8a3b5c', shade: '#5c2540', scoreBonus: 1500, voice: 300,
    boss: true, bossTitle: 'MOM CALMED DOWN', bossDiscovery: 'mom_says_no',
    bossBanner: 'MOM', bossBlurb: 'she found the mess. run.',
    dodges: { radius: 210, cooldown: 2.5 },
    rearranges: { cooldown: 14, count: 5 },
    hurls: { range: 500, cooldown: 3.2, windup: 0.6, spawn: 'shoe' },
    slams: { radius: 145, damage: 1, cooldown: 7 },
    phases: [
      { below: 0.66, enrage: 1.2, announce: 'GO TO YOUR ROOM' },
      { below: 0.33, enrage: 1.5, summon: { type: 'gnat', count: 3 }, shockwave: { radius: 150, damage: 1 }, announce: 'NO DESSERT' },
      { below: 0.15, enrage: 1.8, summon: { type: 'gnat', count: 5 }, shockwave: { radius: 170, damage: 2 }, announce: 'BEDTIME' },
    ],
  },
  // VACUUMASAURUS: the apex predator of dust. Inhales furniture, projectiles
  // and — when hungry — its own colleagues. Do not stand between it and lunch.
  vacuumasaurus: {
    id: 'vacuumasaurus', name: 'Vacuumasaurus', hp: 640, speed: 70, mass: 660, radius: 60, reaction: 0.7, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 4, burnFactor: 1,
    color: '#4a5c3a', shade: '#2c3a24', scoreBonus: 700, voice: 60,
    boss: true, bossTitle: 'SAURUS EXTINCT', bossDiscovery: 'saurus_fed',
    bossBanner: 'VACUUMASAURUS', bossBlurb: '65 million years of dust. zero survivors.',
    sucks: { radius: 260, pull: 1000 }, voracious: true,
    slams: { radius: 140, damage: 1, cooldown: 8 },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'SECONDS' },
    ],
  },
  // LAUNDRY HYDRA: one basket, three sock serpents, zero matching pairs. Each
  // head has its own opinion and they are all aimed at you.
  hydra: {
    id: 'hydra', name: 'Laundry Hydra', hp: 540, speed: 66, mass: 510, radius: 54, reaction: 0.6, awareness: 450,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 5, burnFactor: 1.1,
    color: '#7a8ba8', shade: '#4d5a75', scoreBonus: 600, voice: 200,
    boss: true, bossTitle: 'HYDRA FOLDED', bossDiscovery: 'split_ends',
    bossBanner: 'LAUNDRY HYDRA', bossBlurb: 'three heads. no pairs. all angry.',
    lashes: { range: 185, arc: 0.9, cooldown: 3.5, windup: 0.5 },
    hurls: { range: 420, cooldown: 3, windup: 0.6, spawn: 'ball' },
    phases: [
      { below: 0.5, enrage: 1.3, summon: { type: 'gnat', count: 2 }, announce: 'IT MULTIPLIES' },
    ],
  },
  // FAN-TASTIC NIGHTMARE: a ceiling fan that filed for flight. It hovers, it
  // swoops, and it seeds cyclones that steal your throws mid-air.
  fan: {
    id: 'fan', name: 'Fan-tastic', hp: 500, speed: 130, mass: 270, radius: 44, reaction: 0.4, awareness: 520,
    impactFactor: 1, lightObjectFactor: 0.8, staggerFactor: 0.7, turnRate: 8, burnFactor: 1.2,
    lungeRange: 200, lungeSpeed: 560, lungeTime: 0.4, windup: 0.5, recover: 0.7,
    color: '#9fb3c4', shade: '#647687', scoreBonus: 600, voice: 240,
    boss: true, bossTitle: 'FAN SWITCHED OFF', bossDiscovery: 'fan_mail',
    bossBanner: 'FAN-TASTIC NIGHTMARE', bossBlurb: 'it puts the air in despair.',
    winds: { radius: 90, interval: 3.5, ttl: 4 },
    phases: [
      { below: 0.5, enrage: 1.4, announce: 'TURBO' },
    ],
  },
  // POPCORN APOCALYPSE: a microwave wizard that blinks around the room lobbing
  // fresh cans. Every throw is a timer. Stand somewhere else.
  popcorn: {
    id: 'popcorn', name: 'Popcorn', hp: 480, speed: 80, mass: 330, radius: 46, reaction: 0.5, awareness: 500,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.6, turnRate: 7, burnFactor: 1.3,
    color: '#e8b13c', shade: '#a87a24', scoreBonus: 600, voice: 260,
    boss: true, bossTitle: 'POPCORN BURNT', bossDiscovery: 'burnt_popcorn',
    bossBanner: 'POPCORN APOCALYPSE', bossBlurb: 'fresh, hot, and aimed at you.',
    teleports: { cooldown: 9, minDist: 220 },
    hurls: { range: 420, cooldown: 2.8, windup: 0.6, spawn: 'spraycan' },
    phases: [
      { below: 0.4, enrage: 1.4, announce: 'EXTRA BUTTER' },
    ],
  },
  // CABLE KRAKEN: a nest of live wire with plug tentacles. It lashes, it
  // crackles, and standing close is a billing event.
  cables: {
    id: 'cables', name: 'Cable Kraken', hp: 580, speed: 58, mass: 540, radius: 56, reaction: 0.7, awareness: 450,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 4, burnFactor: 1,
    shockImmune: true,
    color: '#3a3a4a', shade: '#1f1f2a', scoreBonus: 650, voice: 150,
    boss: true, bossTitle: 'CABLES UNTANGLED', bossDiscovery: 'untangled',
    bossBanner: 'CABLE KRAKEN', bossBlurb: 'do not lick.',
    lashes: { range: 170, arc: 0.9, cooldown: 4, windup: 0.6 },
    zaps: { radius: 170, interval: 3 },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'HIGH VOLTAGE' },
    ],
  },
  // PRESSURE COOKER: a boiler with a grudge and a whistle. It sits on you in a
  // cloud of steam, and past half pressure the lid starts coming off.
  cooker: {
    id: 'cooker', name: 'Pressure Cooker', hp: 600, speed: 55, mass: 600, radius: 58, reaction: 0.8, awareness: 430,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.35, turnRate: 3.5, burnFactor: 0.9,
    color: '#b8b0a0', shade: '#7d7668', scoreBonus: 650, voice: 75,
    boss: true, bossTitle: 'COOKER DEPRESSURIZED', bossDiscovery: 'pressure_drop',
    bossBanner: 'PRESSURE COOKER', bossBlurb: 'do not remove the lid. it will.',
    slams: { radius: 135, damage: 1, cooldown: 6, spawnZone: { kind: 'steam', radius: 70, ttl: 6 } },
    phases: [
      { below: 0.6, enrage: 1.2, announce: 'SIMMERING' },
      { below: 0.3, enrage: 1.4, shockwave: { radius: 150, damage: 1 }, announce: 'BOILING OVER' },
    ],
  },
  // MIDNIGHT EXPRESS: a runaway train of fused appliances. It picks a track,
  // whistles once, and then there is only track. Be elsewhere.
  train: {
    id: 'train', name: 'Midnight Express', hp: 640, speed: 85, mass: 720, radius: 60, reaction: 0.6, awareness: 520,
    impactFactor: 1, lightObjectFactor: 0.4, staggerFactor: 0.3, turnRate: 3, burnFactor: 1,
    lungeRange: 500, lungeSpeed: 800, lungeTime: 0.9, windup: 1, recover: 1.2,
    color: '#2e3a55', shade: '#1a2236', scoreBonus: 700, voice: 70,
    boss: true, bossTitle: 'EXPRESS DERAILED', bossDiscovery: 'derailed',
    bossBanner: 'MIDNIGHT EXPRESS', bossBlurb: 'all aboard. no refunds.',
    tramples: true,
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'EXPRESS' },
    ],
  },
  // LANDLORD, KING OF JUNK: eviction day, final form. A tower of wardrobes,
  // lamps and cable that pulls the room's junk into orbit and reigns it down.
  junk: {
    id: 'junk', name: 'King of Junk', hp: 760, speed: 60, mass: 690, radius: 60, reaction: 0.7, awareness: 460,
    impactFactor: 1, lightObjectFactor: 0.4, staggerFactor: 0.3, turnRate: 4, burnFactor: 1.1,
    color: '#6b5a86', shade: '#453a58', scoreBonus: 800, voice: 65,
    boss: true, bossTitle: 'JUNK REMOVED', bossDiscovery: 'junk_removed',
    bossBanner: 'KING OF JUNK', bossBlurb: 'your deposit is forfeit. so are you.',
    sucks: { radius: 170, pull: 500 },
    hurls: { range: 460, cooldown: 3.5, windup: 0.7, spawn: 'plank' },
    slams: { radius: 140, damage: 1, cooldown: 8 },
    phases: [
      { below: 0.66, summon: { type: 'mini', count: 2 }, announce: 'MORE TRIBUTE' },
      {
        below: 0.33, enrage: 1.4, summon: { type: 'mini', count: 2 },
        shockwave: { radius: 160, damage: 1 }, announce: 'THE KING DEMANDS',
      },
    ],
  },
  // THE HOUSE THAT HATES YOU: the building got up. Slow, vast, and throwing
  // pieces of itself. The floor is lava is the least of it — the floor is mad.
  house: {
    id: 'house', name: 'The House', hp: 820, speed: 38, mass: 900, radius: 64, reaction: 0.9, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.4, staggerFactor: 0.25, turnRate: 2.5, burnFactor: 1.2,
    color: '#a85848', shade: '#74382e', scoreBonus: 900, voice: 50,
    boss: true, bossTitle: 'HOUSE CONDEMNED', bossDiscovery: 'condemned',
    bossBanner: 'THE HOUSE THAT HATES YOU', bossBlurb: 'rent due. tenants doomed.',
    slams: { radius: 160, damage: 1, cooldown: 9 },
    hurls: { range: 500, cooldown: 4, windup: 0.8, spawn: 'plank' },
    phases: [
      { below: 0.5, enrage: 1.25, announce: 'THE WALLS HAVE EYES' },
      { below: 0.25, shockwave: { radius: 180, damage: 1 }, announce: 'GET OUT' },
      { below: 0.15, shockwave: { radius: 200, damage: 2 }, announce: 'CONDemned' },
    ],
  },
  // TIME-THIEF ALARM CLOCK: it rings, and physics files a complaint. Time
  // freezes around you while the furniture gets fast and spiteful.
  clock: {
    id: 'clock', name: 'Time-Thief', hp: 540, speed: 70, mass: 390, radius: 50, reaction: 0.4, awareness: 540,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 6, burnFactor: 1,
    color: '#3fa7a3', shade: '#2a736f', scoreBonus: 700, voice: 400,
    boss: true, bossTitle: 'CLOCK SNOOZED', bossDiscovery: 'snoozed_forever',
    bossBanner: 'TIME-THIEF', bossBlurb: 'you are late. permanently.',
    stasis: { radius: 260, cooldown: 12, slowDuration: 2.2 },
    hurls: { range: 450, cooldown: 4, windup: 0.6, spawn: 'alarmclock' },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'TICK TOCK' },
    ],
  },
  // TOYBOX TITAN: a toy chest with a crank and no bedtime. Toys come out on a
  // timer, and every third toy is a bigger toy. Playtime never ends.
  toybox: {
    id: 'toybox', name: 'Toybox Titan', hp: 560, speed: 55, mass: 540, radius: 54, reaction: 0.7, awareness: 450,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 4, burnFactor: 1.2,
    color: '#d4652e', shade: '#8f3f1c', scoreBonus: 650, voice: 220,
    boss: true, bossTitle: 'TOYS PUT AWAY', bossDiscovery: 'put_away',
    bossBanner: 'TOYBOX TITAN', bossBlurb: 'playtime. forever.',
    spawns: { pool: ['gnat', 'mini'], interval: 8, maxAlive: 4, escalateEvery: 3, escalateType: 'nested' },
    slams: { radius: 120, damage: 1, cooldown: 8 },
    phases: [
      { below: 0.5, enrage: 1.2, announce: 'PLAYTIME' },
    ],
  },
  // DISHWASHER DEMON: rinse aid and rage. It floods its own arena, then bowls
  // plates down the slipway. Do not chase it through the puddle.
  dishwasher: {
    id: 'dishwasher', name: 'Dishwasher Demon', hp: 540, speed: 60, mass: 540, radius: 54, reaction: 0.7, awareness: 440,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 4, burnFactor: 0.9,
    color: '#7a9bb0', shade: '#4d6a7d', scoreBonus: 600, voice: 130,
    boss: true, bossTitle: 'DISHWASHER AIR-DRIED', bossDiscovery: 'air_dried',
    bossBanner: 'DISHWASHER DEMON', bossBlurb: 'everything must go. through you.',
    seeps: { kind: 'water', radius: 50, interval: 5, ttl: 12 },
    hurls: { range: 460, cooldown: 3, windup: 0.6, spawn: 'plate' },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'RINSE CYCLE' },
    ],
  },
  // KING OF CARDBOARD: flat-pack royalty with three coronations. Tank crawls and
  // crushes, chopper swoops, robot throws the room back. Watch the announcement.
  cardboard: {
    id: 'cardboard', name: 'King of Cardboard', hp: 760, speed: 80, mass: 510, radius: 54, reaction: 0.5, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.45, turnRate: 6, burnFactor: 1.4,
    lungeRange: 150, lungeSpeed: 480, lungeTime: 0.4, windup: 0.5, recover: 0.7,
    color: '#c9a070', shade: '#9c7446', scoreBonus: 900, voice: 140,
    boss: true, bossTitle: 'KING FLAT-PACKED', bossDiscovery: 'flat_pack',
    bossBanner: 'KING OF CARDBOARD', bossBlurb: 'some assembly required. yours.',
    hurls: { range: 450, cooldown: 3.5, windup: 0.6, spawn: 'plank' },
    slams: { radius: 130, damage: 1, cooldown: 7 },
    forms: [
      { key: 'tank', name: 'TANK', speedMult: 0.6, slam: true, announce: 'TANK!' },
      { key: 'chopper', name: 'CHOPPER', speedMult: 1.7, lungeRange: 320, announce: 'CHOPPER!' },
      { key: 'robot', name: 'ROBOT', speedMult: 1, slam: true, hurl: true, announce: 'ROBOT!' },
    ],
    formInterval: 11,
    phases: [
      { below: 0.5, summon: { type: 'mini', count: 2 }, announce: 'REINFORCEMENTS' },
      { below: 0.15, enrage: 1.6, summon: { type: 'nested', count: 3 }, shockwave: { radius: 160, damage: 2 }, announce: 'FLAT-PACKED!' },
    ],
  },
};
