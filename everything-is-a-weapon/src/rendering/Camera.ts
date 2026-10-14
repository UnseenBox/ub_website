import { WALL } from '../core/constants';

const MAX_SHAKE_OFFSET = 13;
const SHAKE_DECAY = 1.9;
const HUD_MARGIN_TOP = 58;
const VIEW_PADDING = 18;
/** Below this zoom the room is too small to play (phones), so the camera zooms in and follows instead. */
const MIN_PLAYABLE_SCALE = 0.72;

/**
 * Fits the whole room on screen at any aspect ratio and owns every kind of screen
 * disturbance (trauma-based shake, directional kicks, zoom punches) in one place.
 */
export class Camera {
  /** CSS-pixel size of the canvas. */
  width = 1;
  height = 1;
  dpr = 1;
  /** World units → CSS pixels. */
  scale = 1;
  centerX = 0;
  centerY = 0;

  shakeScale = 1;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private kickX = 0;
  private kickY = 0;
  private zoom = 1;
  private zoomPunch = 0;
  private time = 0;
  private roomW = 800;
  private roomH = 500;
  /** True when the whole room does not fit at a playable size and the view tracks the player. */
  following = false;
  private snap = true;

  // What is actually on screen this frame: the resting centre plus any dramatic push-in.
  private viewX = 0;
  private viewY = 0;
  private focusX = 0;
  private focusY = 0;
  private focusLeft = 0;
  private focusTotal = 1;
  private focusZoom = 1;

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dpr = dpr;
    this.fit();
  }

  setRoom(width: number, height: number): void {
    this.roomW = width;
    this.roomH = height;
    this.snap = true;
    this.fit();
  }

  private fit(): void {
    const viewW = this.roomW + WALL * 2 + VIEW_PADDING * 2;
    const viewH = this.roomH + WALL * 2 + VIEW_PADDING * 2 + HUD_MARGIN_TOP;
    const fitScale = Math.min(this.width / viewW, this.height / viewH);
    this.following = fitScale < MIN_PLAYABLE_SCALE;
    this.scale = this.following ? MIN_PLAYABLE_SCALE : fitScale;
    if (!this.following) {
      this.centerX = this.roomW / 2;
      this.centerY = this.roomH / 2 - HUD_MARGIN_TOP / 2 + 6;
    }
    this.viewX = this.centerX;
    this.viewY = this.centerY;
  }

  /** Keeps the player in view on small screens without ever showing beyond the room's walls. */
  follow(x: number, y: number, dt: number): void {
    if (!this.following) return;
    const halfW = this.width / (2 * this.scale);
    const halfH = this.height / (2 * this.scale);
    const edge = WALL + VIEW_PADDING;
    const minX = -edge + halfW;
    const maxX = this.roomW + edge - halfW;
    const minY = -edge - HUD_MARGIN_TOP + halfH;
    const maxY = this.roomH + edge - halfH;
    const tx = minX > maxX ? this.roomW / 2 : Math.min(maxX, Math.max(minX, x));
    const ty = minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, y));
    const k = this.snap ? 1 : Math.min(1, 7 * dt);
    this.snap = false;
    this.centerX += (tx - this.centerX) * k;
    this.centerY += (ty - this.centerY) * k;
  }

  /** Adds trauma (0..1). Shake amount is trauma squared, so small hits barely register. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** One-off directional shove, e.g. recoil from a throw. */
  kick(x: number, y: number): void {
    this.kickX += x;
    this.kickY += y;
  }

  punchZoom(amount: number): void {
    this.zoomPunch = Math.max(this.zoomPunch, amount);
  }

  /** Eases in on a point and back out again — the final-blow close-up. */
  focus(x: number, y: number, seconds: number, zoom: number): void {
    this.focusX = x;
    this.focusY = y;
    this.focusLeft = this.focusTotal = seconds;
    this.focusZoom = zoom;
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - SHAKE_DECAY * dt);
    const shake = this.trauma * this.trauma * MAX_SHAKE_OFFSET * this.shakeScale;
    // Two out-of-phase sines per axis: smooth, non-repeating enough, and no allocation.
    this.shakeX = shake * (Math.sin(this.time * 71) * 0.6 + Math.sin(this.time * 113 + 1.3) * 0.4);
    this.shakeY = shake * (Math.sin(this.time * 83 + 2.1) * 0.6 + Math.sin(this.time * 127 + 0.4) * 0.4);
    const settle = Math.exp(-14 * dt);
    this.kickX *= settle;
    this.kickY *= settle;
    this.zoomPunch *= Math.exp(-7 * dt);
    this.zoom = 1 + this.zoomPunch * this.shakeScale;

    this.viewX = this.centerX;
    this.viewY = this.centerY;
    if (this.focusLeft > 0) {
      this.focusLeft -= dt;
      const t = 1 - Math.max(0, this.focusLeft) / this.focusTotal;
      // fast in, linger, ease out
      const k = Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.55) * this.shakeScale;
      this.zoom *= 1 + (this.focusZoom - 1) * k;
      this.viewX += (this.focusX - this.centerX) * 0.42 * k;
      this.viewY += (this.focusY - this.centerY) * 0.42 * k;
    }
  }

  /** Sets the canvas transform so drawing happens in world units. */
  apply(ctx: CanvasRenderingContext2D): void {
    const s = this.scale * this.zoom * this.dpr;
    const ox = (this.width / 2) * this.dpr - (this.viewX + this.shakeX + this.kickX * this.shakeScale) * s;
    const oy = (this.height / 2) * this.dpr - (this.viewY + this.shakeY + this.kickY * this.shakeScale) * s;
    ctx.setTransform(s, 0, 0, s, ox, oy);
  }

  screenToWorld = (x: number, y: number, out: { x: number; y: number }): void => {
    const s = this.scale * this.zoom;
    out.x = (x - this.width / 2) / s + this.viewX;
    out.y = (y - this.height / 2) / s + this.viewY;
  };

  worldToScreen(x: number, y: number, out: { x: number; y: number }): void {
    const s = this.scale * this.zoom;
    out.x = (x - this.viewX) * s + this.width / 2;
    out.y = (y - this.viewY) * s + this.height / 2;
  }
}
