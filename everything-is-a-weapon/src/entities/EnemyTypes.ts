import type { ZoneKind } from '../hazards/Zone';

export type EnemyTypeId =
  | 'basic' | 'fast' | 'heavy' | 'helmet' | 'shield' | 'electric'
  | 'fragile' | 'nested' | 'mini' | 'kaboom' | 'trolley'
  | 'gnat' | 'hurler' | 'bulwark'
  | 'chairman' | 'flusher' | 'kraken' | 'fridgezilla' | 'piano' | 'mower' | 'mom';

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
    impactFactor: 1, lightObjectFactor: 1, staggerFactor: 0.8, turnRate: 2.4, shield: true, burnFactor: 1.25,
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
    impactFactor: 0.9, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 1.6, shield: true, helmetHp: 80,
    burnFactor: 1.4, color: '#5a6b7d', shade: '#3a4552', scoreBonus: 200, voice: 100,
  },
  // CHAIRMAN OF CHAOS: middle management fused to its office chair. Rolls at you,
  // staples whatever is at hand, and slams the desk when angry. No parachute.
  chairman: {
    id: 'chairman', name: 'Chairman', hp: 300, speed: 112, mass: 110, radius: 20, reaction: 0.5, awareness: 460,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.6, turnRate: 7, burnFactor: 1.1,
    lungeRange: 300, lungeSpeed: 620, lungeTime: 0.5, windup: 0.8, recover: 0.9,
    color: '#3a4a5c', shade: '#232e3b', scoreBonus: 400, voice: 120,
    boss: true, bossTitle: 'CHAIRMAN OUSTED', bossDiscovery: 'hostile_takeover',
    bossBanner: 'CHAIRMAN OF CHAOS', bossBlurb: 'your 9 a.m. has been rescheduled. forever.',
    hurls: { range: 480, cooldown: 2.4, windup: 0.5, spawn: 'paperball' },
    slams: { radius: 110, damage: 1, cooldown: 8 },
  },
  // THE FLUSHER: the toilet achieved sentience and it is furious. Whirlpools drag
  // the room into its bowl; it spits plungers and leaves water wherever it sits.
  flusher: {
    id: 'flusher', name: 'Flusher', hp: 280, speed: 62, mass: 140, radius: 23, reaction: 0.7, awareness: 440,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 4.5, burnFactor: 1,
    color: '#dfeaf2', shade: '#9fb3c4', scoreBonus: 400, voice: 75,
    boss: true, bossTitle: 'FLUSHER UNBLOCKED', bossDiscovery: 'do_not_flush',
    bossBanner: 'THE FLUSHER', bossBlurb: 'do not stand downstream.',
    sucks: { radius: 210, pull: 800 },
    slams: { radius: 120, damage: 1, cooldown: 7, spawnZone: { kind: 'water', radius: 60, ttl: 10 } },
    hurls: { range: 440, cooldown: 4, windup: 0.7, spawn: 'plunger' },
  },
  // SOFA KRAKEN: the lounge display woke up with cushion tentacles and a spring
  // chassis. It hugs at range and sits on you up close. Allergic to open flame.
  kraken: {
    id: 'kraken', name: 'Sofa Kraken', hp: 340, speed: 60, mass: 150, radius: 24, reaction: 0.7, awareness: 440,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 4.5, burnFactor: 1.2,
    color: '#7a3b5c', shade: '#522741', scoreBonus: 500, voice: 65,
    boss: true, bossTitle: 'KRAKEN DEFLATED', bossDiscovery: 'release_the_kraken',
    bossBanner: 'SOFA KRAKEN', bossBlurb: 'it wants a hug. decline.',
    lashes: { range: 175, arc: 0.8, cooldown: 5, windup: 0.6 },
    slams: { radius: 120, damage: 1, cooldown: 7 },
    phases: [
      { below: 0.5, enrage: 1.3, announce: 'IT HUGS BACK' },
    ],
  },
  // FRIDGEZILLA: walks out of the kitchenette breathing frost. The floor freezes
  // wherever it stands and frozen fish fly wherever it looks. Poorly insulated
  // against its own supply chain: feed it fire.
  fridgezilla: {
    id: 'fridgezilla', name: 'Fridgezilla', hp: 340, speed: 52, mass: 160, radius: 24, reaction: 0.8, awareness: 420,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.4, turnRate: 3.5, burnFactor: 0.8,
    color: '#cfe0e8', shade: '#8fa8b8', scoreBonus: 500, voice: 70,
    boss: true, bossTitle: 'FRIDGEZILLA DEFROSTED', bossDiscovery: 'brain_freeze',
    bossBanner: 'FRIDGEZILLA', bossBlurb: 'serve chilled. serves you chilled.',
    hurls: { range: 470, cooldown: 3, windup: 0.6, spawn: 'fish' },
    frost: { radius: 42, interval: 4, ttl: 9 },
    slams: { radius: 110, damage: 1, cooldown: 8 },
  },
  // PIANO SPIDER: the showroom grand grew eight legs and perfect pitch. It crawls
  // the aisles fast and every landing is a sonic boom. Applaud from a distance.
  piano: {
    id: 'piano', name: 'Piano Spider', hp: 380, speed: 118, mass: 150, radius: 24, reaction: 0.6, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 6, burnFactor: 1.1,
    color: '#26232e', shade: '#121017', scoreBonus: 600, voice: 55,
    boss: true, bossTitle: 'PIANO OUT OF TUNE', bossDiscovery: 'grand_finale',
    bossBanner: 'PIANO SPIDER', bossBlurb: 'tonight: one night only. every night.',
    slams: { radius: 150, damage: 1, cooldown: 7 },
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
    id: 'mower', name: 'Mower Maniac', hp: 320, speed: 95, mass: 140, radius: 22, reaction: 0.5, awareness: 480,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 5, burnFactor: 1.2,
    lungeRange: 380, lungeSpeed: 720, lungeTime: 0.8, windup: 0.9, recover: 1,
    color: '#c23b2e', shade: '#7d241c', scoreBonus: 500, voice: 90,
    boss: true, bossTitle: 'MOWER RETIRED', bossDiscovery: 'mow_no_mo',
    bossBanner: 'LAWN MOWER MANIAC', bossBlurb: 'the grass is always greener. you are the grass.',
    tramples: true,
  },
  // MOM — THE FINAL BOSS. Armed with a slipper and zero patience. She sidesteps
  // your throws (and catches the slow ones), tidies the arena mid-fight, throws
  // shoes back, and gets strictly worse in three phases. Bedtime is non-negotiable.
  mom: {
    id: 'mom', name: 'Mom', hp: 650, speed: 95, mass: 130, radius: 24, reaction: 0.4, awareness: 560,
    impactFactor: 1, lightObjectFactor: 0.7, staggerFactor: 0.5, turnRate: 10, burnFactor: 1,
    color: '#8a3b5c', shade: '#5c2540', scoreBonus: 1500, voice: 300,
    boss: true, bossTitle: 'MOM CALMED DOWN', bossDiscovery: 'mom_says_no',
    bossBanner: 'MOM', bossBlurb: 'she found the mess. run.',
    dodges: { radius: 210, cooldown: 2.5 },
    rearranges: { cooldown: 14, count: 5 },
    hurls: { range: 500, cooldown: 3.2, windup: 0.6, spawn: 'shoe' },
    slams: { radius: 130, damage: 1, cooldown: 7 },
    phases: [
      { below: 0.66, enrage: 1.2, announce: 'GO TO YOUR ROOM' },
      {
        below: 0.33, enrage: 1.5, summon: { type: 'gnat', count: 3 },
        shockwave: { radius: 150, damage: 1 }, announce: 'NO DESSERT',
      },
    ],
  },
};
