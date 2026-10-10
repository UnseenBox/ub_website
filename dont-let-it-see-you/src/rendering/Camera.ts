import { FEEL, VIEW } from '../core/Tuning';
import { approach, clamp } from '../core/Mathx';
import type { Ctx } from './DrawUtils';

/**
 * A mostly fixed camera. Rooms are one screen, so the camera exists only to
 * punch: a shake when something lands, a hair of zoom when a creature notices.
 */
export class Camera {
  shake = 0;
  zoom = 1;
  targetZoom = 1;
  offsetX = 0;
  offsetY = 0;
  private shakeX = 0;
  private shakeY = 0;
  private phase = 0;
  /** Set false by the accessibility setting. */
  shakeEnabled = true;

  reset(): void {
    this.shake = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  kick(amount: number): void {
    if (!this.shakeEnabled) return;
    this.shake = Math.min(FEEL.maxShake, this.shake + amount);
  }

  /** Pull in slightly. Used for the beat where something notices you. */
  push(zoom: number): void {
    this.targetZoom = clamp(zoom, 0.96, 1.12);
  }

  update(dt: number): void {
    this.phase += dt * 48;
    this.shake = approach(this.shake, 0, FEEL.shakeDecay, dt);
    this.zoom = approach(this.zoom, this.targetZoom, 5, dt);
    if (this.shake > 0.02) {
      this.shakeX = Math.sin(this.phase * 1.7) * this.shake;
      this.shakeY = Math.cos(this.phase * 2.3) * this.shake * 0.7;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  apply(ctx: Ctx): void {
    const cx = VIEW.width * 0.5;
    const cy = VIEW.height * 0.5;
    ctx.translate(cx + this.shakeX + this.offsetX, cy + this.shakeY + this.offsetY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-cx, -cy);
  }
}
