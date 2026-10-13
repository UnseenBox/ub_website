import type { RigidBody } from '../physics/RigidBody';
import { Mechanic, type MechSink } from './Mechanic';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (r: Rect, b: RigidBody): boolean => Math.abs(b.x - r.x) < r.w / 2 && Math.abs(b.y - r.y) < r.h / 2;

/**
 * A fan blowing across the street: a gusty wind that pushes the ball along `angle`
 * while it is inside. Unlike a boost strip it breathes (strength swells with time),
 * and it announces WIND the first time it grabs the ball each shot, for style + sound.
 */
export class Fan extends Mechanic {
  readonly dirX: number;
  readonly dirY: number;
  private t = 0;
  private wasIn = false;

  constructor(
    readonly rect: Rect,
    readonly angle: number,
    readonly strength: number,
  ) {
    super();
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
  }

  override reset(): void {
    this.wasIn = false;
  }

  override move(dt: number, ball: RigidBody, live: boolean, sink: MechSink | null): void {
    this.t += dt;
    if (!live || !inside(this.rect, ball)) {
      this.wasIn = false;
      return;
    }
    // Gusts: 75% to 125% of base strength on a slow swell plus a fast flutter.
    const gust = 1 + 0.22 * Math.sin(this.t * 2.3) + 0.08 * Math.sin(this.t * 7.7);
    ball.ax += this.dirX * this.strength * gust;
    ball.ay += this.dirY * this.strength * gust;
    if (!this.wasIn) sink?.({ kind: 'wind', x: ball.x, y: ball.y, strength: Math.min(1, Math.hypot(ball.vx, ball.vy) / 1200) });
    this.wasIn = true;
  }
}
