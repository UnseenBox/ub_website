import { easeOutBack } from '../core/math';
import { tr } from '../core/i18n';
import { C, FONT } from '../rendering/Palette';

interface Popup {
  active: boolean;
  text: string;
  x: number;
  y: number;
  t: number;
  dur: number;
  size: number;
  color: string;
}

const POOL = 10;

/** Small words that pop up in the world: combo counts, "POST!". */
export class Popups {
  private readonly pool: Popup[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < POOL; i++) this.pool.push({ active: false, text: '', x: 0, y: 0, t: 0, dur: 1, size: 20, color: C.white });
  }

  spawn(text: string, x: number, y: number, size: number, color: string, dur = 0.7): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    p.active = true;
    p.text = tr(text);
    p.x = x;
    p.y = y;
    p.t = 0;
    p.dur = dur;
    p.size = size;
    p.color = color;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= p.dur) p.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of this.pool) {
      if (!p.active) continue;
      const f = p.t / p.dur;
      const scale = easeOutBack(Math.min(1, f * 5), 3);
      ctx.globalAlpha = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
      ctx.font = `900 ${p.size * scale}px ${FONT}`;
      const y = p.y - 34 * f;
      ctx.lineWidth = p.size * 0.32;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
