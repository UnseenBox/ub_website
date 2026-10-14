import { GRAVITY_Z, MAX_ANGULAR_SPEED, MAX_SPEED } from '../core/constants';
import { collide, createManifold } from './Collision';
import { closingSpeed, correctPositions, createContact, resolveVelocity, type Contact } from './CollisionResolver';
import type { RigidBody } from './RigidBody';
import { SpatialGrid } from './SpatialGrid';

export interface Landing {
  body: RigidBody;
  speed: number;
}

export interface WorldBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const VELOCITY_ITERATIONS = 3;
const SLEEP_SPEED = 7;
const SLEEP_ANGULAR = 0.2;
const SLEEP_DELAY = 0.45;
const AIR_FRICTION_FACTOR = 0.06;

/**
 * Lightweight top-down rigid-body world: semi-implicit Euler integration, grid broad phase,
 * SAT narrow phase, sequential impulses. Tuned for stability and fun over accuracy.
 */
export class PhysicsWorld {
  readonly bodies: RigidBody[] = [];
  /** Physical contacts of the last step. Only the first `contactCount` entries are valid. */
  readonly contacts: Contact[] = [];
  contactCount = 0;
  /** Trigger overlaps of the last step (never resolved). */
  readonly triggers: Contact[] = [];
  triggerCount = 0;
  /** Bodies that touched the floor this step after being airborne. */
  readonly landings: Landing[] = [];
  landingCount = 0;

  /** Dynamic bodies are kept inside this box no matter what — the anti-tunnelling backstop. */
  bounds: WorldBounds = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };
  /** Game-level veto on top of the layer/mask test. */
  pairFilter: ((a: RigidBody, b: RigidBody) => boolean) | null = null;

  readonly stats = { pairsTested: 0, contacts: 0, awake: 0 };

  private readonly grid = new SpatialGrid(72);
  private readonly manifold = createManifold();
  private readonly candidates: RigidBody[] = [];

  setBounds(bounds: WorldBounds, margin: number): void {
    this.bounds = bounds;
    this.grid.resize(bounds.x0 - margin, bounds.y0 - margin, bounds.x1 + margin, bounds.y1 + margin);
  }

  add(body: RigidBody): void {
    this.bodies.push(body);
  }

  remove(body: RigidBody): void {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  clear(): void {
    this.bodies.length = 0;
    this.contactCount = 0;
    this.triggerCount = 0;
    this.landingCount = 0;
  }

  step(dt: number): void {
    this.contactCount = 0;
    this.triggerCount = 0;
    this.landingCount = 0;

    this.integrate(dt);
    this.findContacts();

    for (let it = 0; it < VELOCITY_ITERATIONS; it++) {
      for (let i = 0; i < this.contactCount; i++) resolveVelocity(this.contacts[i]!);
    }
    for (let i = 0; i < this.contactCount; i++) correctPositions(this.contacts[i]!);

    this.enforceBounds();
    this.stats.contacts = this.contactCount;
  }

  private integrate(dt: number): void {
    let awake = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]!;
      if (b.type === 'static') continue;

      b.prevX = b.x;
      b.prevY = b.y;
      b.prevAngle = b.angle;
      b.prevZ = b.z;

      if (b.ignoreTimer > 0) {
        b.ignoreTimer -= dt;
        if (b.ignoreTimer <= 0) b.ignoreId = 0;
      }

      if (b.type === 'kinematic') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += b.w * dt;
        b.updateExtents();
        continue;
      }

      if (b.sleeping) continue;
      awake++;

      if (!Number.isFinite(b.vx) || !Number.isFinite(b.vy) || !Number.isFinite(b.w)) {
        b.vx = b.vy = b.w = 0;
      }

      b.vx += b.fx * b.invMass * dt;
      b.vy += b.fy * b.invMass * dt;
      b.fx = 0;
      b.fy = 0;

      const airborne = b.z > 0.5;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 0) {
        const decel = b.groundFriction * (airborne ? AIR_FRICTION_FACTOR : 1) * dt;
        let next = Math.max(0, speed - decel) * Math.exp(-b.linearDrag * dt);
        if (next > MAX_SPEED) next = MAX_SPEED;
        const scale = next / speed;
        b.vx *= scale;
        b.vy *= scale;
      }

      b.w *= Math.exp(-b.angularDrag * (airborne ? 0.25 : 1) * dt);
      if (b.w > MAX_ANGULAR_SPEED) b.w = MAX_ANGULAR_SPEED;
      else if (b.w < -MAX_ANGULAR_SPEED) b.w = -MAX_ANGULAR_SPEED;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!b.fixedRotation) b.angle += b.w * dt;

      if (b.z > 0 || b.vz !== 0) {
        b.vz -= GRAVITY_Z * dt;
        b.z += b.vz * dt;
        if (b.z <= 0) {
          const impactSpeed = -b.vz;
          b.z = 0;
          b.vz = 0;
          if (impactSpeed > 40) this.pushLanding(b, impactSpeed);
        }
      }

      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.angle)) {
        b.x = b.prevX;
        b.y = b.prevY;
        b.angle = b.prevAngle;
        b.vx = b.vy = b.w = 0;
      }

      b.updateExtents();

      if (b.canSleep && b.z === 0 && speed < SLEEP_SPEED && Math.abs(b.w) < SLEEP_ANGULAR) {
        b.sleepTimer += dt;
        if (b.sleepTimer >= SLEEP_DELAY) {
          b.sleeping = true;
          b.vx = b.vy = b.w = 0;
        }
      } else {
        b.sleepTimer = 0;
      }
    }
    this.stats.awake = awake;
  }

  private pushLanding(body: RigidBody, speed: number): void {
    let landing = this.landings[this.landingCount];
    if (!landing) {
      landing = { body, speed };
      this.landings.push(landing);
    } else {
      landing.body = body;
      landing.speed = speed;
    }
    this.landingCount++;
  }

  private findContacts(): void {
    const grid = this.grid;
    grid.clear();
    for (let i = 0; i < this.bodies.length; i++) grid.insert(this.bodies[i]!);

    let tested = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i]!;
      if (!isActive(a)) continue;

      grid.collect(a, this.candidates);
      for (let j = 0; j < this.candidates.length; j++) {
        const b = this.candidates[j]!;
        // Two active bodies would otherwise find each other twice.
        if (isActive(b) && b.id < a.id) continue;
        if ((a.mask & b.layer) === 0 || (b.mask & a.layer) === 0) continue;
        if (a.ignoreId === b.id || b.ignoreId === a.id) continue;
        if (Math.abs(a.x - b.x) > a.extX + b.extX || Math.abs(a.y - b.y) > a.extY + b.extY) continue;
        if (this.pairFilter && !this.pairFilter(a, b)) continue;

        tested++;
        if (!collide(a, b, this.manifold)) continue;

        const trigger = a.isTrigger || b.isTrigger;
        const contact = this.acquire(trigger, a, b);
        contact.nx = this.manifold.nx;
        contact.ny = this.manifold.ny;
        contact.px = this.manifold.px;
        contact.py = this.manifold.py;
        contact.depth = this.manifold.depth;
        contact.impulse = 0;
        contact.approach = closingSpeed(contact);
      }
    }
    this.stats.pairsTested = tested;
  }

  private acquire(trigger: boolean, a: RigidBody, b: RigidBody): Contact {
    const list = trigger ? this.triggers : this.contacts;
    const index = trigger ? this.triggerCount++ : this.contactCount++;
    let contact = list[index];
    if (!contact) {
      contact = createContact(a, b);
      list.push(contact);
    } else {
      contact.a = a;
      contact.b = b;
    }
    return contact;
  }

  private enforceBounds(): void {
    const { x0, y0, x1, y1 } = this.bounds;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]!;
      if (b.type !== 'dynamic') continue;
      if (b.x < x0) {
        b.x = x0;
        if (b.vx < 0) b.vx = -b.vx * 0.3;
      } else if (b.x > x1) {
        b.x = x1;
        if (b.vx > 0) b.vx = -b.vx * 0.3;
      }
      if (b.y < y0) {
        b.y = y0;
        if (b.vy < 0) b.vy = -b.vy * 0.3;
      } else if (b.y > y1) {
        b.y = y1;
        if (b.vy > 0) b.vy = -b.vy * 0.3;
      }
    }
  }

  /** Visits bodies whose bounding circle overlaps the query circle. Uses last step's grid. */
  queryCircle(x: number, y: number, r: number, visit: (body: RigidBody) => void): void {
    this.grid.forEachInBox(x, y, r, r, (body) => {
      const dx = body.x - x;
      const dy = body.y - y;
      const reach = r + body.boundR;
      if (dx * dx + dy * dy <= reach * reach) visit(body);
    });
  }

  /**
   * Distance along a ray to the first body on `layerMask`, or `maxDist` if nothing is hit.
   * Bodies are approximated by their bounding circle unless they are static boxes.
   */
  raycast(x: number, y: number, dx: number, dy: number, maxDist: number, layerMask: number, out?: { nx: number; ny: number }): number {
    let best = maxDist;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i]!;
      if ((b.layer & layerMask) === 0) continue;
      const s = b.shape;
      if (s.kind === 'box') {
        const cos = Math.cos(b.angle);
        const sin = Math.sin(b.angle);
        const ox = (x - b.x) * cos + (y - b.y) * sin;
        const oy = -(x - b.x) * sin + (y - b.y) * cos;
        const rx = dx * cos + dy * sin;
        const ry = -dx * sin + dy * cos;
        let tmin = 0;
        let tmax = best;
        let hitAxis = 0;
        let hitSign = 0;
        let missed = false;
        for (let axis = 0; axis < 2; axis++) {
          const o = axis === 0 ? ox : oy;
          const d = axis === 0 ? rx : ry;
          const h = axis === 0 ? s.hw : s.hh;
          if (Math.abs(d) < 1e-8) {
            if (o < -h || o > h) missed = true;
            continue;
          }
          let t1 = (-h - o) / d;
          let t2 = (h - o) / d;
          let sign = -1;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
            sign = 1;
          }
          if (t1 > tmin) {
            tmin = t1;
            hitAxis = axis;
            hitSign = sign;
          }
          if (t2 < tmax) tmax = t2;
        }
        if (missed || tmin > tmax || tmin <= 0 || tmin >= best) continue;
        best = tmin;
        if (out) {
          const lx = hitAxis === 0 ? hitSign : 0;
          const ly = hitAxis === 1 ? hitSign : 0;
          out.nx = lx * cos - ly * sin;
          out.ny = lx * sin + ly * cos;
        }
      } else {
        const ox = x - b.x;
        const oy = y - b.y;
        const bq = ox * dx + oy * dy;
        const cq = ox * ox + oy * oy - s.r * s.r;
        const disc = bq * bq - cq;
        if (disc < 0) continue;
        const t = -bq - Math.sqrt(disc);
        if (t <= 0 || t >= best) continue;
        best = t;
        if (out) {
          out.nx = (ox + dx * t) / s.r;
          out.ny = (oy + dy * t) / s.r;
        }
      }
    }
    return best;
  }
}

function isActive(body: RigidBody): boolean {
  return body.type === 'kinematic' || (body.type === 'dynamic' && !body.sleeping);
}
