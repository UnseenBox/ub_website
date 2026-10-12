export type EnemyTypeId =
  | 'basic' | 'fast' | 'heavy' | 'helmet' | 'shield' | 'electric'
  | 'fragile' | 'nested' | 'mini' | 'kaboom' | 'trolley' | 'boss'
  | 'gnat' | 'hurler' | 'bulwark' | 'hoover' | 'sofa';

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
}

/** Throwing furniture back: grabs a loose object and hurls it at the player. */
export interface HurlSpec {
  /** How far away the player may be to start a throw. */
  readonly range: number;
  /** Seconds between throws. */
  readonly cooldown: number;
  /** Aim telegraph before release. */
  readonly windup: number;
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
  // The Landlord: one per every third room. Slow, enormous, barely staggers, and worth a fortune.
  boss: {
    id: 'boss', name: 'Landlord', hp: 550, speed: 54, mass: 160, radius: 26, reaction: 0.9, awareness: 520,
    impactFactor: 1, lightObjectFactor: 0.3, staggerFactor: 0.3, turnRate: 4, burnFactor: 0.8,
    lungeRange: 130, lungeSpeed: 380, windup: 0.7, recover: 1, onDefeat: 'split',
    color: '#6b4d86', shade: '#4a3560', scoreBonus: 800, voice: 70,
    boss: true, bossTitle: 'LANDLORD EVICTED', bossDiscovery: 'boss_evicted',
    bossBanner: 'THE LANDLORD', bossBlurb: 'eviction day — bring the whole room',
    slams: { radius: 135, damage: 1, cooldown: 9 },
    phases: [
      {
        below: 0.66, enrage: 1.3, summon: { type: 'mini', count: 2 },
        announce: 'EVICTION NOTICE',
      },
      {
        below: 0.33, enrage: 1.6, summon: { type: 'mini', count: 2 },
        shockwave: { radius: 150, damage: 1 }, announce: 'EVERYONE OUT',
      },
    ],
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
  // THE HOOVER: a possessed vacuum that eats the room. Feed it something explosive.
  hoover: {
    id: 'hoover', name: 'Hoover', hp: 260, speed: 66, mass: 120, radius: 22, reaction: 0.7, awareness: 460,
    impactFactor: 1, lightObjectFactor: 0.6, staggerFactor: 0.5, turnRate: 5, burnFactor: 1,
    color: '#c23b4e', shade: '#8e2a38', scoreBonus: 400, voice: 85,
    boss: true, bossTitle: 'HOOVER UNPLUGGED', bossDiscovery: 'unplugged',
    bossBanner: 'THE HOOVER', bossBlurb: 'it eats furniture. do not be furniture.',
    sucks: { radius: 230, pull: 950 },
    phases: [
      { below: 0.5, enrage: 1.4, announce: 'IT CHOKES. IT HUNGERS.' },
    ],
  },
  // THE SOFA KING: the showroom got up and walked. Hates fire. Sits on you given half a chance.
  sofa: {
    id: 'sofa', name: 'Sofa King', hp: 360, speed: 58, mass: 150, radius: 24, reaction: 0.8, awareness: 420,
    impactFactor: 1, lightObjectFactor: 0.5, staggerFactor: 0.45, turnRate: 4, burnFactor: 2,
    color: '#7a5a9e', shade: '#54406e', scoreBonus: 600, voice: 60,
    boss: true, bossTitle: 'SOFA REUPHOLSTERED', bossDiscovery: 'reupholstered',
    bossBanner: 'THE SOFA KING', bossBlurb: 'it has chosen comfort. violently.',
    slams: { radius: 115, damage: 1, cooldown: 6.5 },
    phases: [
      {
        below: 0.5, enrage: 1.35, summon: { type: 'mini', count: 2 },
        announce: 'IT CALLS ITS CUSHIONS',
      },
    ],
  },
};
