import * as planck from 'planck';
import { boxShape, addMassFixtures, circleShape } from './shapes';
import type { PhysicsManager } from './PhysicsManager';
import type { Slimeable, Tag } from './tags';

export type ObjectKind = 'crate' | 'ball';

/** A loose object in the arena: a crate that slides or a ball that rolls. */
export class PhysicsObject implements Slimeable {
  readonly body: planck.Body;
  readonly kind: ObjectKind;
  /** Half-size for crates, radius for balls. */
  readonly size: number;
  slimeTimer = 0;
  slimeMax = 1;
  prevX: number;
  prevY: number;
  prevA: number;

  constructor(physics: PhysicsManager, kind: ObjectKind, x: number, y: number, size: number, mass: number) {
    this.kind = kind;
    this.size = size;
    this.body = physics.world.createBody({
      type: 'dynamic',
      position: { x, y },
      linearDamping: 0.05,
      angularDamping: kind === 'ball' ? 0.05 : 0.2,
    });
    const tag: Tag = { kind: 'object', obj: this };
    const shape = kind === 'crate' ? boxShape(size, size, { x: 0, y: 0 }) : circleShape({ x: 0, y: 0 }, size);
    addMassFixtures(this.body, [{ ...shape, userData: tag }], mass, {
      friction: kind === 'crate' ? 0.55 : 0.45,
      restitution: kind === 'crate' ? 0.15 : 0.35,
    });
    this.prevX = x;
    this.prevY = y;
    this.prevA = 0;
  }

  coat(duration: number): void {
    this.slimeTimer = Math.max(this.slimeTimer, duration);
    this.slimeMax = this.slimeTimer;
  }

  snapshot(): void {
    const p = this.body.getPosition();
    this.prevX = p.x;
    this.prevY = p.y;
    this.prevA = this.body.getAngle();
  }

  update(dt: number): void {
    this.slimeTimer = Math.max(0, this.slimeTimer - dt);
  }

  destroy(physics: PhysicsManager): void {
    physics.removeBody(this.body);
  }
}
