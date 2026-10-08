/**
 * Cursor state vocabulary and the data record the sensor produces.
 *
 * NORMAL     nothing is paying attention to you
 * EXPOSED    you are inside something's awareness radius
 * SUSPICIOUS something is reacting to you
 * DETECTED   it knows
 * PANICKING  it is coming, and you have a couple of seconds
 */
export type CursorStateName = 'NORMAL' | 'EXPOSED' | 'SUSPICIOUS' | 'DETECTED' | 'PANICKING';

export interface CursorStateData {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Smoothed velocity, logical units per second. */
  vx: number;
  vy: number;
  speed: number;
  /** Change in speed per second: a jerk toward the mouse reads as panic. */
  acceleration: number;
  /** Unit heading. Persists while the cursor is still, which is what "pointing" means. */
  headingX: number;
  headingY: number;
  /** Total distance travelled this room, for stats. */
  distanceMoved: number;
  timeSinceMove: number;
  /** Seconds the cursor has stayed inside a small radius. */
  dwellTime: number;
  dwellAnchorX: number;
  dwellAnchorY: number;
  /** 0..1 normalised from speed. The number enemies read as "agitation". */
  movementIntensity: number;
  /** 0..1 how legible the cursor is where it sits, driven by room lighting. */
  visibility: number;
  /** Decaying residue of recent clicks. */
  noiseLevel: number;
  clickCount: number;
  timeSinceClick: number;
  /** True while the pointer is off the play surface. */
  lost: boolean;
  lostTime: number;
}

export interface CursorHistorySample {
  x: number;
  y: number;
  /** Room time at which the sample was taken. */
  t: number;
  speed: number;
}
