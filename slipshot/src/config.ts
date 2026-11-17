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
  /** The floor spans [-halfWidth, halfWidth]. Beyond that is a pit, so a pushed body falls out. */
  halfWidth: 22,
  /** Anything whose torso drops below this height has fallen out of the arena. */
  killY: -4,
  playerSpawnX: -9.5,
  enemySpawnXs: [9.5, 12.5, 15.5],
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
};

export const UPGRADE_MAX_LEVEL = 5;
