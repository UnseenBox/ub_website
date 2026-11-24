// Global tuning values. Gameplay balance lives in src/data/*; this file holds
// screen layout, perspective, and economy/bunker baselines.

export const VIEW = {
  width: 1280,
  height: 720,
  /** Top edge of the bottom HUD panel. Everything above is battlefield. */
  hudTop: 590,
  /** Screen Y of the horizon line. */
  horizonY: 248,
  centerX: 640,
  /** Pinhole focal length in pixels. */
  focal: 950,
  /** Eye height above the ground in metres. */
  camHeight: 1.6,
  /** Top edge of the sandbag parapet; shots below it hit the wall. */
  wallTop: 522,
} as const;

/**
 * The bunker window: the opening between the concrete jambs, painted in EnvironmentArt's
 * frame. Its left jamb runs from (topX, topY) down to (bottomX, bottom of the screen); the
 * right jamb mirrors it. Zombies are kept inside this opening.
 */
export const WINDOW = { topX: 70, topY: 26, bottomX: 112 } as const;

export const FIELD = {
  /** Distance (m) where enemies spawn, inside the fog. */
  spawnZ: 95,
  /** Distance (m) of the bunker line where enemies stop and attack. */
  attackZ: 4.3,
  /** Lateral spread (m, +/-) at spawn. */
  spawnHalfWidth: 46,
  /** Lateral spread (m, +/-) at the bunker line: kept inside the window (see windowHalfWidth). */
  attackHalfWidth: 2.1,
  /** Furthest distance the ground math will report. */
  maxZ: 400,
} as const;

/** Rig art is drawn at this scale: pixels per metre at scale 1. */
export const REF_PX_PER_M = 222;

export const ECONOMY = {
  startingCash: 500,
  waveBonusBase: 200,
  waveBonusPerWave: 75,
} as const;

export const BUNKER = {
  maxHealth: 1000,
  criticalFraction: 0.25,
} as const;

export const WAVE_TIMING = {
  /** Seconds of countdown before a wave starts spawning. */
  countdown: 4,
} as const;
