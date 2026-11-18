import { clamp, randRange, smoothFactor } from '../util/math';

export interface WorldPoint {
  x: number;
  y: number;
}

/** Lowest world y the view shows: a little of the void below the islands, so falls are visible. */
const VIEW_BOTTOM = -5.5;
/** Minimum world height on screen, in metres. */
const MIN_VIEW_HEIGHT = 10.5;

/**
 * Keeps the player, living enemies and the projectile in view. The floor sits
 * low on screen so most of the frame shows sky and action. Framing is smoothed
 * so it does not snap, and shake is a trauma value that decays quickly.
 * `apply()` sets a y-up world transform on the canvas.
 */
export class Camera {
  /** Current centre in world metres. */
  x = 0;
  y = 3;
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
    // Horizontal extent: the points plus a margin, at least 20 m wide.
    let minX = -4;
    let maxX = 4;
    // Vertical extent: from the bottom of the view up to the highest point.
    let top = 3.4;
    if (points.length > 0) {
      minX = Infinity;
      maxX = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x - 2.2);
        maxX = Math.max(maxX, p.x + 2.2);
        top = Math.max(top, p.y + 1.2);
      }
    }
    const w = Math.max(maxX - minX, 20);
    const h = Math.max(top - VIEW_BOTTOM, MIN_VIEW_HEIGHT);
    const targetScale = clamp(Math.min(this.viewW / w, this.viewH / h), 12, 110);
    const cx = (minX + maxX) / 2;
    const cy = VIEW_BOTTOM + h / 2;

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

  /** CSS pixels (canvas-relative) to world metres, ignoring shake. */
  toWorld(p: WorldPoint): WorldPoint {
    return {
      x: this.x + (p.x - this.viewW / 2) / this.scale,
      y: this.y - (p.y - this.viewH / 2) / this.scale,
    };
  }

  /** Pixels per metre, unshaken. */
  get pxPerMeter(): number {
    return this.scale;
  }
}
