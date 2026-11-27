// Weapon catalogue. Every combat value the WeaponManager / CombatSystem uses is
// read from here, so new guns are added by appending a definition.

export type FireMode = 'semi' | 'auto';
export type WeaponKind = 'hitscan' | 'grenade' | 'flame';

/**
 * Placement and motion for a first-person view-model texture. Points are in
 * texture pixels; the origin for `muzzle`/`eject` is the texture's top-left.
 * Only the M1A needs an override today; the procedural guns share the defaults
 * in WeaponView.
 */
export interface WeaponViewModel {
  /** Screen position of the texture's bottom-centre when the gun is at rest. */
  pivotX: number;
  pivotY: number;
  scale: number;
  muzzleX: number;
  muzzleY: number;
  ejectX: number;
  ejectY: number;
  /** How much of the aim offset the model follows (0 = fixed, 1 = fully). */
  aimX: number;
  aimY: number;
  /** Maximum rotation in radians while tracking the aim point. */
  maxRot: number;
  /**
   * Pin the muzzle to a fixed screen offset from the crosshair. The whole gun
   * translates with the aim while the stock swings around the muzzle.
   */
  muzzleLock?: boolean;
  /** Muzzle offset from the crosshair when `muzzleLock` is on (legacy fixed-offset mode). */
  muzzleLockX?: number;
  muzzleLockY?: number;
  /**
   * Barrel alignment (needs `muzzleLock`). The model is rotated so the line from
   * its `tail` point (the stock/hands, in texture pixels) through the muzzle
   * points exactly at the crosshair, and the muzzle sits `muzzleGap` px short of
   * the crosshair along that line. The line starts at the screen `anchor`
   * (the shoulder), so the gun swings around the bottom of the screen.
   */
  barrelAlign?: boolean;
  tailX?: number;
  tailY?: number;
  anchorX?: number;
  anchorY?: number;
  muzzleGap?: number;
  /** Extra rotation in radians applied to the aligned model (negative = turn left). */
  rotationTrim?: number;
  /**
   * Shift of the aligned model on screen, in pixels (+x right, +y down). Moving the
   * gun right and up makes the crosshair sit further left and lower beside the
   * muzzle, without changing where shots land.
   */
  gunShiftX?: number;
  gunShiftY?: number;
  /**
   * Screen-space nudge (px, +x right, +y down) of the muzzle flash and its glow only.
   * Lets the spark sit in the barrel's opening without moving the aim geometry.
   */
  flashOffsetX?: number;
  flashOffsetY?: number;
  /** Multiplier on idle sway (1 = normal, 0 = locked to aim). */
  sway: number;
  /** Multiplier on the reload tilt. */
  reloadTilt: number;
  /** Vertical distance the model drops during a weapon switch. */
  switchDrop: number;
}

export interface WeaponSoundConfig {
  /** Key into the synthesized sound bank (see audio/SoundBank.ts). */
  shot: string;
  reload: string;
  empty: string;
  /** Optional impact cue for projectile weapons. */
  impact?: string;
  /** Random playback-rate spread so repeated shots don't sound machine-gunned. */
  pitchJitter: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  shortName: string;
  /** Place in the classic four-gun layout (1–4 are the first guns). Battles number the loadout instead. */
  slot: number;
  price: number;
  /** Cleared-wave number that puts the weapon on sale in the armory (0 = from the start). */
  unlockAfterWave: number;
  kind: WeaponKind;
  mode: FireMode;
  damage: number;
  /** Rounds per second. */
  fireRate: number;
  magazine: number;
  /** Rounds carried in reserve when bought; Infinity = unlimited. */
  startReserve: number;
  maxReserve: number;
  /** Shop ammo pack: rounds per pack and price. */
  ammoPack: { rounds: number; price: number };
  reloadTime: number;
  /** Visual kick strength (px of gun travel) and crosshair bloom added per shot. */
  recoil: number;
  bloomPerShot: number;
  /** Base spread radius in screen pixels at rest. */
  spread: number;
  maxSpread: number;
  headshotMultiplier: number;
  /** Camera shake intensity per shot (0 = none). */
  shake: number;
  /** Grenade-only: projectile flight speed (m/s), blast radius (m). */
  projectileSpeed?: number;
  blastRadius?: number;
  /** Shotgun: pellets per shot, each a hitscan inside `spread`; damage is per pellet. */
  pellets?: number;
  /** Damage falls from full at `start` metres to `min` × at `end` metres. */
  falloff?: { start: number; end: number; min: number };
  /** Hitscan: the round goes on through this many bodies in a line. */
  pierce?: number;
  /** Ignores body armour like armour-piercing rounds. */
  armorPiercing?: boolean;
  /** Tesla: after the first hit the bolt jumps to the nearest body within `radiusM`, losing `falloff` per jump. */
  chain?: { jumps: number; radiusM: number; falloff: number };
  /** Flame: reach in metres; `spread` is the stream's radius in pixels at the aim point. */
  flameRange?: number;
  muzzleFlash: { scale: number; tint: number };
  sound: WeaponSoundConfig;
  /** Texture key of the first-person view model and HUD icon. */
  viewTexture: string;
  iconTexture: string;
  /** Optional per-weapon placement/motion tuning for the view model. */
  viewModel?: Partial<WeaponViewModel>;
  /** Magnification while the fire button's alternate (right) button is held. Defaults to 1.35. */
  aimZoom?: number;
  /** The scope: aiming zooms the whole view, and the camera moves with the crosshair. */
  scopeZoom?: boolean;
  description: string;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'service',
    name: 'M1A Service Rifle',
    shortName: 'M1A',
    slot: 1,
    price: 0,
    unlockAfterWave: 0,
    kind: 'hitscan',
    mode: 'semi',
    damage: 38,
    fireRate: 4.5,
    magazine: 10,
    startReserve: Infinity,
    maxReserve: Infinity,
    ammoPack: { rounds: 0, price: 0 },
    reloadTime: 1.7,
    recoil: 16,
    bloomPerShot: 7,
    spread: 2,
    maxSpread: 22,
    headshotMultiplier: 3,
    shake: 0,
    muzzleFlash: { scale: 0.65, tint: 0xffd9a0 },
    sound: { shot: 'shot_service', reload: 'reload_service', empty: 'empty_light', pitchJitter: 0.04 },
    viewTexture: 'view_service_photo',
    viewModel: {
      // Full-frame 16:9 photo (rifle + hands). The barrel axis is rotated to
      // point at the crosshair and the muzzle stays 70px short of it, so the
      // gun translates and rotates with the aim as one unit.
      pivotX: 620,
      pivotY: 835,
      scale: 0.74,
      muzzleX: 430,
      muzzleY: 8,
      ejectX: 820,
      ejectY: 250,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.28,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      // The rifle in the photo runs from the stock (bottom right) to the front
      // sight (top left); that axis is what lines up with the crosshair.
      barrelAlign: true,
      tailX: 880,
      tailY: 720,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      // The photo looked twisted to the right at rest; turn it a good way back to the
      // left (about 32 degrees), so it sits close to the picture's own upright pose.
      rotationTrim: -0.56,
      // Crosshair a little further left and lower relative to the muzzle.
      gunShiftX: 55,
      gunShiftY: -70,
      // Move the spark down onto the barrel's opening (it was sitting above the tip).
      flashOffsetX: 0,
      flashOffsetY: 24,
    },
    iconTexture: 'icon_service',
    description: 'Semi-automatic battle rifle. Accurate, punchy, unlimited ammo. Click per shot.',
  },
  {
    id: 'm4',
    name: 'M4 Carbine',
    shortName: 'M4',
    slot: 2,
    price: 1100,
    unlockAfterWave: 1,
    kind: 'hitscan',
    mode: 'auto',
    damage: 30,
    fireRate: 11,
    magazine: 30,
    startReserve: 180,
    maxReserve: 360,
    ammoPack: { rounds: 90, price: 120 },
    reloadTime: 2.0,
    recoil: 7,
    bloomPerShot: 2.6,
    spread: 3,
    maxSpread: 26,
    headshotMultiplier: 2.6,
    shake: 0,
    muzzleFlash: { scale: 0.75, tint: 0xffe2b0 },
    sound: { shot: 'shot_m4', reload: 'reload_m4', empty: 'empty_light', pitchJitter: 0.05 },
    // Supplied photo of the carbine (1280×853, transparent background). The barrel
    // axis is aligned to the crosshair the same way as the M1A.
    viewTexture: 'view_m4_photo',
    viewModel: {
      pivotX: 620,
      pivotY: 835,
      scale: 0.74,
      // Muzzle = the barrel opening (front face of the flash hider), and the stock end of
      // the bore line, in photo pixels.
      muzzleX: 368,
      muzzleY: 84,
      ejectX: 760,
      ejectY: 330,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.28,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      barrelAlign: true,
      tailX: 1150,
      tailY: 560,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      // Turns the photo back upright (its own pose, leaning left) instead of leaning right.
      rotationTrim: -1.024,
      gunShiftX: 55,
      gunShiftY: -40,
      // The muzzle is now the opening itself, so the spark needs no extra nudge.
      flashOffsetX: 0,
      flashOffsetY: 0,
    },
    iconTexture: 'icon_m4',
    description: 'Full-auto carbine with red-dot optic. Fast, controllable, the backbone upgrade.',
  },
  {
    id: 'm249',
    name: 'M249 SAW',
    shortName: 'M249',
    slot: 3,
    price: 3200,
    unlockAfterWave: 3,
    kind: 'hitscan',
    mode: 'auto',
    damage: 40,
    fireRate: 13,
    magazine: 100,
    startReserve: 300,
    maxReserve: 600,
    ammoPack: { rounds: 100, price: 220 },
    reloadTime: 4.4,
    recoil: 11,
    bloomPerShot: 3.4,
    spread: 6,
    maxSpread: 40,
    headshotMultiplier: 2.2,
    shake: 0.0016,
    muzzleFlash: { scale: 1.05, tint: 0xffc98a },
    sound: { shot: 'shot_m249', reload: 'reload_m249', empty: 'empty_heavy', pitchJitter: 0.035 },
    // Supplied photo of the belt-fed machine gun (1280×853, transparent background),
    // aligned to the crosshair like the M4 and M1A.
    viewTexture: 'view_m249_photo',
    viewModel: {
      pivotX: 620,
      pivotY: 835,
      scale: 0.58,
      // Muzzle = the barrel opening at the front of the flash hider, and the stock end
      // of the bore line, in photo pixels.
      muzzleX: 332,
      muzzleY: 92,
      // Middle of the receiver's right side (where the shells leave the gun).
      ejectX: 812,
      ejectY: 304,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.28,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      barrelAlign: true,
      tailX: 1230,
      tailY: 620,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      // Turns the photo back upright (its own pose) so it doesn't lean right.
      rotationTrim: -1.0393,
      gunShiftX: 55,
      gunShiftY: -40,
      flashOffsetX: 0,
      flashOffsetY: 0,
    },
    iconTexture: 'icon_m249',
    description: 'Belt-fed light machine gun. Huge sustained output, heavy recoil, expensive ammo.',
  },
  {
    id: 'm32',
    name: 'M32 Grenade Launcher',
    shortName: 'M32',
    slot: 4,
    price: 4000,
    unlockAfterWave: 5,
    kind: 'grenade',
    mode: 'semi',
    damage: 260,
    fireRate: 1.4,
    magazine: 6,
    startReserve: 18,
    maxReserve: 36,
    ammoPack: { rounds: 6, price: 300 },
    reloadTime: 3.6,
    recoil: 26,
    bloomPerShot: 0,
    spread: 0,
    maxSpread: 0,
    headshotMultiplier: 1,
    shake: 0.004,
    // Metres per second: a shot at the far field lands in about half a second.
    projectileSpeed: 120,
    blastRadius: 6,
    muzzleFlash: { scale: 1.2, tint: 0xffb070 },
    sound: { shot: 'shot_m32', reload: 'reload_m32', empty: 'empty_heavy', impact: 'rocket_impact', pitchJitter: 0.03 },
    // Supplied photo of the grenade launcher (1280×853, transparent background),
    // aligned to the crosshair like the other photo guns.
    viewTexture: 'view_m32_photo',
    viewModel: {
      pivotX: 620,
      pivotY: 835,
      scale: 0.74,
      // Muzzle = the front of the launcher tube, and the stock end of the bore line,
      // in photo pixels.
      muzzleX: 368,
      muzzleY: 96,
      ejectX: 800,
      ejectY: 330,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.28,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      barrelAlign: true,
      tailX: 1180,
      tailY: 470,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      // Turns the photo back upright (its own pose) so it doesn't lean right.
      rotationTrim: -1.1392,
      gunShiftX: 55,
      gunShiftY: -40,
      flashOffsetX: 0,
      flashOffsetY: 0,
    },
    iconTexture: 'icon_m32',
    description: '40mm six-shot revolver launcher. Lobbed high-explosive rounds shred packed groups.',
  },
  {
    id: 'shotgun',
    name: 'M590 Pump Shotgun',
    shortName: 'M590',
    slot: 5,
    price: 1400,
    unlockAfterWave: 99,
    kind: 'hitscan',
    mode: 'semi',
    // Per pellet: a close blast of all nine pellets is 9 × 26 = 234 damage.
    damage: 26,
    pellets: 9,
    falloff: { start: 9, end: 40, min: 0.25 },
    fireRate: 1.25,
    magazine: 6,
    startReserve: 36,
    maxReserve: 72,
    ammoPack: { rounds: 12, price: 90 },
    reloadTime: 2.8,
    recoil: 30,
    bloomPerShot: 6,
    spread: 30,
    maxSpread: 44,
    headshotMultiplier: 1.6,
    shake: 0.003,
    muzzleFlash: { scale: 1.25, tint: 0xffc890 },
    sound: { shot: 'shot_shotgun', reload: 'reload_shotgun', empty: 'empty_heavy', pitchJitter: 0.04 },
    // Supplied photo of the pump shotgun (1280 wide, transparent background), aligned to the
    // crosshair the same way as the other photographed guns.
    viewTexture: 'view_shotgun_photo',
    viewModel: {
      pivotX: 620,
      pivotY: 780,
      scale: 0.74,
      // Muzzle = the barrel tip, and the ejection port on the receiver, in photo pixels.
      muzzleX: 420,
      muzzleY: 22,
      ejectX: 790,
      ejectY: 290,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.28,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      barrelAlign: true,
      tailX: 800,
      tailY: 330,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      gunShiftX: 55,
      gunShiftY: -40,
      flashOffsetX: 0,
      flashOffsetY: 0,
      rotationTrim: -0.8897,
    },
    iconTexture: 'icon_shotgun',
    description: 'Pump-action 12 gauge. A wall of pellets that stops anything at the wire. Weak at range.',
  },
  {
    id: 'm82',
    name: 'M82 .50 Rifle',
    shortName: 'M82',
    slot: 6,
    price: 3600,
    unlockAfterWave: 99,
    kind: 'hitscan',
    mode: 'semi',
    damage: 300,
    pierce: 3,
    armorPiercing: true,
    fireRate: 0.9,
    magazine: 5,
    startReserve: 30,
    maxReserve: 60,
    ammoPack: { rounds: 10, price: 160 },
    reloadTime: 3.2,
    recoil: 40,
    bloomPerShot: 18,
    spread: 1,
    maxSpread: 30,
    headshotMultiplier: 1.8,
    shake: 0.006,
    muzzleFlash: { scale: 1.3, tint: 0xffd090 },
    sound: { shot: 'shot_m82', reload: 'reload_m32', empty: 'empty_heavy', pitchJitter: 0.02 },
    viewTexture: 'view_m82_photo',
    viewModel: {
      pivotX: 700,
      pivotY: 800,
      scale: 0.74,
      // Muzzle = the muzzle brake's opening, and the ejection port on the receiver, in photo pixels.
      muzzleX: 340,
      muzzleY: 148,
      ejectX: 775,
      ejectY: 433,
      maxRot: 0.4,
      sway: 0,
      reloadTilt: 0.3,
      switchDrop: 840,
      muzzleLock: true,
      muzzleLockX: 0,
      muzzleLockY: 80,
      barrelAlign: true,
      tailX: 1242,
      tailY: 667,
      anchorX: 640,
      anchorY: 8000,
      aimX: 0.36,
      aimY: 0.06,
      muzzleGap: 70,
      gunShiftX: 55,
      gunShiftY: -40,
      flashOffsetX: 0,
      flashOffsetY: 0,
      rotationTrim: -1.0487,
    },
    // The scope: magnified about the aim point, seen through a lens.
    aimZoom: 2.6,
    scopeZoom: true,
    iconTexture: 'icon_m82',
    description: 'Anti-materiel rifle. One round goes through armour and up to three bodies in a line. Slow.',
  },
];

WEAPONS.push({
  id: 'tesla',
  name: 'TC-3 Tesla Gun',
  shortName: 'TESLA',
  slot: 11,
  price: 5200,
  unlockAfterWave: 99,
  kind: 'hitscan',
  mode: 'semi',
  // The bolt hits its target, then arcs to four more nearby, losing a quarter each jump.
  damage: 95,
  chain: { jumps: 4, radiusM: 6, falloff: 0.75 },
  fireRate: 2.4,
  magazine: 12,
  startReserve: 72,
  maxReserve: 144,
  ammoPack: { rounds: 24, price: 200 },
  reloadTime: 2.4,
  recoil: 12,
  bloomPerShot: 6,
  spread: 2,
  maxSpread: 26,
  headshotMultiplier: 1.5,
  shake: 0.002,
  muzzleFlash: { scale: 1.1, tint: 0x90d0ff },
  sound: { shot: 'shot_tesla', reload: 'reload_m249', empty: 'empty_heavy', pitchJitter: 0.06 },
  // Supplied photo of the tesla gun (1280 wide, transparent background), aligned to the crosshair.
  viewTexture: 'view_tesla_photo',
  viewModel: {
    pivotX: 700,
    pivotY: 800,
    scale: 0.74,
    // Muzzle = the front of the coil barrel, and the coil's side, in photo pixels.
    muzzleX: 221,
    muzzleY: 79,
    ejectX: 850,
    ejectY: 400,
    maxRot: 0.4,
    sway: 0,
    reloadTilt: 0.28,
    switchDrop: 840,
    muzzleLock: true,
    muzzleLockX: 0,
    muzzleLockY: 80,
    barrelAlign: true,
    tailX: 1000,
    tailY: 733,
    anchorX: 640,
    anchorY: 8000,
    aimX: 0.36,
    aimY: 0.06,
    muzzleGap: 70,
    gunShiftX: 55,
    gunShiftY: -40,
    flashOffsetX: 0,
    flashOffsetY: 0,
    rotationTrim: -0.8724,
  },
  iconTexture: 'icon_tesla',
  description: 'Chain lightning. Each bolt jumps from its target to four more of the dead nearby.',
});

/** Mounted guns: lent by one mission, never owned, never in a loadout. */
export const MOUNTED_WEAPONS: string[] = [];


/** Display order for loadouts and the HUD: lightest to heaviest. */
export const WEAPON_ORDER = ['service', 'm4', 'shotgun', 'tesla', 'm249', 'm82', 'm32'];

export function weaponById(id: string): WeaponDef {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown weapon ${id}`);
  return w;
}

export function weaponBySlot(slot: number): WeaponDef | undefined {
  return WEAPONS.find((w) => w.slot === slot);
}
