/**
 * Tiny math helpers. Everything here is allocation-light: functions take and
 * return numbers where possible, and the few vector helpers write into an
 * out-param so hot loops do not create garbage.
 */

export const TAU = Math.PI * 2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return clamp01((v - a) / (b - a));
}

/** Smooth 0..1 ramp. Nicer than a linear ramp for awareness curves. */
export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = invLerp(edge0, edge1, v);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach. `rate` is per second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

export function moveToward(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Shortest signed angular difference, in radians, within -PI..PI. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function rotateToward(current: number, target: number, maxStep: number): number {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectCenterX(r: Rect): number {
  return r.x + r.w * 0.5;
}

export function rectCenterY(r: Rect): number {
  return r.y + r.h * 0.5;
}

/** Shortest distance from a point to the border/interior of a rect (0 when inside). */
export function pointRectDistance(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.sqrt(dx * dx + dy * dy);
}

export function circleRectOverlap(cx: number, cy: number, radius: number, r: Rect): boolean {
  return pointRectDistance(r, cx, cy) <= radius;
}

/** Expand a rect by `pad` on every side. Returns a new rect. */
export function inflate(r: Rect, pad: number): Rect {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

/**
 * Segment / axis-aligned-rect intersection via the slab method.
 * Used by line of sight, so it must be cheap and branch-light.
 */
export function segmentIntersectsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: Rect,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;

  let tMin = 0;
  let tMax = 1;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (ax < r.x || ax > r.x + r.w) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (r.x - ax) * inv;
    let t2 = (r.x + r.w - ax) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (ay < r.y || ay > r.y + r.h) return false;
  } else {
    const inv = 1 / dy;
    let t1 = (r.y - ay) * inv;
    let t2 = (r.y + r.h - ay) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return true;
}

/** Deterministic 32-bit string hash, used to turn dates into seeds. */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Small deterministic PRNG (mulberry32). Seeded runs must be reproducible for
 * daily challenges and for the replay architecture.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  int(lo: number, hiExclusive: number): number {
    return lo + Math.floor(this.next() * (hiExclusive - lo));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
