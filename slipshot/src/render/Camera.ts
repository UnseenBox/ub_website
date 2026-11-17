import { clamp, randRange, smoothFactor } from '../util/math';

export interface WorldPoint {
  x: number;
  y: number;
}

/**
 * Keeps the player, living enemies and the projectile in view. Framing is
 * smoothed so it does not snap. Shake is a trauma value that decays quickly.
 * `apply()` sets a y-up world transform on the canvas.
 */
export class Camera {
  /** Current centre in world metres. */
  x = 0;
  y = 1.3;
  /** Current zoom in CSS pixels per metre. */
  scale = 55;
  private viewW = 800;
  private viewH = 600;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private initialized = false;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  frame(dt: number, points: WorldPoint[]): void {
    let minX = -4;
    let maxX = 4;
    let minY = -0.8;
    let maxY = 3.4;
    if (points.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      minY = Math.min(-0.8, -0.5);
      maxY = 3.4;
      for (const p of points) {
        minX = Math.min(minX, p.x - 2.2);
        maxX = Math.max(maxX, p.x + 2.2);
        maxY = Math.max(maxY, p.y + 1.2);
        minY = Math.min(minY, p.y - 0.5);
      }
    }
    const w = Math.max(maxX - minX, 20);
    const h = Math.max(maxY - minY, 10.5);
    const targetScale = clamp(Math.min(this.viewW / w, this.viewH / h), 12, 110);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const k = this.initialized ? smoothFactor(3.2, dt) : 1;
    this.initialized = true;
    this.x += (cx - this.x) * k;
    this.y += (cy - this.y) * k;
    this.scale += (targetScale - this.scale) * k;

    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const amp = this.trauma * this.trauma * 0.32;
    this.shakeX = amp * randRange(-1, 1);
    this.shakeY = amp * randRange(-1, 1);
  }

  /** World-to-canvas transform in CSS pixels (y flipped so world y points up). */
  apply(ctx: CanvasRenderingContext2D, dpr: number): void {
    const s = this.scale * dpr;
    ctx.setTransform(s, 0, 0, -s, dpr * (this.viewW / 2 - this.x * this.scale + this.shakeX * this.scale), dpr * (this.viewH / 2 + this.y * this.scale + this.shakeY * this.scale));
  }

  /** World point to CSS pixels (for DOM and screen-space drawing). */
  toScreen(p: WorldPoint): WorldPoint {
    return {
      x: this.viewW / 2 + (p.x - this.x) * this.scale + this.shakeX * this.scale,
      y: this.viewH / 2 - (p.y - this.y) * this.scale + this.shakeY * this.scale,
    };
  }

  /** Pixels per metre, unshaken. */
  get pxPerMeter(): number {
    return this.scale;
  }
}
