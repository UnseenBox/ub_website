export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 0.1;
export const MAX_STEPS_PER_FRAME = 14;

/**
 * On-screen text switches.
 *
 * `TEXT_VISIBLE` — the in-world floating text: reaction popups ("+250",
 * "PERFECT IMPACT!", "HATS OFF") and the comic impact words
 * (KABOOM!/SMASH!/CRUNCH! …). On by default.
 *
 * `ANNOUNCEMENTS_VISIBLE` — the announcement layer: the ransom-note banners
 * ("CHAIN REACTION!", room names, boss titles) and the level-up cards
 * ("NEW POWER / BIG RED BUTTON"). Off: no announcement cards cover the screen.
 */
export const TEXT_VISIBLE = true;
export const ANNOUNCEMENTS_VISIBLE = false;

/** Wall thickness around the room interior, in world units. */
export const WALL = 40;

export const MAX_SPEED = 1700;
export const MAX_ANGULAR_SPEED = 28;
/** Gravity along the cosmetic height axis (throw arcs, things falling off tables). */
export const GRAVITY_Z = 1500;

export const INK = '#221b36';

export const PALETTE = {
  ink: INK,
  backdrop: '#1b1730',
  backdropDot: '#262043',
  floorA: '#ead9b5',
  floorB: '#e2ceA4',
  floorLine: '#cdb688',
  wallTop: '#2c6e73',
  wallFace: '#1f4f55',
  wallTrim: '#3c8a8e',
  cream: '#fff3d6',
  coral: '#ff5a4e',
  yellow: '#ffd23f',
  cyan: '#4ad6e8',
  teal: '#2f7f86',
  lime: '#9be564',
  white: '#ffffff',
} as const;
