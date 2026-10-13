import { circle, Layer } from '../physics/Collider';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { createBody, type RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

export const BUMPER_RADIUS = 34;
/** The ball leaves at least this fast, however gently it arrived. */
const MIN_KICK = 860;
const BOOST = 1.5;
const TOP_SPEED = 2400;

/**
 * A pinball bumper bolted to the street. Hotter than a tyre stack: it kicks the ball
 * away hard, flashes, and counts as its own style label (PINBALL WIZARD).
 */
export class Bumper extends Mechanic {
  readonly x: number;
  readonly y: number;
  /** 1 at the moment of a hit, easing to 0: drives the flash. */
  hit = 0;
  /** Burnt away by a HARISSA shot. */
  gone = false;
  private readonly body: RigidBody;

  constructor(def: { x: number; y: number }, world: PhysicsWorld) {
    super();
    this.x = def.x;
    this.y = def.y;
    this.sortY = def.y;
    this.body = world.addStatic(createBody({ shape: circle(BUMPER_RADIUS), surface: 'bumper', x: def.x, y: def.y, restitution: 1.02, friction: 0.02 }));
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
    sink?.({ kind: 'bumper', x: this.x, y: this.y, strength: Math.min(1, impact / 1300) });
  }

  override tick(dt: number): void {
    if (this.hit > 0) this.hit = Math.max(0, this.hit - dt * 2.6);
  }
}
