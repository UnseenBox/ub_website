import type { RigidBody } from './RigidBody';

export interface Contact {
  a: RigidBody;
  b: RigidBody;
  nx: number;
  ny: number;
  px: number;
  py: number;
  depth: number;
  /** Total normal impulse applied this step. Gameplay reads this as "how hard was the hit". */
  impulse: number;
  /** Closing speed along the normal before resolution (positive = approaching). */
  approach: number;
}

export function createContact(a: RigidBody, b: RigidBody): Contact {
  return { a, b, nx: 1, ny: 0, px: 0, py: 0, depth: 0, impulse: 0, approach: 0 };
}

/** Below this closing speed contacts are treated as resting, which stops micro-bouncing. */
const RESTITUTION_THRESHOLD = 60;
const PENETRATION_SLOP = 0.5;
const CORRECTION_PERCENT = 0.6;
const MAX_CORRECTION = 12;

export function closingSpeed(c: Contact): number {
  const a = c.a;
  const b = c.b;
  const rax = c.px - a.x;
  const ray = c.py - a.y;
  const rbx = c.px - b.x;
  const rby = c.py - b.y;
  const rvx = b.vx - b.w * rby - (a.vx - a.w * ray);
  const rvy = b.vy + b.w * rbx - (a.vy + a.w * rax);
  return -(rvx * c.nx + rvy * c.ny);
}

/** Impulse-based response with rotation and Coulomb friction. */
export function resolveVelocity(c: Contact): void {
  const a = c.a;
  const b = c.b;
  const nx = c.nx;
  const ny = c.ny;
  const rax = c.px - a.x;
  const ray = c.py - a.y;
  const rbx = c.px - b.x;
  const rby = c.py - b.y;

  let rvx = b.vx - b.w * rby - (a.vx - a.w * ray);
  let rvy = b.vy + b.w * rbx - (a.vy + a.w * rax);
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return;

  const raCn = rax * ny - ray * nx;
  const rbCn = rbx * ny - rby * nx;
  const k = a.invMass + b.invMass + raCn * raCn * a.invInertia + rbCn * rbCn * b.invInertia;
  if (k <= 0) return;

  const e = -vn > RESTITUTION_THRESHOLD ? Math.max(a.restitution, b.restitution) : 0;
  const j = (-(1 + e) * vn) / k;

  a.vx -= j * nx * a.invMass;
  a.vy -= j * ny * a.invMass;
  a.w -= raCn * j * a.invInertia;
  b.vx += j * nx * b.invMass;
  b.vy += j * ny * b.invMass;
  b.w += rbCn * j * b.invInertia;
  c.impulse += j;

  if (j > 1) {
    a.wake();
    b.wake();
  }

  rvx = b.vx - b.w * rby - (a.vx - a.w * ray);
  rvy = b.vy + b.w * rbx - (a.vy + a.w * rax);
  const vn2 = rvx * nx + rvy * ny;
  let tx = rvx - vn2 * nx;
  let ty = rvy - vn2 * ny;
  const tl = Math.hypot(tx, ty);
  if (tl < 1e-4) return;
  tx /= tl;
  ty /= tl;

  const raCt = rax * ty - ray * tx;
  const rbCt = rbx * ty - rby * tx;
  const kt = a.invMass + b.invMass + raCt * raCt * a.invInertia + rbCt * rbCt * b.invInertia;
  if (kt <= 0) return;

  const mu = Math.sqrt(a.friction * b.friction);
  let jt = -tl / kt;
  const maxFriction = mu * j;
  if (jt < -maxFriction) jt = -maxFriction;

  a.vx -= jt * tx * a.invMass;
  a.vy -= jt * ty * a.invMass;
  a.w -= raCt * jt * a.invInertia;
  b.vx += jt * tx * b.invMass;
  b.vy += jt * ty * b.invMass;
  b.w += rbCt * jt * b.invInertia;
}

/** Pushes overlapping bodies apart directly, so nothing stays sunk into a wall. */
export function correctPositions(c: Contact): void {
  const a = c.a;
  const b = c.b;
  const total = a.invMass + b.invMass;
  if (total <= 0) return;
  let amount = ((c.depth - PENETRATION_SLOP) * CORRECTION_PERCENT) / total;
  if (amount <= 0) return;
  const cap = MAX_CORRECTION / total;
  if (amount > cap) amount = cap;
  a.x -= c.nx * amount * a.invMass;
  a.y -= c.ny * amount * a.invMass;
  b.x += c.nx * amount * b.invMass;
  b.y += c.ny * amount * b.invMass;
}
