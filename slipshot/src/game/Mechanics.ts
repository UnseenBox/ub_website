import * as planck from 'planck';
import { PHYSICS } from '../config';
import type { PhysicsObject } from '../physics/PhysicsObject';
import type { Projectile } from '../physics/Projectile';
import type { Ragdoll } from '../physics/Ragdoll';
import type { WellSpec } from './catalog';

/** A gravity well left by a Gravity Well shot. It pulls bodies in until it times out. */
export interface Well extends WellSpec {
  x: number;
  y: number;
}

export interface MechanicsContext {
  projectiles: Projectile[];
  /** All live characters (for pulling and steering). */
  ragdolls: Ragdoll[];
  objects: PhysicsObject[];
  /** Characters a projectile may steer toward: enemies for player shots, the player otherwise. */
  targetsFor(p: Projectile): Ragdoll[];
  /** The character that threw a projectile, or null if it is gone. */
  ownerOf(id: number): Ragdoll | null;
  /** A fuse ran out. The controller explodes the shot. */
  onFuse(p: Projectile): void;
}

const BOOMERANG_SPEED = 16;
const GRAVITY = -PHYSICS.gravityY;

/**
 * Per-step behaviour that the physics solver does not know about: homing,
 * boomerang return, lift, fuses and gravity wells. Forces are applied with
 * Planck's applyForce, so every effect still goes through the solver.
 */
export class Mechanics {
  readonly wells: Well[] = [];

  update(dt: number, ctx: MechanicsContext): void {
    for (const p of ctx.projectiles) {
      if (!p.alive || p.consumed) continue;
      this.updateProjectile(dt, p, ctx);
    }
    this.updateWells(dt, ctx);
  }

  private updateProjectile(dt: number, p: Projectile, ctx: MechanicsContext): void {
    const b = p.body;
    const shot = p.shot;

    if (p.liftLeft > 0) {
      p.liftLeft -= dt;
      b.applyForceToCenter({ x: 0, y: b.getMass() * GRAVITY * shot.lift }, true);
    }

    if (shot.homing > 0 && !p.returning) {
      const pos = b.getPosition();
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const r of ctx.targetsFor(p)) {
        if (!r.alive) continue;
        const t = r.torsoPosition();
        const d = Math.hypot(t.x - pos.x, t.y - pos.y);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (best) {
        const v = b.getLinearVelocity();
        const speed = Math.hypot(v.x, v.y);
        const ux = (best.x - pos.x) / (bestD || 1);
        const uy = (best.y - pos.y) / (bestD || 1);
        // Bend the velocity toward the target, keeping the current speed.
        let nx = v.x + ux * speed * shot.homing * dt;
        let ny = v.y + uy * speed * shot.homing * dt;
        const len = Math.hypot(nx, ny) || 1;
        nx = (nx / len) * speed;
        ny = (ny / len) * speed;
        b.setLinearVelocity({ x: nx, y: ny });
      }
    }

    if (shot.boomerang > 0) {
      if (!p.returning) {
        p.boomerangLeft -= dt;
        if (p.boomerangLeft <= 0) {
          p.returning = true;
          p.hitTargets.clear();
        }
      }
      const owner = p.returning ? ctx.ownerOf(p.ownerId) : null;
      if (owner && owner.alive) {
        const hand = owner.muzzle({ x: 0, y: 1 }, 0);
        const pos = b.getPosition();
        const dx = hand.x - pos.x;
        const dy = hand.y - pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.8) {
          // Caught: remove it quietly.
          p.life = 0;
          return;
        }
        const v = b.getLinearVelocity();
        const k = Math.min(1, 6 * dt);
        b.setLinearVelocity({
          x: v.x + (((dx / dist) * BOOMERANG_SPEED - v.x) * k),
          y: v.y + (((dy / dist) * BOOMERANG_SPEED - v.y) * k),
        });
      }
    }

    if (shot.fuse > 0) {
      p.fuseLeft -= dt;
      if (p.fuseLeft <= 0) ctx.onFuse(p);
    }
  }

  /** Wells pull ragdoll parts, objects and loose shots toward their centre. */
  private updateWells(dt: number, ctx: MechanicsContext): void {
    for (let i = this.wells.length - 1; i >= 0; i--) {
      const w = this.wells[i];
      w.time -= dt;
      if (w.time <= 0) {
        this.wells.splice(i, 1);
        continue;
      }
      for (const r of ctx.ragdolls) {
        if (!r.alive) continue;
        for (const part of r.parts.values()) this.pull(part.body, w);
      }
      for (const o of ctx.objects) this.pull(o.body, w);
      for (const p of ctx.projectiles) if (p.alive && p.life > 0) this.pull(p.body, w);
    }
  }

  private pull(body: planck.Body, w: Well): void {
    const pos = body.getPosition();
    const dx = w.x - pos.x;
    const dy = w.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > w.radius || d < 1e-6) return;
    // Acceleration falls off with distance; the force scales with mass.
    const accel = (w.strength * 0.5) / (d + 0.6);
    const f = body.getMass() * accel;
    body.applyForceToCenter({ x: (dx / d) * f, y: (dy / d) * f }, true);
  }
}
