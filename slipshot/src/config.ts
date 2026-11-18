// Central tuning values. Units: meters, seconds, kilograms, radians.

export const PHYSICS = {
  /** Fixed simulation step. 120 Hz keeps joints and fast slime bullets stable. */
  fixedDt: 1 / 120,
  /** Largest real frame time we will simulate (avoids a spiral of death). */
  maxFrameDt: 0.05,
  gravityY: -9.8,
  velocityIterations: 10,
  positionIterations: 4,
};

export const ARENA = {
  /** Shots that leave this x range are removed. */
  bounds: 40,
  /** Anything whose torso drops below this height has fallen out of the arena. */
  killY: -4,
  /** Spawn points on the two home islands (see Arena.ts). */
  playerSpawnX: -11,
  enemySpawnXs: [10.5, 13.5, 16.0],
};

/** Stamina pays for shots and jumps, and refills over time. */
export const STAMINA = {
  max: 100,
  regen: 12,
  jumpGround: 24,
  jumpAir: 34,
  /** Upward speed of a jump (m/s). Every body part gains the same speed. */
  jumpSpeed: 6.5,
};

/** Getting back on your feet after a knockdown. */
export const RECOVERY = {
  /** Stamina a player kip-up costs. */
  playerCost: 20,
  /** Upward speed of the recovery hop (m/s). */
  hopSpeed: 4.4,
  /** Maximum seconds of righting torque. The phase also ends early once the feet are back under an upright body, and it holds while airborne. */
  rightingTime: 1.0,
  /** Peak righting torque applied to the torso and pelvis (N*m). */
  rightingTorque: 60,
  /** Seconds before a downed character can try to kip up again. */
  cooldown: 1.3,
  /** Delay before an enemy's first recovery attempt. */
  enemyDelayMin: 0.55,
  enemyDelayMax: 1.15,
  /** Delay between failed enemy attempts. */
  enemyRetryMin: 0.9,
  enemyRetryMax: 1.6,
};

/** Short hit chains. Every hit on an enemy extends the chain; getting hit breaks it. */
export const COMBO = {
  /** Seconds without a hit before the chain drops. */
  window: 2.6,
  /** Highest chain count shown. */
  max: 99,
  /** Extra score per hit in the chain, as a share of a KO's base score. */
  scorePerHit: 0.1,
  /** Extra coins per hit in the chain, as a share of a KO's base coins. */
  coinPerHit: 0.04,
  /** Score multiplier cap. */
  maxScoreMultiplier: 2,
  /** Coin multiplier cap. */
  maxCoinMultiplier: 1.5,
};

/** The player's character id. Its shots pass through the player's own fortress. */
export const PLAYER_ID = 1;

/**
 * The fortress the player builds on the home island by dragging pieces into
 * place. Item stats live in game/fortressItems.ts.
 */
export const FORTRESS = {
  /** Placement snaps to this grid (metres). */
  grid: 0.25,
  /** No piece may reach above this height. */
  maxHeight: 7.5,
  /** Damage an enemy shot does to a piece, before the shot's multiplier and the piece's own damage share. */
  shotDamage: 14,
  /** Seconds a fallen piece tumbles before it is removed. */
  debrisLife: 6,
  /** Seconds between cannon shots. */
  cannonReload: 3.2,
  /** Chance an enemy picks the rubber duck as its target for a shot. */
  decoyChance: 0.5,
  /** The telescope multiplies how far the aim line reaches. */
  telescopeReach: 2,
};

export const COMBAT = {
  playerMaxHp: 100,
  enemyBaseHp: 70,
  enemyHpPerWave: 8,
  healOnWaveClear: 15,
  /** Impact speed (m/s, impulse divided by body mass) below which bumps do no damage. */
  impactThreshold: 4.2,
  impactDamagePerSpeed: 3.4,
  impactDamageCap: 26,
  impactCooldown: 0.22,
  projectileBaseDamage: 3,
  projectileDamagePerSpeed: 1.2,
  projectileDamageCap: 46,
  /** Approach speed (m/s) above which a projectile knocks a body off balance. */
  staggerSpeed: 6.5,
  headMultiplier: 1.7,
  torsoMultiplier: 1.0,
  limbMultiplier: 0.75,
};

export const SLIME = {
  projectileMass: 0.9,
  projectileRadius: 0.16,
  launchMin: 7,
  launchMax: 21,
  /** Launch speed multiplier per POWER level. */
  powerPerLevel: 0.16,
  /** Splat radius multiplier per SPLAT SIZE level. */
  splatPerLevel: 0.3,
  splatBase: 0.8,
  /** Coating and puddle time multipliers per DURATION level. */
  durationPerLevel: 0.4,
  coatBase: 3.6,
  puddleBase: 6.5,
  puddleThickness: 0.035,
  maxPuddles: 14,
  /** Friction values used when a contact involves slime. */
  puddleFriction: 0.025,
  coatFootFriction: 0.04,
  coatBodyFriction: 0.12,
  coatObjectFriction: 0.06,
  /** Seconds a gum blob stays stuck to an enemy before it fades. */
  gumLife: 6,
  /** Most gum blobs alive at once. The oldest goes first. */
  maxGums: 24,
};

export const UPGRADE_MAX_LEVEL = 5;
