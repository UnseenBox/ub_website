import type Phaser from 'phaser';
import { mulberry32, type Rng } from '../core/Random';
import { TAU, ellipse, makeCanvasTexture, mix, css } from './paint';

/**
 * The backdrop above the grass line, built from layers like a paper theatre: a washed sky,
 * hazy violet mountains, teal hills with pine woods, a sun with beams and flat-bottomed
 * clouds. Every layer is a separate texture so the dig scene can drift them at different
 * speeds. All painted from fixed seeds, so the view is the same on every boot.
 */

export const SKY = 'scenic-sky';
export const RIDGE_FAR = 'scenic-ridge-far';
export const RIDGE_MID = 'scenic-ridge-mid';
export const RIDGE_NEAR = 'scenic-ridge-near';
export const SUN_DISC = 'scenic-sun-disc';
export const SUN_RAYS = 'scenic-sun-rays';
export const CLOUDS = ['scenic-cloud-0', 'scenic-cloud-1', 'scenic-cloud-2'] as const;
/** Width of the ridge textures; the dig field is 1200 wide so there is margin on both sides. */
export const RIDGE_W = 1500;

export function createScenicTextures(T: Phaser.Textures.TextureManager): void {
  makeCanvasTexture(T, SKY, 256, 768, (ctx, w, h) => paintSky(ctx, w, h));
  makeCanvasTexture(T, RIDGE_FAR, RIDGE_W, 300, (ctx, w, h) =>
    paintRidge(ctx, w, h, { seed: 11, amp: 210, floor: 30, top: 0x8a9fd2, bottom: 0xc9d6ee, rim: 0xf2f4ff, detail: 0.9, pines: 0 }),
  );
  makeCanvasTexture(T, RIDGE_MID, RIDGE_W, 240, (ctx, w, h) =>
    paintRidge(ctx, w, h, { seed: 23, amp: 120, floor: 24, top: 0x4f8c86, bottom: 0x93bba9, rim: 0xd4f0c0, detail: 0.6, pines: 64 }),
  );
  makeCanvasTexture(T, RIDGE_NEAR, RIDGE_W, 160, (ctx, w, h) =>
    paintRidge(ctx, w, h, { seed: 37, amp: 70, floor: 20, top: 0x86bb55, bottom: 0x5f9a47, rim: 0xe8ff9e, detail: 0.3, pines: 0, outline: true }),
  );
  makeCanvasTexture(T, SUN_DISC, 256, 256, (ctx) => paintSunDisc(ctx));
  makeCanvasTexture(T, SUN_RAYS, 640, 640, (ctx) => paintSunRays(ctx));
  CLOUDS.forEach((key, i) => makeCanvasTexture(T, key, 300, 130, (ctx, w, h) => paintCloud(ctx, w, h, 90 + i * 13)));
}

/** A tall wash: deep blue at the top, a pale warm band at the horizon, faint streaks of high cloud. */
function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2f78c0');
  g.addColorStop(0.3, '#5aa9e0');
  g.addColorStop(0.6, '#a4d8ef');
  g.addColorStop(0.85, '#f8e6c0');
  g.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Painted wash: broad soft bands.
  const rng = mulberry32(3);
  for (let i = 0; i < 9; i++) {
    const y = h * (0.18 + rng() * 0.62);
    ctx.fillStyle = `rgba(255,255,255,${0.04 + rng() * 0.05})`;
    ellipse(ctx, w / 2, y, w * (0.6 + rng() * 0.5), 14 + rng() * 26);
  }
  // Thin streaks of high cloud.
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const y = h * (0.1 + rng() * 0.55);
    const x = rng() * w;
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + rng() * 0.16})`;
    ctx.lineWidth = 2 + rng() * 3;
    ctx.beginPath();
    ctx.moveTo(x - 40, y);
    ctx.quadraticCurveTo(x, y - 4 - rng() * 6, x + 60 + rng() * 40, y);
    ctx.stroke();
  }
  // Warm glow where the sun sits low.
  const glow = ctx.createRadialGradient(w / 2, h, 4, w / 2, h, h * 0.55);
  glow.addColorStop(0, 'rgba(255,230,160,0.5)');
  glow.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function fractalLine(rng: Rng, n: number, rough: number): number[] {
  const pts = new Array<number>(n + 1).fill(0);
  pts[0] = rng();
  pts[n] = rng();
  let step = n;
  let amp = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rng() - 0.5) * amp;
    step = half;
    amp *= rough;
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  return pts.map((p) => (p - lo) / (hi - lo || 1));
}

interface RidgeOptions {
  seed: number;
  amp: number;
  /** Minimum height of the ridge above the bottom of the canvas. */
  floor: number;
  top: number;
  bottom: number;
  rim: number;
  /** 0..1 amount of strata streaks and stippling. */
  detail: number;
  pines: number;
  outline?: boolean;
}

function paintRidge(ctx: CanvasRenderingContext2D, w: number, h: number, o: RidgeOptions): void {
  const rng = mulberry32(o.seed);
  const n = 128;
  const line = fractalLine(rng, n, 0.55);
  const swell = (i: number): number => 0.5 + 0.5 * Math.sin((i / n) * TAU * 1.5 + o.seed);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= n; i++) {
    xs.push((i / n) * w);
    ys.push(h - o.floor - o.amp * (0.25 + 0.5 * line[i] + 0.25 * swell(i)));
  }
  const trace = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(xs[0], ys[0]);
    for (let i = 1; i <= n; i++) {
      const mx = (xs[i - 1] + xs[i]) / 2;
      const my = (ys[i - 1] + ys[i]) / 2;
      ctx.quadraticCurveTo(xs[i - 1], ys[i - 1], mx, my);
    }
    ctx.lineTo(xs[n], ys[n]);
    ctx.lineTo(w, h);
    ctx.closePath();
  };

  const body = ctx.createLinearGradient(0, h - o.floor - o.amp, 0, h);
  body.addColorStop(0, css(o.top));
  body.addColorStop(1, css(o.bottom));
  trace();
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  trace();
  ctx.clip();
  // Strata-like streaks: long, thin, slightly lighter and darker.
  const streaks = Math.round(60 * o.detail);
  for (let i = 0; i < streaks; i++) {
    const y = h - o.floor - rng() * o.amp;
    const x = rng() * w;
    ctx.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(20,30,60,0.09)';
    ctx.lineWidth = 1.5 + rng() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 3, x + 80 + rng() * 80, y + 1);
    ctx.stroke();
  }
  // Mist rising from the foot of the layer.
  const mist = ctx.createLinearGradient(0, h - o.floor - o.amp * 0.5, 0, h);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(1, `rgba(255,248,230,${0.1 + 0.25 * o.detail})`);
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Pine woods standing on the ridge.
  if (o.pines > 0) {
    const dark = mix(o.top, 0x10283a, 0.45);
    for (let i = 0; i < o.pines; i++) {
      const idx = Math.floor(rng() * n);
      const x = xs[idx] + rng() * 8;
      const baseY = ys[idx] + 6 + rng() * 6;
      const th = 22 + rng() * 34;
      pine(ctx, x, baseY, th, rng() < 0.5 ? dark : mix(dark, o.rim, 0.15));
    }
  }

  // Rim light along the top edge.
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i <= n; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    const my = (ys[i - 1] + ys[i]) / 2;
    ctx.quadraticCurveTo(xs[i - 1], ys[i - 1], mx, my);
  }
  ctx.strokeStyle = css(o.rim, 0.65);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (o.outline) {
    ctx.translate(0, 1.5);
    ctx.strokeStyle = 'rgba(40,70,30,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** A little three-tier fir tree. */
function pine(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, color: number): void {
  const tiers = 3;
  ctx.fillStyle = css(color);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const topY = baseY - height + t * height * 0.55;
    const half = height * (0.2 + t * 0.2);
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + half, topY + height * 0.42);
    ctx.lineTo(x - half, topY + height * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - 1.5, baseY - height * 0.12, 3, height * 0.14);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x, baseY - height);
  ctx.lineTo(x - height * 0.14, baseY - height * 0.62);
  ctx.lineTo(x, baseY - height * 0.62);
  ctx.closePath();
  ctx.fill();
}

/** A soft cream sun: glow, disc, a crescent of light and a thin ring. Painted near-white so the day tint colours it. */
function paintSunDisc(ctx: CanvasRenderingContext2D): void {
  const c = 128;
  const glow = ctx.createRadialGradient(c, c, 20, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,0.75)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const disc = ctx.createRadialGradient(c - 10, c - 12, 4, c, c, 58);
  disc.addColorStop(0, '#ffffff');
  disc.addColorStop(0.8, '#fff1c4');
  disc.addColorStop(1, '#ffd98a');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(c, c, 54, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,60,0.75)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, 66, 0, TAU);
  ctx.stroke();
}

/** Sixteen tapered beams, alternating long and short, fading outward. */
function paintSunRays(ctx: CanvasRenderingContext2D): void {
  const c = 320;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const len = i % 2 === 0 ? 300 : 210;
    const wid = i % 2 === 0 ? 0.16 : 0.12;
    const g = ctx.createRadialGradient(c, c, 60, c, c, len);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a - wid * 0.4) * 64, c + Math.sin(a - wid * 0.4) * 64);
    ctx.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    ctx.lineTo(c + Math.cos(a + wid * 0.4) * 64, c + Math.sin(a + wid * 0.4) * 64);
    ctx.closePath();
    ctx.fill();
  }
}

/** A flat-bottomed cumulus: white crown, lilac underside, a little sparkle of highlight. */
function paintCloud(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const rng = mulberry32(seed);
  const baseY = h - 26;
  const bumps = 6 + Math.floor(rng() * 3);
  const spans: Array<[number, number, number]> = [];
  for (let i = 0; i < bumps; i++) {
    const t = i / (bumps - 1);
    const x = 40 + t * (w - 80);
    const r = 20 + Math.sin(t * Math.PI) * 30 + rng() * 12;
    spans.push([x, baseY - r * 0.55, r]);
  }
  ctx.fillStyle = '#ffffff';
  for (const [x, y, r] of spans) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillRect(34, baseY - 28, w - 68, 28);
  // Underside tint and a lit top, clipped to the cloud itself.
  ctx.globalCompositeOperation = 'source-atop';
  const under = ctx.createLinearGradient(0, baseY - 34, 0, baseY);
  under.addColorStop(0, 'rgba(190,205,240,0)');
  under.addColorStop(1, 'rgba(176,190,232,0.95)');
  ctx.fillStyle = under;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,238,200,0.5)';
  for (const [x, y, r] of spans) {
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y - r * 0.22, r * 0.72, Math.PI * 1.05, Math.PI * 1.7);
    ctx.lineTo(x, y);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, baseY);
  ctx.globalCompositeOperation = 'source-over';
}
