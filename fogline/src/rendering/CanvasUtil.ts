// Shared helpers for the procedural texture painters.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

export const rand = (rng: Rng, a: number, b: number): number => a + (b - a) * rng();

/** Hex colour helpers. */
export function hex(c: number, a = 1): string {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

export function mix(c1: number, c2: number, t: number): number {
  const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t);
  const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t);
  const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
  return (r << 16) | (g << 8) | b;
}

export function shadeColor(c: number, f: number): number {
  return f < 0 ? mix(c, 0x000000, -f) : mix(c, 0xffffff, f);
}

/** Random speckles clipped to whatever clip region is active. */
export function speckle(
  ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number,
  count: number, color: string, maxR: number, minAlpha = 0.05, maxAlpha = 0.25,
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(rng, minAlpha, maxAlpha);
    const r = rand(rng, 0.4, maxR);
    ctx.beginPath();
    ctx.arc(x + rng() * w, y + rng() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Short random strokes: scratches, fibres, grime streaks. */
export function scratches(
  ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number,
  count: number, color: string, len: number, alpha = 0.2, vertical = false,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = alpha * rand(rng, 0.3, 1);
    ctx.lineWidth = rand(rng, 0.5, 1.6);
    const px = x + rng() * w, py = y + rng() * h;
    const a = vertical ? Math.PI / 2 + rand(rng, -0.3, 0.3) : rng() * Math.PI * 2;
    const l = rand(rng, len * 0.3, len);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Irregular dark-red stain with drips. */
export function bloodStain(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number, drips = 3, alpha = 0.75): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(70,6,6,0.95)');
  g.addColorStop(0.6, 'rgba(92,14,10,0.75)');
  g.addColorStop(1, 'rgba(92,14,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * rand(rng, 0.65, 1.1);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,4,4,0.85)';
  ctx.lineCap = 'round';
  for (let i = 0; i < drips; i++) {
    const dx = x + rand(rng, -r * 0.6, r * 0.6);
    ctx.lineWidth = rand(rng, 1.2, Math.max(1.5, r * 0.18));
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx + rand(rng, -1, 1), y + rand(rng, r * 0.6, r * 1.8));
    ctx.stroke();
  }
  ctx.restore();
}

export function softCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Horizontal "cylinder" gradient: dark edges, lit left-of-centre. */
export function cylinderGradient(
  ctx: CanvasRenderingContext2D, x0: number, x1: number, base: number, lightAmt = 0.25, darkAmt = 0.55,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, hex(shadeColor(base, -darkAmt)));
  g.addColorStop(0.3, hex(shadeColor(base, lightAmt)));
  g.addColorStop(0.55, hex(base));
  g.addColorStop(1, hex(shadeColor(base, -darkAmt * 1.1)));
  return g;
}

/** Simple shelf packer that paints regions of one big canvas and registers frames. */
export class AtlasBuilder {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private x = 1;
  private y = 1;
  private rowH = 0;
  readonly frames: { name: string; x: number; y: number; w: number; h: number }[] = [];

  constructor(readonly width: number, readonly height: number) {
    const c = makeCanvas(width, height);
    this.canvas = c.canvas;
    this.ctx = c.ctx;
  }

  add(name: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    w = Math.ceil(w);
    h = Math.ceil(h);
    if (this.x + w + 2 > this.width) {
      this.x = 1;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.y + h + 1 > this.height) throw new Error(`Atlas full adding ${name}`);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    paint(ctx, w, h);
    ctx.restore();
    this.frames.push({ name, x: this.x, y: this.y, w, h });
    this.x += w + 2;
    this.rowH = Math.max(this.rowH, h);
  }
}
