import type { ArenaDef, GoalDef } from './LevelDefinition';
import { circleVsBody, emptyContact } from '../physics/Collision';
import type { RigidBody } from '../physics/RigidBody';

/** The coin's own radius, for placement clearance. */
const COIN_RADIUS = 24;

/** Deterministic 0..1 from a seed string, so every alley always hides its coin in the same spot. */
function hash(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export interface CoinSpot {
  x: number;
  y: number;
}

/**
 * One coin per alley, strung along the natural line from the ball to the goal, knocked off
 * sideways so a lazy straight shot will not hoover it up for free: catching it takes a touch
 * of shape. Clearance is checked against every static body (walls, tyres, glass, bumpers),
 * falling back towards the line and then nearer the ball until the spot is genuinely reachable.
 */
export function coinSpot(
  levelId: string,
  arena: ArenaDef,
  ball: { x: number; y: number },
  goal: GoalDef,
  statics: readonly RigidBody[],
): CoinSpot {
  // The mouth, deeper in: the line the ball travels if it scores.
  const ax = goal.x;
  const ay = goal.lineY + goal.depth;
  const vx = ax - ball.x;
  const vy = ay - ball.y;
  const len = Math.hypot(vx, vy) || 1;
  const px = -vy / len;
  const py = vx / len;
  const side = hash(levelId) < 0.5 ? -1 : 1;
  const offset = side * (44 + hash(`${levelId}#o`) * 34);
  const t0 = 0.42 + hash(`${levelId}#t`) * 0.22;
  const margin = 84;
  const ts = [t0, 0.5, 0.62, 0.34, 0.27];
  const offsets = [offset, offset * 0.55, 0];
  for (const t of ts) {
    for (const o of offsets) {
      const x = ball.x + vx * t + px * o;
      const y = ball.y + vy * t + py * o;
      const cx = Math.min(arena.x + arena.w - margin, Math.max(arena.x + margin, x));
      const cy = Math.min(arena.y + arena.h - margin, Math.max(arena.y + margin, y));
      if (clearOfStatics(cx, cy, COIN_RADIUS, statics)) return { x: cx, y: cy };
    }
  }
  // A last resort on the line itself, mid-flight: every alley keeps its coin.
  return { x: ball.x + vx * 0.5, y: ball.y + vy * 0.5 };
}

/** True unless a circle of `radius` at (x, y) would clip a static body. */
function clearOfStatics(x: number, y: number, radius: number, statics: readonly RigidBody[]): boolean {
  const contact = emptyContact();
  for (const body of statics) {
    // The goal posts and net live along the top edge; the mid-flight area never touches them.
    if (circleVsBody(x, y, radius, body, contact)) return false;
  }
  return true;
}
