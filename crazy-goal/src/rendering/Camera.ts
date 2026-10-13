import { clamp, damp } from '../core/math';

export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A world rectangle that must always be on screen. */
export interface Frame {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Below this width-to-height ratio the window counts as portrait. */
export const PORTRAIT_ASPECT = 0.85;

const ZOOM_MAX = 0.16;
const SHAKE_PIXELS = 15;
const KICK_STIFFNESS = 260;
const KICK_DAMPING = 24;

/**
 * Fixed camera that fits the level to any window without distorting it, plus the small
 * movements that sell an impact: trauma-based shake, a spring "kick", and a zoom towards a point.
 */
export class Camera {
  /** CSS pixel size of the canvas, and the backing-store ratio. */
  width = 1;
  height = 1;
  dpr = 1;
  /** CSS pixels per world unit at zoom 1. */
  scale = 1;
  portrait = false;
  /** World rectangle visible at rest. */
  readonly visible: ViewRect = { x: 0, y: 0, w: 1600, h: 900 };
  /**
   * How much to enlarge HUD text so it stays legible when the level is drawn small (phones).
   * 1 on a desktop-sized window.
   */
  hudScale = 1;
  /** 1 for full shake, lower for the reduced-motion setting. */
  shakeScale = 1;

  private landscape: Frame = { cx: 800, cy: 450, w: 1600, h: 900 };
  private portraitFrame: Frame = { cx: 800, cy: 450, w: 900, h: 1600 };
  private baseX = 800;
  private baseY = 450;
  private zoomAmount = 0;
  private zoomTarget = 0;
  private focusX = 0;
  private focusY = 0;
  private lookX = 0;
  private lookY = 0;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private kickX = 0;
  private kickY = 0;
  private kickVX = 0;
  private kickVY = 0;
  private clock = 0;

  /** Result of the last `toWorld` call. */
  worldX = 0;
  worldY = 0;

  /** The level decides what has to fit: one frame with the HUD beside the pitch, one with it above. */
  setFrames(landscape: Frame, portrait: Frame): void {
    this.landscape = landscape;
    this.portraitFrame = portrait;
    this.resize(this.width, this.height, this.dpr);
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = dpr;
    this.portrait = this.width / this.height < PORTRAIT_ASPECT;
    const frame = this.portrait ? this.portraitFrame : this.landscape;
    this.scale = Math.min(this.width / frame.w, this.height / frame.h);
    this.hudScale = this.portrait ? clamp(0.78 / this.scale, 1, 1.7) : clamp(0.72 / this.scale, 1, 1.2);
    this.baseX = frame.cx;
    this.baseY = frame.cy;
    const v = this.visible;
    v.w = this.width / this.scale;
    v.h = this.height / this.scale;
    v.x = this.baseX - v.w / 2;
    v.y = this.baseY - v.h / 2;
  }

  /** 0 to 1. Shake grows with the square of trauma, so small hits barely register. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** A shove in world units that springs back. */
  kick(x: number, y: number): void {
    this.kickVX += x * 60;
    this.kickVY += y * 60;
  }

  zoomTo(x: number, y: number, amount: number): void {
    this.focusX = x;
    this.focusY = y;
    this.zoomTarget = amount;
  }

  zoomOut(): void {
    this.zoomTarget = 0;
  }

  /** `lookX, lookY` is a world point to lean towards slightly (the ball). Runs on real time. */
  update(dt: number, lookX: number, lookY: number): void {
    this.clock += dt;
    this.zoomAmount = damp(this.zoomAmount, this.zoomTarget, this.zoomTarget > this.zoomAmount ? 9 : 6, dt);
    this.lookX = damp(this.lookX, (lookX - this.baseX) * 0.035, 4, dt);
    this.lookY = damp(this.lookY, (lookY - this.baseY) * 0.035, 4, dt);

    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const amp = this.trauma * this.trauma * SHAKE_PIXELS * this.shakeScale;
    const t = this.clock;
    // Sums of sines at unrelated rates: smooth, never repeating visibly, no allocation.
    this.shakeX = amp * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 37.1 + 1.7) * 0.4);
    this.shakeY = amp * (Math.sin(t * 53.9 + 0.6) * 0.6 + Math.sin(t * 41.7 + 2.9) * 0.4);

    this.kickVX += (-KICK_STIFFNESS * this.kickX - KICK_DAMPING * this.kickVX) * dt;
    this.kickVY += (-KICK_STIFFNESS * this.kickY - KICK_DAMPING * this.kickVY) * dt;
    this.kickX += this.kickVX * dt;
    this.kickY += this.kickVY * dt;
  }

  private get zoom(): number {
    return 1 + this.zoomAmount * ZOOM_MAX;
  }

  private get centreX(): number {
    return this.baseX + this.lookX + (this.focusX - this.baseX) * this.zoomAmount * 0.5;
  }

  private get centreY(): number {
    return this.baseY + this.lookY + (this.focusY - this.baseY) * this.zoomAmount * 0.5;
  }

  /** World transform with every effect applied. */
  applyWorld(ctx: CanvasRenderingContext2D): void {
    const k = this.scale * this.zoom * this.dpr;
    const s = this.shakeScale * this.scale;
    const tx = (this.width / 2 + this.shakeX + this.kickX * s) * this.dpr - this.centreX * k;
    const ty = (this.height / 2 + this.shakeY + this.kickY * s) * this.dpr - this.centreY * k;
    ctx.setTransform(k, 0, 0, k, tx, ty);
  }

  /** World units, but rock steady: for the HUD. */
  applyHud(ctx: CanvasRenderingContext2D): void {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, (this.width / 2) * this.dpr - this.baseX * k, (this.height / 2) * this.dpr - this.baseY * k);
  }

  /** Canvas CSS pixels to world units. Ignores shake so aiming never jitters. */
  toWorld(px: number, py: number): void {
    const k = this.scale * this.zoom;
    this.worldX = (px - this.width / 2) / k + this.centreX;
    this.worldY = (py - this.height / 2) / k + this.centreY;
  }
}
