import type { RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink, type StepInfo } from './Mechanic';

export const PIPE_RADIUS = 27;
/** The ball has to be this close to the middle of the hole to drop in. */
const CATCH = 21;
/** A ball that trickles in is spat out with at least this pace, so it never dies underground. */
const MIN_EXIT = 520;

/**
 * Two manholes joined under the street. The ball goes in one and pops out of the other with
 * the same speed and direction, so where you enter from decides where it goes next.
 */
export class Pipe extends Mechanic {
  readonly x: number;
  readonly y: number;
  readonly outX: number;
  readonly outY: number;
  /** 1 as the ball passes through, easing to 0. */
  flash = 0;
  private armed = true;

  constructor(def: { x: number; y: number; outX: number; outY: number }) {
    super();
    this.x = def.x;
    this.y = def.y;
    this.outX = def.outX;
    this.outY = def.outY;
  }

  override reset(): void {
    this.armed = true;
  }

  override after(ball: RigidBody, _info: StepInfo, sink: MechSink | null): void {
    if (!this.armed) return;
    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    if (dx * dx + dy * dy > CATCH * CATCH) return;
    // Once per shot: a ball that rolls back over the hole just rolls over it.
    this.armed = false;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0 && speed < MIN_EXIT) {
      ball.vx *= MIN_EXIT / speed;
      ball.vy *= MIN_EXIT / speed;
    }
    ball.x = this.outX;
    ball.y = this.outY;
    this.flash = 1;
    sink?.({ kind: 'pipe', x: this.x, y: this.y, strength: 1 });
  }

  override tick(dt: number): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
  }
}
