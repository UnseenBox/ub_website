import * as planck from 'planck';
import { COMBAT, PHYSICS, PLAYER_ID } from '../config';
import { slimeFrictionFor } from './friction';
import type { Ragdoll } from './Ragdoll';
import type { PartName } from './rig';
import type { Projectile } from './Projectile';
import type { Tag } from './tags';

/** A projectile touched something. Speed is the approach speed along the normal. */
export interface ProjectileHit {
  projectile: Projectile;
  other: Tag;
  otherBody: planck.Body;
  point: planck.Vec2Value;
  /** Points from the projectile into the thing it hit. */
  normal: planck.Vec2Value;
  speed: number;
}

/** A character body began touching something hard. speed = approach speed (m/s). */
export interface ImpactEvent {
  ragdoll: Ragdoll;
  part: PartName;
  speed: number;
  point: planck.Vec2Value;
  /** What the part hit: terrain, an object (a loose crate, say), or another character. */
  source: Tag['kind'];
}

/**
 * Owns the Planck world, the fixed step and the contact listeners. Listeners
 * only record events; world mutations (body removal, puddles) happen after the
 * step, so they never run while the world is locked.
 */
export class PhysicsManager {
  readonly world: planck.World;
  /** Simulated time in seconds. */
  time = 0;

  private hits: ProjectileHit[] = [];
  private impacts: ImpactEvent[] = [];
  private pendingBodies: planck.Body[] = [];

  constructor() {
    this.world = new planck.World({
      gravity: new planck.Vec2(0, PHYSICS.gravityY),
      allowSleep: false,
    });
    this.world.on('begin-contact', (c) => this.onBeginContact(c));
    this.world.on('pre-solve', (c) => this.onPreSolve(c));
  }

  step(dt: number): void {
    this.world.step(dt, PHYSICS.velocityIterations, PHYSICS.positionIterations);
    this.time += dt;
  }

  drain(): { hits: ProjectileHit[]; impacts: ImpactEvent[] } {
    const hits = this.hits;
    const impacts = this.impacts;
    this.hits = [];
    this.impacts = [];
    return { hits, impacts };
  }

  /**
   * Rebuild each ragdoll's contact counters from the world's current contact
   * list. Called once per fixed step, before character logic. Scanning the list
   * is cheap at this scale, and unlike begin/end events it cannot leave a stale
   * grounded state behind when a tower block or loose object is removed.
   */
  refreshContacts(ragdolls: Ragdoll[]): void {
    for (const r of ragdolls) {
      r.footContacts = 0;
      r.bodyContacts = 0;
    }
    let contact = this.world.getContactList();
    while (contact) {
      if (contact.isTouching()) {
        const a = contact.getFixtureA().getUserData() as Tag | undefined;
        const b = contact.getFixtureB().getUserData() as Tag | undefined;
        this.countRagdollContact(a, b);
        this.countRagdollContact(b, a);
      }
      contact = contact.getNext();
    }
  }

  private countRagdollContact(self: Tag | undefined, other: Tag | undefined): void {
    if (!self || self.kind !== 'part' || !other) return;
    // Parts of the same body are filtered out, but a character resting on
    // another character is not standing on ground either.
    if (other.kind === 'part' || other.kind === 'projectile') return;
    self.ragdoll.bodyContacts++;
    if (self.foot) self.ragdoll.footContacts++;
  }

  /** Queue a body for removal; applied by flush() outside the step. */
  removeBody(body: planck.Body): void {
    this.pendingBodies.push(body);
  }

  flush(): void {
    for (const b of this.pendingBodies) this.world.destroyBody(b);
    this.pendingBodies = [];
  }

  private onBeginContact(contact: planck.Contact): void {
    const fa = contact.getFixtureA();
    const fb = contact.getFixtureB();
    const ta = fa.getUserData() as Tag;
    const tb = fb.getUserData() as Tag;
    const bodyA = fa.getBody();
    const bodyB = fb.getBody();
    const wm = contact.getWorldManifold(null);
    if (!wm || wm.points.length === 0) return;
    const point = { x: wm.points[0].x, y: wm.points[0].y };
    // Normal points from shape A to shape B. Velocities are still pre-solve here.
    const n = wm.normal;
    const vA = bodyA.getLinearVelocity();
    const vB = bodyB.getLinearVelocity();
    // Closing speed of the two shapes along the normal. It is positive when they
    // approach each other, and the same value from either side.
    const closing = (vA.x - vB.x) * n.x + (vA.y - vB.y) * n.y;

    const pa = ta.kind === 'projectile';
    const pb = tb.kind === 'projectile';
    if (pa !== pb) {
      const projTag = (pa ? ta : tb) as Extract<Tag, { kind: 'projectile' }>;
      if (projTag.proj.consumed) return;
      const other = pa ? tb : ta;
      // The player's own shots fly through the player's fortress.
      if (other.kind === 'block' && projTag.proj.ownerId === PLAYER_ID) return;
      const otherBody = pa ? bodyB : bodyA;
      // Normal from projectile toward the other shape.
      const pn = pa ? n : { x: -n.x, y: -n.y };
      this.hits.push({
        projectile: projTag.proj,
        other,
        otherBody,
        point,
        normal: { x: pn.x, y: pn.y },
        speed: Math.max(0, closing),
      });
      return;
    }
    if (pa && pb) return;

    // Character parts: a hard closing speed is an impact.
    if (ta.kind === 'part' && closing > COMBAT.impactThreshold) {
      this.impacts.push({ ragdoll: ta.ragdoll, part: ta.part, speed: closing, point, source: tb.kind });
    }
    if (tb.kind === 'part' && closing > COMBAT.impactThreshold) {
      this.impacts.push({ ragdoll: tb.ragdoll, part: tb.part, speed: closing, point, source: ta.kind });
    }
  }

  private onPreSolve(contact: planck.Contact): void {
    const ta = contact.getFixtureA().getUserData() as Tag;
    const tb = contact.getFixtureB().getUserData() as Tag;
    // Piercing shots pass through characters. The begin-contact hit is still reported.
    const piercing =
      (ta.kind === 'projectile' && ta.proj.shot.pierce && tb.kind === 'part') ||
      (tb.kind === 'projectile' && tb.proj.shot.pierce && ta.kind === 'part');
    const friendlyWall =
      (ta.kind === 'projectile' && ta.proj.ownerId === PLAYER_ID && tb.kind === 'block') ||
      (tb.kind === 'projectile' && tb.proj.ownerId === PLAYER_ID && ta.kind === 'block');
    if (piercing || friendlyWall) {
      contact.setEnabled(false);
      return;
    }
    const fa = slimeFrictionFor(ta);
    const fb = slimeFrictionFor(tb);
    if (fa === null && fb === null) return;
    contact.setFriction(Math.min(fa ?? Infinity, fb ?? Infinity));
  }
}
