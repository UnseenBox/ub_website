/**
 * Every number that decides how the game *feels* lives here. The awareness model
 * is a weighted sum, so balancing is a matter of editing this file rather than
 * hunting through systems.
 */

/** Logical design resolution. All gameplay coordinates are in these units. */
export const VIEW = {
  width: 960,
  height: 540,
} as const;

export const PLAYER = {
  radius: 9,
  walkSpeed: 132,
  sneakSpeed: 58,
  panicSpeed: 150,
  accel: 14,
  /** How far the character's hands reach for an interaction. */
  reach: 46,
  /** Noise the character emits while walking / sneaking, per footfall. */
  footstepNoise: 1.6,
  sneakFootstepNoise: 0.4,
  stepInterval: 0.34,
} as const;

export const CURSOR = {
  /** Samples kept for the trail and for enemies that read movement history. */
  historySamples: 96,
  historyInterval: 1 / 60,
  /** Below this speed (px/s) the cursor counts as stationary. */
  stillSpeed: 9,
  /** Speed that maps to maximum movement intensity. */
  fastSpeed: 1150,
  /** Dwell has to exceed this before it starts to look unnatural. */
  dwellGrace: 1.1,
  dwellFull: 3.4,
  /** Radius the cursor must stay inside for dwell to keep accumulating. */
  dwellRadius: 16,
  velocitySmoothing: 22,
  headingSmoothing: 9,
  /** A click is a tap on the world: it always makes this much noise. */
  emptyClickNoise: 2,
} as const;

export const AWARENESS = {
  /** Awareness at or above this is a detection. */
  detect: 1,
  alert: 0.82,
  investigate: 0.58,
  suspicious: 0.3,
  /** Awareness can overshoot slightly so that a detection has weight. */
  ceiling: 1.15,
  /** A "near miss" is logged when awareness peaked above this and came back. */
  nearMiss: 0.74,
  /** The beat of silence between being noticed and being chased. */
  noticeFreeze: 0.65,
  /** Pursuit is broken after this long without line of sight to the player. */
  pursuitLoseTime: 1.5,
} as const;

export const NOISE = {
  /**
   * A noise of level L is audible out to L * audibleScale pixels. With 26 that
   * puts a fingertip click at 52px (you have to be beside something), a heavy
   * switch at 130, breaking glass at 260, a ringing phone at 468 and an alarm at
   * 520, which is most of a room.
   */
  audibleScale: 26,
  /** Decay of the ambient noise field the cursor carries after a click. */
  cursorNoiseDecay: 2.6,
  /** How long an enemy stays focused on a noise lure instead of the cursor. */
  lureFocus: 4.2,
  /** While locked on a lure, cursor pressure is scaled by this. */
  lureCursorDamping: 0.3,
} as const;

export const LIGHT = {
  /** Cursor visibility in total darkness. Darkness hides you, it does not erase you. */
  minVisibility: 0.34,
  /** Ambient light level used when a room does not say otherwise. */
  defaultAmbient: 0.22,
} as const;

export const SCORE = {
  roomBase: 1000,
  parTimeBonus: 1200,
  noDetectionBonus: 1500,
  clicklessBonus: 600,
  silentBonus: 400,
  decoyBonus: 300,
  nearMissBonus: 500,
  secretBonus: 750,
  perfectBonus: 1000,
} as const;

export const FEEL = {
  shakeDecay: 7,
  maxShake: 9,
  heartbeatThreshold: 0.45,
  vignetteGain: 0.75,
} as const;
