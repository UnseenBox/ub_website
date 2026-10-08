import { VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { Room } from '../world/Room';
import { withAlpha, type Ctx } from './DrawUtils';

/**
 * Lighting by compositing, not per pixel.
 *
 * A half-resolution mask is filled with darkness, then every lamp punches a soft
 * hole in it with destination-out. The mask is drawn over the finished scene, and
 * a second additive pass puts the colour of each lamp back in. Two passes, a
 * handful of gradients, and the room reads as dark but legible.
 */
export class Lighting {
  private readonly mask: HTMLCanvasElement;
  private readonly maskCtx: Ctx;
  private readonly scale = 0.5;

  constructor() {
    this.mask = document.createElement('canvas');
    this.mask.width = Math.ceil(VIEW.width * this.scale);
    this.mask.height = Math.ceil(VIEW.height * this.scale);
    const c = this.mask.getContext('2d');
    if (!c) throw new Error('2D context unavailable for the lighting mask');
    this.maskCtx = c;
  }

  /** Darkness pass. Draw after the scene, before the cursor and UI. */
  drawShadows(ctx: Ctx, room: Room, extraDark: number): void {
    const m = this.maskCtx;
    const s = this.scale;
    const w = this.mask.width;
    const h = this.mask.height;

    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    // Capped so an unlit corner still has shape in it. Pitch black hides the room
    // from the player without hiding the player from anything.
    const base = clamp01((1 - room.ambient) * 0.82 + extraDark);
    m.clearRect(0, 0, w, h);
    m.fillStyle = `rgba(2,4,7,${base.toFixed(3)})`;
    m.fillRect(0, 0, w, h);

    m.globalCompositeOperation = 'destination-out';
    for (const light of room.lights) {
      if (!light.on) continue;
      const strength = clamp01(light.intensity * light.flicker);
      if (strength <= 0.01) continue;
      const r = light.radius * s;
      const x = light.x * s;
      const y = light.y * s;
      const g = m.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(1, strength * 1.6).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(0,0,0,${Math.min(1, strength * 0.95).toFixed(3)})`);
      g.addColorStop(0.75, `rgba(0,0,0,${(strength * 0.4).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.fillRect(x - r, y - r, r * 2, r * 2);
    }
    m.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mask, 0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }

  /** Colour pass. Puts the warmth of each lamp back on top of the darkness. */
  drawGlow(ctx: Ctx, room: Room): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const light of room.lights) {
      if (!light.on) continue;
      const strength = clamp01(light.intensity * light.flicker);
      if (strength <= 0.01) continue;
      const r = light.radius * 0.85;
      const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, r);
      g.addColorStop(0, withAlpha(light.tint, 0.1 * strength));
      g.addColorStop(0.6, withAlpha(light.tint, 0.035 * strength));
      g.addColorStop(1, withAlpha(light.tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(light.x - r, light.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /**
   * Vignette plus a hint of distortion that grows with how worked up the room is.
   * Never allowed to obscure the play field: it only closes in at the corners.
   */
  drawVignette(ctx: Ctx, tension: number, reduced: boolean): void {
    const strength = reduced ? 0.3 : 0.42 + tension * 0.3;
    const cx = VIEW.width * 0.5;
    const cy = VIEW.height * 0.5;
    const inner = VIEW.width * (reduced ? 0.46 : 0.4 - tension * 0.06);
    const outer = VIEW.width * 0.78;
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(2,3,6,${strength.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    if (!reduced && tension > 0.55) {
      // A faint red breath at the edges, only at real danger.
      const a = (tension - 0.55) * 0.3;
      const r = ctx.createRadialGradient(cx, cy, VIEW.width * 0.34, cx, cy, outer);
      r.addColorStop(0, 'rgba(0,0,0,0)');
      r.addColorStop(1, `rgba(255,84,104,${a.toFixed(3)})`);
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }
}
