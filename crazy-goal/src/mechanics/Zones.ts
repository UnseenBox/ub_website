import type { RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (r: Rect, b: RigidBody): boolean => Math.abs(b.x - r.x) < r.w / 2 && Math.abs(b.y - r.y) < r.h / 2;

/** Extra drag per second while the ball is in sand. */
const SAND_DRAG = 3.6;

export type GroundKind = 'sand' | 'grass' | 'water' | 'ice';

/**
 * A patch of ground that changes the ball's pace while it is on it. Sand, long grass and
 * puddles bog it down by `drag` per second; ice has a negative drag, which cancels the
 * ball's own slowing so it glides.
 */
export class Sand extends Mechanic {
  private wasIn = false;

  constructor(
    readonly rect: Rect,
    private readonly drag = SAND_DRAG,
    readonly kind: GroundKind = 'sand',
  ) {
    super();
  }

  override reset(): void {
    this.wasIn = false;
  }

  override move(dt: number, ball: RigidBody, live: boolean, sink: MechSink | null): void {
    if (!live) return;
    const isIn = inside(this.rect, ball);
    if (isIn) {
      const k = Math.exp(-this.drag * dt);
      ball.vx *= k;
      ball.vy *= k;
      if (!this.wasIn && this.drag > 0) sink?.({ kind: 'sand', x: ball.x, y: ball.y, strength: Math.min(1, Math.hypot(ball.vx, ball.vy) / 1200) });
    }
    this.wasIn = isIn;
  }
}

/** A stretch of street that runs downhill. The ball is pulled along it for as long as it is on it. */
export class Slope extends Mechanic {
  readonly dirX: number;
  readonly dirY: number;

  constructor(
    readonly rect: Rect,
    readonly angle: number,
    private readonly strength: number,
    /** A strip of arrows rather than a tilted street: same push, different look. */
    readonly boost = false,
  ) {
    super();
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
  }

  override move(_dt: number, ball: RigidBody, live: boolean): void {
    if (!live || !inside(this.rect, ball)) return;
    ball.ax += this.dirX * this.strength;
    ball.ay += this.dirY * this.strength;
  }
}
