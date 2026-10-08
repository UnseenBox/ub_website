import { VIEW } from '../core/Tuning';
import { clamp01 } from '../core/Mathx';
import type { Room } from '../world/Room';
import { PALETTE, withAlpha, type Ctx } from './DrawUtils';

/**
 * A real two dimensional lighting pipeline, not a dark overlay.
 *
 * The scene is painted in pale neutral greys. Separately, a light map is built:
 * black where nothing reaches, and saturated colour where a lamp does. Multiplying
 * the scene by that map is what produces the look: unlit geometry collapses to
 * true black, and lit geometry is *stained* by whatever colour the room burns in,
 * rather than being a grey room with a tint laid on top.
 *
 * Then a single additive pass puts the glow of the sources themselves back, so
 * the bright things bloom instead of clipping flat.
 *
 * Two offscreen buffers at half resolution, a handful of gradients per frame.
 */
export class Lighting {
  private readonly map: HTMLCanvasElement;
  private readonly mapCtx: Ctx;
  private readonly scale = 0.5;

  constructor() {
    this.map = document.createElement('canvas');
    this.map.width = Math.ceil(VIEW.width * this.scale);
    this.map.height = Math.ceil(VIEW.height * this.scale);
    const c = this.map.getContext('2d');
    if (!c) throw new Error('2D context unavailable for the light map');
    this.mapCtx = c;
  }

  /**
   * Build the light map and multiply it over the scene.
   *
   * `extraDark` pushes the whole room further toward black, which is what a
   * scripted blackout does without having to switch every lamp off.
   */
  apply(ctx: Ctx, room: Room, extraDark: number): void {
    const m = this.mapCtx;
    const s = this.scale;
    const w = this.map.width;
    const h = this.map.height;

    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';

    // The floor of the light map: what the room looks like with no lamp on it.
    // Never pure black, or an unlit corner would lose its silhouette entirely.
    const ambient = clamp01(room.ambient * (1 - clamp01(extraDark)));
    const base = Math.round(9 + ambient * 42);
    m.fillStyle = `rgb(${Math.round(base * 0.82)},${base},${Math.round(base * 0.95)})`;
    m.fillRect(0, 0, w, h);

    // Each lamp adds its own colour. Additive, so overlapping lamps blow out
    // toward white exactly the way overlapping real lights do.
    m.globalCompositeOperation = 'lighter';
    for (const light of room.lights) {
      if (!light.on) continue;
      const strength = clamp01(light.intensity * light.flicker) * (1 - clamp01(extraDark));
      if (strength <= 0.01) continue;
      const r = light.radius * s;
      const x = light.x * s;
      const y = light.y * s;
      // Steeper than the falloff the gameplay uses, deliberately. Detection
      // reads `contributionAt`, which is unchanged; this curve only decides how
      // fast the picture drops into black, and a photograph drops fast.
      const g = m.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, withAlpha(light.tint, Math.min(1, strength * 1.7)));
      g.addColorStop(0.22, withAlpha(light.tint, strength * 1.0));
      g.addColorStop(0.48, withAlpha(light.tint, strength * 0.4));
      g.addColorStop(0.74, withAlpha(light.tint, strength * 0.12));
      g.addColorStop(1, withAlpha(light.tint, 0));
      m.fillStyle = g;
      m.fillRect(x - r, y - r, r * 2, r * 2);
    }
    m.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.map, 0, 0, VIEW.width, VIEW.height);
    ctx.restore();
  }

  /** The bloom of the sources themselves, added back on top of the multiply. */
  drawBloom(ctx: Ctx, room: Room, extraDark: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const light of room.lights) {
      if (!light.on) continue;
      const strength = clamp01(light.intensity * light.flicker) * (1 - clamp01(extraDark));
      if (strength <= 0.01) continue;
      const r = light.radius * 0.34;
      const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, r);
      g.addColorStop(0, withAlpha(light.tint, 0.17 * strength));
      g.addColorStop(0.4, withAlpha(light.tint, 0.05 * strength));
      g.addColorStop(1, withAlpha(light.tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(light.x - r, light.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /**
   * The frame closes in on the room. In the references this is what turns a
   * floor plan into a photograph: the corners are not dim, they are gone.
   */
  drawVignette(ctx: Ctx, tension: number, reduced: boolean): void {
    const cx = VIEW.width * 0.5;
    const cy = VIEW.height * 0.5;
    const strength = reduced ? 0.55 : 0.78 + tension * 0.16;
    const inner = VIEW.width * (reduced ? 0.42 : 0.33 - tension * 0.05);
    const outer = VIEW.width * 0.72;

    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(0,0,0,${(strength * 0.45).toFixed(3)})`);
    g.addColorStop(1, `rgba(0,0,0,${strength.toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    if (!reduced && tension > 0.55) {
      // The only time the frame itself bleeds.
      const a = (tension - 0.55) * 0.34;
      const r = ctx.createRadialGradient(cx, cy, VIEW.width * 0.3, cx, cy, outer);
      r.addColorStop(0, 'rgba(0,0,0,0)');
      r.addColorStop(1, withAlpha(PALETTE.blood, a));
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  /**
   * Fixed-pattern film grain. Deterministic, so it sits still in the image
   * instead of boiling, which would read as video compression rather than film.
   */
  drawGrain(ctx: Ctx, amount: number): void {
    if (amount <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    for (let i = 0; i < 300; i++) {
      const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const n2 = (Math.sin(i * 78.233) * 12345.6789) % 1;
      const x = Math.abs(n) * VIEW.width;
      const y = Math.abs(n2) * VIEW.height;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }
}
