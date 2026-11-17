import * as planck from 'planck';
import { SLIME } from '../config';
import { addMassFixtures, circleShape } from './shapes';
import type { PhysicsManager } from './PhysicsManager';
import type { Tag } from './tags';

const TRAIL_LENGTH = 9;

/**
 * A slime blob in flight. It is a dynamic bullet body (continuous collision),
 * so gravity, damping, and the impulse on impact come from the solver.
 */
export class Projectile {
  readonly body: planck.Body;
  readonly ownerId: number;
  readonly radius = SLIME.projectileRadius;
  readonly color: string;
  /** Seconds until it expires in flight. */
  life = 7;
  /** Set once its impact has been processed, so it cannot hit twice. */
  consumed = false;
  /** Recent world positions, newest last, for the trail. */
  readonly trail: planck.Vec2Value[] = [];
  prevX: number;
  prevY: number;
  /** Per-blob phase for the wobble visual. */
  readonly seed = Math.random() * 10;

  constructor(physics: PhysicsManager, ownerId: number, position: planck.Vec2Value, velocity: planck.Vec2Value, color: string) {
    this.ownerId = ownerId;
    this.color = color;
    this.body = physics.world.createBody({
      type: 'dynamic',
      position: { x: position.x, y: position.y },
      linearDamping: 0.03,
      angularDamping: 0.2,
    });
    this.body.setBullet(true);

    const tag: Tag = { kind: 'projectile', proj: this };
    addMassFixtures(
      this.body,
      [{ ...circleShape({ x: 0, y: 0 }, this.radius), userData: tag, friction: 0.6 }],
      SLIME.projectileMass,
      // Same negative group as the shooter's parts: the shooter cannot hit itself.
      { friction: 0.6, restitution: 0.15, filterGroupIndex: -ownerId },
    );
    this.body.setLinearVelocity(velocity);
    this.prevX = position.x;
    this.prevY = position.y;
  }

  get position(): planck.Vec2Value {
    return this.body.getPosition();
  }

  snapshot(): void {
    const p = this.body.getPosition();
    this.prevX = p.x;
    this.prevY = p.y;
  }

  update(dt: number): void {
    this.life -= dt;
    const p = this.body.getPosition();
    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
  }

  destroy(physics: PhysicsManager): void {
    if (!this.alive) return;
    this.alive = false;
    physics.removeBody(this.body);
  }

  /** False after destroy() queued the body for removal. */
  alive = true;
}
