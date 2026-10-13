import { circle, Layer } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const TYRE_RADIUS = 30;
/** The ball leaves at least this fast, however gently it arrived. */
const MIN_KICK = 640;
const BOOST = 1.3;
const TOP_SPEED = 2100;

/** A stack of old tyres. Rubber gives back more than it gets. */
export class Tyre extends Mechanic {
  readonly x: number;
  readonly y: number;
  /** 1 at the moment of a hit, easing to 0: drives the wobble. */
  hit = 0;
  /** Burnt away by a HARISSA shot. */
  gone = false;
  private readonly body: RigidBody;

  constructor(def: { x: number; y: number }, world: PhysicsWorld) {
    super();
    this.x = def.x;
    this.y = def.y;
    this.sortY = def.y;
    this.body = world.addStatic(createBody({ shape: circle(TYRE_RADIUS), surface: 'tyre', x: def.x, y: def.y, restitution: 0.95, friction: 0.05 }));
    this.bodies.push(this.body);
  }

  override reset(): void {
    this.gone = false;
    this.body.layer = Layer.Solid;
  }

  override burnable(): boolean {
    return !this.gone;
  }

  override burn(): void {
    this.gone = true;
    this.body.layer = 0;
  }

  override contact(_other: RigidBody, impact: number, ball: RigidBody, sink: MechSink | null): void {
    if (impact < 30) return;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const target = Math.min(TOP_SPEED, Math.max(MIN_KICK, speed * BOOST));
      ball.vx *= target / speed;
      ball.vy *= target / speed;
    }
    this.hit = 1;
    sink?.({ kind: 'boing', x: this.x, y: this.y, strength: Math.min(1, impact / 1200) });
  }

  override tick(dt: number): void {
    if (this.hit > 0) this.hit = Math.max(0, this.hit - dt * 3);
  }
}
