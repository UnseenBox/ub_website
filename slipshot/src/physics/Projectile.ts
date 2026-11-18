import * as planck from 'planck';
import type { ShotSpec } from '../game/catalog';
import { addMassFixtures, circleShape } from './shapes';
import type { PhysicsManager } from './PhysicsManager';
import type { Tag } from './tags';

const TRAIL_LENGTH = 9;

/**
 * A slime blob in flight. It is a dynamic bullet body (continuous collision),
 * so gravity, drag, bounce and the impulse on impact come from the solver.
 * Its behaviour (size, bounces, lift, homing, fuse, boomerang and so on) comes
 * from its ShotSpec. Mechanics.ts applies the per-step parts.
 */
export class Projectile {
  readonly body: planck.Body;
  readonly ownerId: number;
  readonly shot: ShotSpec;
  readonly radius: number;
  readonly color: string;
  readonly isChild: boolean;
  /** Seconds until it expires in flight. */
  life: number;
  /** Set once its impact has been processed, so it cannot hit twice. */
  consumed = false;
  /** False after destroy() queued the body for removal. */
  alive = true;
  /** Terrain bounces left before it splats. */
  bouncesLeft: number;
  /** Physics time of the last bounce, to stop one bounce counting twice. */
  lastBounce = -10;
  /** Seconds of lift left. */
  liftLeft: number;
  /** Seconds until a fuse goes off. */
  fuseLeft: number;
  /** Seconds until a boomerang turns back. */
  boomerangLeft: number;
  /** True once a boomerang is heading back to its thrower. */
  returning = false;
  /** Characters a piercing shot has already hit. */
  readonly hitTargets = new Set<unknown>();
  /** Recent world positions, newest last, for the trail. */
  readonly trail: planck.Vec2Value[] = [];
  prevX: number;
  prevY: number;
  /** Per-blob phase for the wobble visual. */
  readonly seed = Math.random() * 10;

  constructor(
    physics: PhysicsManager,
    ownerId: number,
    position: planck.Vec2Value,
    velocity: planck.Vec2Value,
    shot: ShotSpec,
    isChild = false,
  ) {
    this.ownerId = ownerId;
    this.shot = shot;
    this.radius = shot.radius;
    this.color = shot.color;
    this.isChild = isChild;
    this.life = isChild ? 3.5 : shot.boomerang > 0 ? 6 : 7;
    this.bouncesLeft = shot.bounces;
    this.liftLeft = shot.liftTime;
    this.fuseLeft = shot.fuse;
    this.boomerangLeft = shot.boomerang;
    this.body = physics.world.createBody({
      type: 'dynamic',
      position: { x: position.x, y: position.y },
      linearDamping: shot.drag,
      angularDamping: 0.2,
    });
    this.body.setBullet(true);

    const tag: Tag = { kind: 'projectile', proj: this };
    addMassFixtures(
      this.body,
      [{ ...circleShape({ x: 0, y: 0 }, this.radius), userData: tag, friction: 0.6 }],
      shot.mass,
      // Same negative group as the shooter's parts: the shooter cannot hit itself.
      { friction: 0.6, restitution: shot.restitution, filterGroupIndex: -ownerId },
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
}
