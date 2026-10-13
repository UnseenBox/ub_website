import { circleVsBody, emptyContact, type Contact } from './Collision';
import { resolveCircleStatic } from './CollisionResolver';
import type { RigidBody } from './RigidBody';
import { SpatialGrid } from './SpatialGrid';

export type ContactListener = (body: RigidBody, other: RigidBody, contact: Contact, impact: number) => void;

/** Simulation rate. At 240 Hz the fastest ball moves under half its radius per step, so nothing tunnels. */
export const FIXED_DT = 1 / 240;

/**
 * Static geometry plus the stepping of moving circles against it.
 * The same `stepBody` drives the real ball and the aim preview's ghost, so the preview cannot lie.
 */
export class PhysicsWorld {
  readonly statics: RigidBody[] = [];
  /**
   * Bodies that move on rails of their own (a scooter, a goalkeeper). The ball bounces off
   * them; they are never pushed back. Their owner sets position and velocity each step.
   */
  readonly movers: RigidBody[] = [];
  private readonly grid = new SpatialGrid(128);
  private readonly candidates: RigidBody[] = [];
  private readonly contact: Contact = emptyContact();
  /** Contacts resolved since the counter was last cleared (debug overlay). */
  contactCount = 0;

  addStatic(b: RigidBody): RigidBody {
    this.statics.push(b);
    this.grid.insert(b);
    return b;
  }

  addMover(b: RigidBody): RigidBody {
    this.movers.push(b);
    return b;
  }

  clear(): void {
    this.movers.length = 0;
    this.statics.length = 0;
    this.grid.clear();
  }

  stepBody(b: RigidBody, dt: number, listener: ContactListener | null): void {
    integrate(b, dt);
    if (b.shape.kind !== 'circle') return;
    const r = b.shape.r;
    const c = this.contact;
    // Two passes so a ball wedged into a corner is pushed clear of both faces.
    for (let pass = 0; pass < 2; pass++) {
      const n = this.grid.query(b.x - r, b.y - r, b.x + r, b.y + r, this.candidates);
      let touched = false;
      for (let i = 0; i < n; i++) {
        const o = this.candidates[i];
        if ((o.layer & b.mask) === 0) continue;
        if (!circleVsBody(b.x, b.y, r, o, c)) continue;
        touched = true;
        const impact = resolveCircleStatic(b, r, o, c);
        if (impact > 0) {
          this.contactCount++;
          if (listener) listener(b, o, c, impact);
        }
      }
      if (!touched) break;
    }
    for (let i = 0; i < this.movers.length; i++) {
      const o = this.movers[i];
      if ((o.layer & b.mask) === 0) continue;
      if (!circleVsBody(b.x, b.y, r, o, c)) continue;
      // Bounce in the mover's frame of reference, so a body coming at the ball adds its pace.
      b.vx -= o.vx;
      b.vy -= o.vy;
      const impact = resolveCircleStatic(b, r, o, c);
      b.vx += o.vx;
      b.vy += o.vy;
      if (impact > 0) {
        this.contactCount++;
        if (listener) listener(b, o, c, impact);
      }
    }
  }
}

function integrate(b: RigidBody, dt: number): void {
  b.vx += b.ax * dt;
  b.vy += b.ay * dt;
  b.ax = 0;
  b.ay = 0;

  const speed = Math.hypot(b.vx, b.vy);
  if (speed > 0) {
    // Rolling resistance takes a fixed bite, drag a proportional one. Together they give a
    // ball that keeps its pace when struck hard and still dies quickly once it is slow.
    const after = (speed - b.rollResistance * dt) * Math.exp(-b.drag * dt);
    if (after <= 0) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const k = (after > b.maxSpeed ? b.maxSpeed : after) / speed;
      b.vx *= k;
      b.vy *= k;
    }
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.spinDrag > 0) b.angVel *= Math.exp(-b.spinDrag * dt);
}
