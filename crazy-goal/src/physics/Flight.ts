import type { RigidBody } from './RigidBody';

/**
 * The free-kick moves, added to the street ball without touching how it rolls on the ground.
 *
 * AIR: the ball has a height `z` and a vertical speed `vz`. While it is higher than an obstacle's
 * `clear` it flies over it; under the crossbar it still scores. BEND: a sideways pull that turns
 * the velocity without changing the speed, fading out when the ball is slow or has already turned
 * a long way (so a missed shot cannot spiral), and gone after the first touch.
 *
 * Everything here runs inside `PhysicsWorld.stepBody`, so the aim preview's ghost ball and the
 * validation sweeps fly exactly like the real one.
 */
export const KICK = {
  /** Downward pull on a lofted ball, world units per second squared. */
  gravity: 900,
  /** A lofted ball launches with a vertical speed between these, by power. */
  vzMin: 400,
  vzMax: 470,
  /** Landing: a hard drop keeps this share of its speed as a hop; a soft one stays down. */
  bounceKeep: 0.2,
  bounceMin: 120,
  /** In the air the ball slows less and feels no rolling resistance. */
  airDragScale: 0.3,
  /** Above this height the ball counts as airborne. */
  airborne: 4,
  /** The top of the goal: a ball higher than this where it crosses the line is over the bar. */
  barZ: 64,
  /** The defenders' wall: a ball higher than this clears it. */
  wallClear: 62,
  /** Sideways acceleration at full bend, and where it fades in and out. */
  curve: 3400,
  slowFrom: 240,
  slowTo: 90,
  fullTurn: (135 * Math.PI) / 180,
  endTurn: (170 * Math.PI) / 180,
} as const;

export type ShotType = 'ground' | 'air';

/** A lofted ball is struck over a narrower, gentler range of speeds than a rolling one: it has to come down in the goal. */
export const airSpeed = (power: number): number => 520 + 900 * Math.min(1, Math.max(0, power));

export const launchVz = (power: number): number => KICK.vzMin + (KICK.vzMax - KICK.vzMin) * Math.min(1, Math.max(0, power));

/**
 * How high a lofted ball goes, as the player picks it: 0 is a low lob that still clears a car, 1 the highest
 * (about 0.7 to 1.25 seconds in the air). The vertical speed is what sets the height.
 */
export const ALTITUDE = { vzMin: 300, vzMax: 560 } as const;

/** The vertical speed of a chosen height, from 0 (low) to 1 (high). */
export const altitudeVz = (height: number): number => ALTITUDE.vzMin + (ALTITUDE.vzMax - ALTITUDE.vzMin) * Math.min(1, Math.max(0, height));

/** The height a strike picks on its own: the lob its power gives, as a share of the altitude range. */
export const autoAltitude = (power: number): number => (launchVz(power) - ALTITUDE.vzMin) / (ALTITUDE.vzMax - ALTITUDE.vzMin);

/** The vertical speed of a lofted shot: the height the player picked, or the power's own lob when there is none. */
export const lobVz = (power: number, height: number | null): number => (height === null ? launchVz(power) : altitudeVz(height));

/** A height the player picks moves in twentieths: the slider and the keys land on the same values. */
export const snapHeight = (height: number): number => Math.round(Math.min(1, Math.max(0, height)) * 20) / 20;

/** How far one press of W or S moves the height. */
export const HEIGHT_KEY_STEP = 0.1;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** One step of height: gravity, and the hop on landing. */
export function flyStep(b: RigidBody, dt: number): void {
  if (b.z <= 0 && b.vz === 0) return;
  b.vz -= KICK.gravity * dt;
  b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    b.vz = b.vz < -KICK.bounceMin ? -b.vz * KICK.bounceKeep : 0;
  }
}

/** One step of bend: turns the velocity, keeps the speed. */
export function bendStep(b: RigidBody, dt: number): void {
  if (b.bend === 0) return;
  const v = Math.hypot(b.vx, b.vy);
  if (v < 1) return;
  const grip = smooth(KICK.slowTo, KICK.slowFrom, v) * (1 - smooth(KICK.fullTurn, KICK.endTurn, b.turned));
  const turn = ((KICK.curve * b.bend * grip) / v) * dt;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const vx = b.vx * c - b.vy * s;
  const vy = b.vx * s + b.vy * c;
  b.vx = vx;
  b.vy = vy;
  b.turned += Math.abs(turn);
}
