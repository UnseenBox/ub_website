import { PHYSICS } from '../config';
import type { Arena } from '../game/Arena';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Integrate a slime shot the way the solver does: gravity, then linear damping.
 * It stops when it enters terrain or runs out of time.
 */
export function stepShot(v: Vec2, p: Vec2, dt: number): void {
  v.y += PHYSICS.gravityY * dt;
  const damp = 1 / (1 + dt * 0.03);
  v.x *= damp;
  v.y *= damp;
  p.x += v.x * dt;
  p.y += v.y * dt;
}

/**
 * Preview the flight path of a launch. Samples are spaced in time and stop at
 * terrain. `landing` marks the first solid contact, when there is one.
 */
export function previewPath(
  arena: Arena,
  origin: Vec2,
  velocity: Vec2,
  maxTime = 2.6,
  sampleEvery = 0.07,
): { points: Vec2[]; landing: Vec2 | null } {
  const dt = 1 / 120;
  const v = { x: velocity.x, y: velocity.y };
  const p = { x: origin.x, y: origin.y };
  const points: Vec2[] = [{ x: p.x, y: p.y }];
  let nextSample = sampleEvery;
  let t = 0;
  while (t < maxTime) {
    stepShot(v, p, dt);
    t += dt;
    if (arena.isSolid(p.x, p.y)) return { points, landing: { x: p.x, y: p.y } };
    if (p.y < -6 || Math.abs(p.x) > 60) break;
    if (t >= nextSample) {
      points.push({ x: p.x, y: p.y });
      nextSample += sampleEvery;
    }
  }
  return { points, landing: null };
}

/**
 * Find the low-arc launch direction that passes through `target` at `speed`,
 * by scanning the elevation angle and bisecting the sign change. Returns the
 * unit launch direction, or null when nothing reaches the target.
 */
export function solveLowArc(arena: Arena, origin: Vec2, target: Vec2, speed: number): Vec2 | null {
  const dir = Math.sign(target.x - origin.x) || 1;

  // Height error at the target's x: negative = short, positive = high.
  const error = (elevation: number): number => {
    const v = { x: Math.cos(elevation) * speed * dir, y: Math.sin(elevation) * speed };
    const p = { x: origin.x, y: origin.y };
    const dt = 1 / 120;
    for (let i = 0; i < 1200; i++) {
      stepShot(v, p, dt);
      if (arena.isSolid(p.x, p.y)) return -50; // hits terrain first: short
      if ((p.x - target.x) * dir >= 0) return p.y - target.y;
      if (p.y < -6) return -50;
    }
    return -50;
  };

  const samples = 48;
  const lo = -0.25;
  const hi = 1.3;
  let prevAngle = lo;
  let prevErr = error(lo);
  for (let i = 1; i <= samples; i++) {
    const angle = lo + ((hi - lo) * i) / samples;
    const err = error(angle);
    if (prevErr < 0 && err >= 0) {
      let a = prevAngle;
      let b = angle;
      for (let k = 0; k < 18; k++) {
        const m = (a + b) / 2;
        if (error(m) < 0) a = m;
        else b = m;
      }
      const e = (a + b) / 2;
      return { x: Math.cos(e) * dir, y: Math.sin(e) };
    }
    prevAngle = angle;
    prevErr = err;
  }
  return null;
}
