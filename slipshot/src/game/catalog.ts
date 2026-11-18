// Weapon and upgrade catalog. Balance and look live here: prices, reloads,
// shot shapes and behaviours, launcher designs, and upgrade steps.

/** How a projectile is drawn. Each look has its own silhouette in shotArt.ts. */
export type ShotLook =
  | 'orb'
  | 'mass'
  | 'drop'
  | 'balloon'
  | 'spiky'
  | 'streak'
  | 'ring'
  | 'cracked'
  | 'seeker'
  | 'boomerang'
  | 'bomb'
  | 'cluster';

/** How a launcher is drawn in the player's hand. */
export type LauncherKind =
  | 'hand'
  | 'fork'
  | 'twin'
  | 'tube'
  | 'bulb'
  | 'nozzle'
  | 'scope'
  | 'mortar'
  | 'bow'
  | 'emitter'
  | 'tank'
  | 'barrel'
  | 'bundle';

export interface LauncherSpec {
  kind: LauncherKind;
  /** Length of the launcher in metres, from the hand forward. */
  length: number;
  /** Thickness in metres. */
  width: number;
  color: string;
  accent: string;
}

export interface ExplodeSpec {
  radius: number;
  /** Peak radial impulse on a character (N*s). Falls off with distance. */
  impulse: number;
  /** Peak damage at the centre. Falls off with distance. */
  damage: number;
  /** Mini shots released when it explodes (cluster bombs). */
  clusterCount: number;
  clusterShot: ShotSpec | null;
}

export interface WellSpec {
  /** Seconds the well lasts. */
  time: number;
  radius: number;
  /** Pull strength scale. */
  strength: number;
}

/** How one slime projectile behaves. Every weapon is built from these. */
export interface ShotSpec {
  look: ShotLook;
  radius: number;
  mass: number;
  restitution: number;
  /** Air drag (linear damping). */
  drag: number;
  /** Multiplies damage dealt when this shot hits a character. */
  damageMul: number;
  /** Multiplies the splat radius (coating radius and drops). */
  splatMul: number;
  /** Extra multiplier on the puddle radius when it lands on terrain. */
  puddleMul: number;
  /** Extra multiplier on puddle lifetime. */
  puddleLifeMul: number;
  /** Terrain and object bounces before it splats. */
  bounces: number;
  /** Seconds a hit character keeps dripping slime damage. */
  dripTime: number;
  /** Drip damage per second. */
  dripDps: number;
  /** Mini blobs released on the first impact. */
  splitCount: number;
  /** Fraction of gravity countered while lift lasts (balloons, boomerangs). */
  lift: number;
  liftTime: number;
  /** Steering rate toward the nearest enemy, 0 for none. */
  homing: number;
  /** Seconds of flight before it turns back to the thrower (0 for none). */
  boomerang: number;
  /** Passes through characters, hitting each one once. */
  pierce: boolean;
  /** Seconds until it explodes on its own (0 for none). */
  fuse: number;
  /** Explodes on impact or when the fuse runs out. */
  explode: ExplodeSpec | null;
  /** Leaves a gravity well where it lands. */
  well: WellSpec | null;
  /** Puddle friction for glue. 0 makes a normal slime puddle. */
  glue: number;
  color: string;
}

export type WeaponId =
  | 'hands'
  | 'spray'
  | 'squirt'
  | 'heavy'
  | 'balloon'
  | 'clinger'
  | 'sniper'
  | 'glue'
  | 'bouncer'
  | 'splitter'
  | 'seeker'
  | 'boomerang'
  | 'grenade'
  | 'cluster'
  | 'well'
  | 'bomb'
  | 'cannon';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** One short line. */
  blurb: string;
  /** One or two words shown as a badge on the card. */
  badge: string;
  /** Signature colour, used for the card, HUD and projectile. */
  color: string;
  /** Coins to buy. 0 means owned from the start. */
  price: number;
  /** Seconds between trigger pulls. */
  cooldown: number;
  /** Projectiles per trigger pull. */
  shots: number;
  /** Angle between neighbouring projectiles of one pull (radians). */
  spread: number;
  /** Launch speed multiplier. */
  speedMul: number;
  shot: ShotSpec;
  launcher: LauncherSpec;
}

const BASE_SHOT: ShotSpec = {
  look: 'orb',
  radius: 0.16,
  mass: 0.9,
  restitution: 0.15,
  drag: 0.03,
  damageMul: 1,
  splatMul: 1,
  puddleMul: 1,
  puddleLifeMul: 1,
  bounces: 0,
  dripTime: 0,
  dripDps: 0,
  splitCount: 0,
  lift: 0,
  liftTime: 0,
  homing: 0,
  boomerang: 0,
  pierce: false,
  fuse: 0,
  explode: null,
  well: null,
  glue: 0,
  color: '#8dff5a',
};

/** A small timed blast, released by cluster bombs. */
export const CLUSTER_CHILD: ShotSpec = {
  ...BASE_SHOT,
  look: 'bomb',
  radius: 0.12,
  mass: 0.5,
  restitution: 0.2,
  damageMul: 0.2,
  fuse: 0.45,
  explode: { radius: 1.3, impulse: 60, damage: 11, clusterCount: 0, clusterShot: null },
  color: '#ff9a7a',
};

/** Mini blobs released by the Splitter. They never split again. */
export const CHILD_SHOT: ShotSpec = {
  ...BASE_SHOT,
  radius: 0.08,
  mass: 0.2,
  restitution: 0.3,
  damageMul: 0.45,
  splatMul: 0.5,
  puddleMul: 0.5,
};

function shot(over: Partial<ShotSpec>): ShotSpec {
  return { ...BASE_SHOT, ...over };
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'hands',
    name: 'Bare Hands',
    blurb: 'Squeeze a blob, wind up, throw.',
    badge: 'Starter',
    color: '#8dff5a',
    price: 0,
    cooldown: 0.42,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'orb', color: '#8dff5a' }),
    // No launcher: the blob sits in the palm and the arm throws it.
    launcher: { kind: 'hand', length: 0, width: 0, color: '#8dff5a', accent: '#4fbf2a' },
  },
  {
    id: 'spray',
    name: 'Triple Spray',
    blurb: 'Three blobs in a fan.',
    badge: '3 shots',
    color: '#5ef2c2',
    price: 80,
    cooldown: 0.8,
    shots: 3,
    spread: 0.12,
    speedMul: 0.95,
    shot: shot({ look: 'orb', radius: 0.11, mass: 0.45, damageMul: 0.6, splatMul: 0.7, color: '#5ef2c2' }),
    launcher: { kind: 'nozzle', length: 0.6, width: 0.28, color: '#3fb89a', accent: '#1f6d5c' },
  },
  {
    id: 'squirt',
    name: 'Rapid Squirt',
    blurb: 'Fast, light, relentless.',
    badge: 'Rapid',
    color: '#b6ff8a',
    price: 90,
    cooldown: 0.22,
    shots: 1,
    spread: 0,
    speedMul: 1.15,
    shot: shot({ look: 'drop', radius: 0.1, mass: 0.3, restitution: 0.1, damageMul: 0.45, splatMul: 0.6, color: '#b6ff8a' }),
    launcher: { kind: 'bulb', length: 0.5, width: 0.22, color: '#d8ff9e', accent: '#6fb53a' },
  },
  {
    id: 'heavy',
    name: 'Heavy Glob',
    blurb: 'Slow, huge, knocks flat.',
    badge: 'Knockback',
    color: '#3fd16b',
    price: 120,
    cooldown: 1.3,
    shots: 1,
    spread: 0,
    speedMul: 0.8,
    shot: shot({ look: 'mass', radius: 0.3, mass: 3.2, restitution: 0.05, damageMul: 1.9, splatMul: 1.3, puddleMul: 1.2, color: '#3fd16b' }),
    launcher: { kind: 'barrel', length: 0.8, width: 0.36, color: '#2f8f57', accent: '#1b5a36' },
  },
  {
    id: 'balloon',
    name: 'Balloon Glob',
    blurb: 'Floats, then drops.',
    badge: 'Floats',
    color: '#ffd1f0',
    price: 130,
    cooldown: 1.0,
    shots: 1,
    spread: 0,
    speedMul: 0.9,
    shot: shot({ look: 'balloon', radius: 0.2, mass: 0.6, restitution: 0.2, drag: 0.15, damageMul: 0.7, lift: 0.92, liftTime: 2.4, color: '#ffd1f0' }),
    launcher: { kind: 'bundle', length: 0.5, width: 0.3, color: '#ffd1f0', accent: '#ff7fcc' },
  },
  {
    id: 'clinger',
    name: 'Clinger',
    blurb: 'Sticks and drips.',
    badge: 'Drips',
    color: '#ff7ad9',
    price: 140,
    cooldown: 0.9,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'spiky', restitution: 0.05, damageMul: 0.8, dripTime: 4, dripDps: 3.2, color: '#ff7ad9' }),
    launcher: { kind: 'tube', length: 0.6, width: 0.16, color: '#b64b9c', accent: '#6b2a5e' },
  },
  {
    id: 'sniper',
    name: 'Sniper Glob',
    blurb: 'Thin, fast, precise.',
    badge: 'Precise',
    color: '#c8ff3d',
    price: 150,
    cooldown: 1.5,
    shots: 1,
    spread: 0,
    speedMul: 1.6,
    shot: shot({ look: 'streak', radius: 0.12, mass: 0.6, restitution: 0.02, drag: 0, damageMul: 2.2, splatMul: 0.5, color: '#c8ff3d' }),
    launcher: { kind: 'scope', length: 1.0, width: 0.13, color: '#2a3450', accent: '#c8ff3d' },
  },
  {
    id: 'glue',
    name: 'Glue Trap',
    blurb: 'Puddles that grip.',
    badge: 'Sticky',
    color: '#ffc65c',
    price: 150,
    cooldown: 1.1,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'drop', puddleMul: 1.3, damageMul: 0.3, glue: 2.6, color: '#ffc65c' }),
    launcher: { kind: 'tank', length: 0.55, width: 0.2, color: '#e09a2a', accent: '#8a5a18' },
  },
  {
    id: 'bouncer',
    name: 'Bouncer',
    blurb: 'Bounces off floors and crates.',
    badge: 'Bounce ×4',
    color: '#f5ff6b',
    price: 110,
    cooldown: 0.7,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'ring', radius: 0.17, mass: 0.8, restitution: 0.82, damageMul: 0.9, splatMul: 0.9, bounces: 4, color: '#f5ff6b' }),
    launcher: { kind: 'emitter', length: 0.5, width: 0.2, color: '#e5ef4a', accent: '#8f9a1a' },
  },
  {
    id: 'splitter',
    name: 'Splitter',
    blurb: 'Bursts into four blobs.',
    badge: 'Split ×4',
    color: '#6ee7ff',
    price: 160,
    cooldown: 0.9,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'cracked', restitution: 0.1, damageMul: 0.8, splitCount: 4, color: '#6ee7ff' }),
    launcher: { kind: 'twin', length: 0.7, width: 0.16, color: '#6ee7ff', accent: '#2aa9d0' },
  },
  {
    id: 'seeker',
    name: 'Seeker',
    blurb: 'Curves toward enemies.',
    badge: 'Homing',
    color: '#ff9f5a',
    price: 190,
    cooldown: 1.0,
    shots: 1,
    spread: 0,
    speedMul: 0.9,
    shot: shot({ look: 'seeker', radius: 0.15, mass: 0.7, damageMul: 0.9, homing: 9, color: '#ff9f5a' }),
    launcher: { kind: 'scope', length: 0.7, width: 0.14, color: '#7a3a2a', accent: '#ff9f5a' },
  },
  {
    id: 'boomerang',
    name: 'Boomerang',
    blurb: 'Returns, hitting all it passes.',
    badge: 'Returns',
    color: '#9bffea',
    price: 170,
    cooldown: 1.2,
    shots: 1,
    spread: 0,
    speedMul: 1.1,
    shot: shot({ look: 'boomerang', radius: 0.16, mass: 0.7, restitution: 0.3, damageMul: 0.7, bounces: 99, pierce: true, boomerang: 0.9, lift: 0.8, liftTime: 3, color: '#9bffea' }),
    launcher: { kind: 'bow', length: 0.8, width: 0.12, color: '#5ec9b1', accent: '#2a7d6e' },
  },
  {
    id: 'grenade',
    name: 'Fuse Grenade',
    blurb: 'Explodes on impact or fuse.',
    badge: 'Blast',
    color: '#ffb04a',
    price: 175,
    cooldown: 1.1,
    shots: 1,
    spread: 0,
    speedMul: 0.85,
    shot: shot({
      look: 'bomb',
      radius: 0.19,
      mass: 1.0,
      restitution: 0.2,
      damageMul: 0.3,
      fuse: 1.4,
      explode: { radius: 2.4, impulse: 110, damage: 26, clusterCount: 0, clusterShot: null },
      color: '#ffb04a',
    }),
    launcher: { kind: 'mortar', length: 0.55, width: 0.3, color: '#5a4636', accent: '#ffb04a' },
  },
  {
    id: 'cluster',
    name: 'Cluster Bomb',
    blurb: 'Scatters five bomblets.',
    badge: 'Cluster',
    color: '#ff7a7a',
    price: 230,
    cooldown: 1.6,
    shots: 1,
    spread: 0,
    speedMul: 0.9,
    shot: shot({
      look: 'cluster',
      radius: 0.2,
      mass: 1.2,
      restitution: 0.2,
      damageMul: 0.2,
      fuse: 1.2,
      explode: { radius: 1.8, impulse: 90, damage: 12, clusterCount: 5, clusterShot: CLUSTER_CHILD },
      color: '#ff7a7a',
    }),
    launcher: { kind: 'mortar', length: 0.7, width: 0.36, color: '#6a3f3f', accent: '#ff7a7a' },
  },
  {
    id: 'well',
    name: 'Gravity Well',
    blurb: 'Pulls bodies in.',
    badge: 'Gravity',
    color: '#b47aff',
    price: 240,
    cooldown: 1.8,
    shots: 1,
    spread: 0,
    speedMul: 0.9,
    shot: shot({ look: 'orb', radius: 0.2, mass: 1.0, restitution: 0.05, damageMul: 0.2, well: { time: 3.2, radius: 3.4, strength: 60 }, color: '#b47aff' }),
    launcher: { kind: 'emitter', length: 0.5, width: 0.26, color: '#7a4fd6', accent: '#d7c2ff' },
  },
  {
    id: 'bomb',
    name: 'Puddle Bomb',
    blurb: 'Huge, lasting puddles.',
    badge: 'Big puddle',
    color: '#ffb36b',
    price: 180,
    cooldown: 1.4,
    shots: 1,
    spread: 0,
    speedMul: 1,
    shot: shot({ look: 'drop', radius: 0.2, mass: 1.2, restitution: 0.05, damageMul: 0.6, puddleMul: 2.2, puddleLifeMul: 1.6, color: '#ffb36b' }),
    launcher: { kind: 'barrel', length: 0.45, width: 0.34, color: '#d9824a', accent: '#7a3f1c' },
  },
  {
    id: 'cannon',
    name: 'Slime Cannon',
    blurb: 'Heavy blob, wide splat.',
    badge: 'Heavy',
    color: '#c49bff',
    price: 200,
    cooldown: 1.7,
    shots: 1,
    spread: 0,
    speedMul: 1.35,
    shot: shot({ look: 'orb', radius: 0.22, mass: 2.2, restitution: 0.1, damageMul: 1.4, splatMul: 1.5, puddleMul: 1.3, color: '#c49bff' }),
    launcher: { kind: 'barrel', length: 0.9, width: 0.34, color: '#7b5ab8', accent: '#c49bff' },
  },
];

/** The enemies' launcher. */
export const ENEMY_LAUNCHER: LauncherSpec = { kind: 'tube', length: 0.6, width: 0.16, color: '#7a4a4a', accent: '#c77dff' };

export function weaponById(id: WeaponId): WeaponDef {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown weapon ${id}`);
  return w;
}

export type UpgradeId =
  | 'power'
  | 'splat'
  | 'duration'
  | 'maxHp'
  | 'armor'
  | 'reload'
  | 'grip'
  | 'iron'
  | 'bounty';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Short description of one level. */
  blurb: string;
  /** Price of the first level. */
  basePrice: number;
  /** Extra price per level already owned. */
  priceStep: number;
}

/** Each upgrade can be bought up to UPGRADE_LEVEL_CAP times. */
export const UPGRADES: UpgradeDef[] = [
  { id: 'power', name: 'Launch Power', blurb: '+16% speed', basePrice: 40, priceStep: 30 },
  { id: 'splat', name: 'Splat Radius', blurb: '+30% radius', basePrice: 40, priceStep: 30 },
  { id: 'duration', name: 'Slime Duration', blurb: '+40% time', basePrice: 45, priceStep: 30 },
  { id: 'maxHp', name: 'Max Health', blurb: '+20 health', basePrice: 50, priceStep: 30 },
  { id: 'armor', name: 'Armor', blurb: '-8% damage taken', basePrice: 55, priceStep: 35 },
  { id: 'reload', name: 'Quick Reload', blurb: '-8% cooldowns', basePrice: 50, priceStep: 35 },
  { id: 'grip', name: 'Grip Boots', blurb: '16% less slip', basePrice: 60, priceStep: 35 },
  { id: 'iron', name: 'Iron Stance', blurb: '-12% stagger', basePrice: 50, priceStep: 30 },
  { id: 'bounty', name: 'Bounty', blurb: '+25% coins', basePrice: 70, priceStep: 40 },
];

export const UPGRADE_LEVEL_CAP = 5;

/** Instant heal, bought between waves. Can be bought any number of times. */
export const REPAIR_KIT = { price: 45, heal: 35 };

export function upgradeById(id: UpgradeId): UpgradeDef {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown upgrade ${id}`);
  return u;
}

/** Price of the next level of an upgrade, given the levels already owned. */
export function upgradePrice(def: UpgradeDef, level: number): number {
  return def.basePrice + def.priceStep * level;
}
