import { box } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const SPINNER_THICKNESS = 30;

/**
 * A spinning bar around a centre post (a turnstile, a revolving gate). It turns at a
 * steady `speed` radians per second and never stops: the ball must be timed through the
 * gap. The bar is a kinematic mover so the ball bounces off it; on top of the bounce it
 * gets a shove from the spin, and announces a SPIN event for style + sound.
 */
export class Spinner extends Mechanic {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly speed: number;
  readonly body: RigidBody;
  /** 1 at the moment of a hit, easing to 0. */
  hit = 0;
  private angle = 0;

  constructor(def: { x: number; y: number; w?: number; speed?: number }, world: PhysicsWorld) {
    super();
    this.x = def.x;
    this.y = def.y;
    this.w = def.w ?? 240;
    this.speed = def.speed ?? 1.1;
    this.body = world.addMover(
      createBody({ shape: box(this.w, SPINNER_THICKNESS), surface: 'spinner', x: def.x, y: def.y, angle: 0, restitution: 0.92, friction: 0.06 }),
    );
    this.bodies.push(this.body);
    this.sortY = def.y;
  }

  override move(dt: number): void {
    this.angle += this.speed * dt;
    const b = this.body;
    b.angle = this.angle;
    b.cos = Math.cos(this.angle);
    b.sin = Math.sin(this.angle);
    // The bar stays centred; its tip speed shoves the ball on contact instead.
    b.vx = 0;
    b.vy = 0;
    this.sortY = this.y;
  }

  /** Angle + hit flash, so a duel replay can put it back exactly. */
  state(): number[] {
    return [this.angle, this.hit];
  }

  restore(angle: number, hit: number): void {
    this.angle = angle;
    this.hit = hit;
    this.body.angle = angle;
    this.body.cos = Math.cos(angle);
    this.body.sin = Math.sin(angle);
  }

  override contact(_other: RigidBody, impact: number, ball: RigidBody, sink: MechSink | null): void {
    if (impact < 40) return;
    // A shove along the bar's motion at the contact point: tip velocity = w/2 * speed,
    // directed perpendicular to the radius. Approximate with the bar direction.
    const tip = (this.w / 2) * this.speed;
    const px = ball.x - this.x;
    const py = ball.y - this.y;
    const r = Math.hypot(px, py) || 1;
    // Tangential direction of rotation.
    const tx = (-py / r) * Math.sign(this.speed);
    const ty = (px / r) * Math.sign(this.speed);
    const shove = Math.min(tip, 420) * Math.min(1, r / (this.w / 2));
    ball.vx += tx * shove * 0.55;
    ball.vy += ty * shove * 0.55;
    this.hit = 1;
    sink?.({ kind: 'spin', x: ball.x, y: ball.y, strength: Math.min(1, impact / 1200) });
  }

  override tick(dt: number): void {
    if (this.hit > 0) this.hit = Math.max(0, this.hit - dt * 3);
  }
}
