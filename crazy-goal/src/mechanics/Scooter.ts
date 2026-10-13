import { box } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const SCOOTER_LENGTH = 112;
export const SCOOTER_WIDTH = 46;
/** Seconds spent turning round at each end. */
const TURN_PAUSE = 0.45;

/**
 * A scooter riding back and forth across the alley. It never stops for the ball, and it does
 * not reset between shots: reading its timing is the puzzle.
 */
export class Scooter extends Mechanic {
  readonly body: RigidBody;
  /** +1 riding towards the second point, -1 riding back. */
  heading = 1;
  /** 1 at the moment of a hit, easing to 0. */
  hit = 0;
  private t = 0;
  private pause = 0;
  private readonly length: number;
  private readonly ux: number;
  private readonly uy: number;

  constructor(
    private readonly def: { x1: number; y1: number; x2: number; y2: number; speed: number },
    world: PhysicsWorld,
  ) {
    super();
    const dx = def.x2 - def.x1;
    const dy = def.y2 - def.y1;
    this.length = Math.hypot(dx, dy) || 1;
    this.ux = dx / this.length;
    this.uy = dy / this.length;
    this.body = world.addMover(
      createBody({ shape: box(SCOOTER_LENGTH, SCOOTER_WIDTH), surface: 'scooter', x: def.x1, y: def.y1, angle: Math.atan2(dy, dx), restitution: 0.9, friction: 0.15 }),
    );
    this.bodies.push(this.body);
    this.sortY = def.y1;
  }

  override move(dt: number): void {
    const b = this.body;
    if (this.pause > 0) {
      this.pause -= dt;
      b.vx = 0;
      b.vy = 0;
      return;
    }
    this.t += (this.heading * this.def.speed * dt) / this.length;
    if (this.t >= 1 || this.t <= 0) {
      this.t = this.t >= 1 ? 1 : 0;
      this.heading = -this.heading;
      this.pause = TURN_PAUSE;
    }
    b.x = this.def.x1 + this.ux * this.length * this.t;
    b.y = this.def.y1 + this.uy * this.length * this.t;
    b.vx = this.ux * this.def.speed * -this.heading * -1;
    b.vy = this.uy * this.def.speed * -this.heading * -1;
    if (this.pause > 0) {
      b.vx = 0;
      b.vy = 0;
    }
    this.sortY = b.y;
  }

  /** Where it is on its run, as whole numbers, so a duel replay can put it back exactly. */
  state(): number[] {
    return [Math.round(this.t * 10000), this.heading, Math.round(this.pause * 1000)];
  }

  restore(t: number, heading: number, pause: number): void {
    this.t = Math.min(1, Math.max(0, t / 10000));
    this.heading = heading < 0 ? -1 : 1;
    this.pause = Math.max(0, pause / 1000);
    this.body.x = this.def.x1 + this.ux * this.length * this.t;
    this.body.y = this.def.y1 + this.uy * this.length * this.t;
    this.sortY = this.body.y;
  }

  override contact(_other: RigidBody, impact: number, ball: RigidBody, sink: MechSink | null): void {
    if (impact < 40) return;
    this.hit = 1;
    sink?.({ kind: 'scooter', x: ball.x, y: ball.y, strength: Math.min(1, impact / 1200) });
  }

  override tick(dt: number): void {
    if (this.hit > 0) this.hit = Math.max(0, this.hit - dt * 3);
  }
}
