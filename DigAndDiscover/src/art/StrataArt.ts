import type { LayerBand } from '../systems/ExcavationSystem';
import { intRange, mulberry32, pick, range, type Rng } from '../core/Random';
import { TAU, blobPath, blobPoints, ellipse, polygon, star, type Pt } from './paint';

/**
 * The vertical cross-section of the dig site: five geological layers from the
 * grass line down to bedrock, painted once into a single offscreen canvas.
 *
 * Everything is deterministic - fixed seeds, never Math.random - so the pit
 * looks identical on every boot.
 */

export interface StrataSpec {
  /** Width of the pit in pixels. */
  width: number;
  /** Total canvas height, including the bedrock below the last layer. */
  height: number;
  /** Field y of the grass line. Everything above it stays transparent. */
  surfaceY: number;
  /** Layer bands from top to bottom; band.top / band.bottom are canvas y values. */
  bands: readonly LayerBand[];
}

/** Horizontal distance between two samples of a wavy boundary. */
const WAVE_STEP = 6;
/** Half height of the soft blend painted across a layer boundary. */
const BLEND = 13;
/** Largest allowed deviation of a wavy boundary from the nominal layer top. */
const WAVE_LIMIT = 13;

interface Curve {
  x: number[];
  y: number[];
}

// ---------------------------------------------------------------- helpers

/** Sum-of-sines wobble around a base line, always within +/- WAVE_LIMIT. */
function makeWave(baseY: number, seed: number, amplitude: number): (x: number) => number {
  const rng = mulberry32(seed);
  const p1 = rng() * TAU;
  const p2 = rng() * TAU;
  const p3 = rng() * TAU;
  const a1 = amplitude * 0.45;
  const a2 = amplitude * 0.32;
  const a3 = amplitude * 0.23;
  return (x: number) => {
    const w = a1 * Math.sin(x / 140 + p1) + a2 * Math.sin(x / 53 + p2) + a3 * Math.sin(x / 317 + p3);
    return baseY + Math.max(-WAVE_LIMIT, Math.min(WAVE_LIMIT, w));
  };
}

function sampleCurve(fn: (x: number) => number, width: number): Curve {
  const x: number[] = [];
  const y: number[] = [];
  for (let px = 0; px < width; px += WAVE_STEP) {
    x.push(px);
    y.push(fn(px));
  }
  x.push(width);
  y.push(fn(width));
  return { x, y };
}

function offsetCurve(c: Curve, dy: number): Curve {
  return { x: c.x, y: c.y.map((v) => v + dy) };
}

/** Closed path between an upper and a lower curve (they share the same x grid). */
function regionPath(upper: Curve, lower: Curve): Path2D {
  const p = new Path2D();
  p.moveTo(upper.x[0], upper.y[0]);
  for (let i = 1; i < upper.x.length; i++) p.lineTo(upper.x[i], upper.y[i]);
  for (let i = lower.x.length - 1; i >= 0; i--) p.lineTo(lower.x[i], lower.y[i]);
  p.closePath();
  return p;
}

function strokeCurve(ctx: CanvasRenderingContext2D, c: Curve): void {
  ctx.beginPath();
  ctx.moveTo(c.x[0], c.y[0]);
  for (let i = 1; i < c.x.length; i++) ctx.lineTo(c.x[i], c.y[i]);
  ctx.stroke();
}

/** Parses '#rrggbb' and 'rgb(r,g,b)' into components. */
function parseColor(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const v = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = c.match(/-?\d+/g);
  if (!m || m.length < 3) return [0, 0, 0];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

/** Blends two CSS colours; t = 0 returns a, t = 1 returns b. */
function mixHex(a: string, b: string, t: number): string {
  const A = parseColor(a);
  const B = parseColor(b);
  const ch = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

/** The band colour at a given depth inside its own layer. */
function bandColorAt(band: LayerBand, y: number): string {
  const look = band.layer.look;
  const t = Math.max(0, Math.min(1, (y - band.top) / Math.max(1, band.bottom - band.top)));
  return mixHex(look.top, look.bottom, t);
}

function angularPath(pts: Pt[]): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
}

function jaggedPoints(rng: Rng, x: number, y: number, count: number, step: number): Pt[] {
  const pts: Pt[] = [{ x, y }];
  let a = rng() * TAU;
  let cx = x;
  let cy = y;
  for (let i = 0; i < count; i++) {
    a += range(rng, -0.75, 0.75);
    cx += Math.cos(a) * step * range(rng, 0.6, 1.4);
    cy += Math.sin(a) * step * range(rng, 0.6, 1.4);
    pts.push({ x: cx, y: cy });
  }
  return pts;
}

// ---------------------------------------------------------------- stones

/** One decorative embedded stone: matte body, soft shadow, top light, dark base. */
function paintStone(ctx: CanvasRenderingContext2D, rng: Rng, look: LayerBand['layer']['look'], soil: string, x: number, y: number, r: number): void {
  // The tone is pulled towards the surrounding soil so the stone sits in the
  // ground instead of floating on top of it like a collectable gem.
  const tone = mixHex(pick(rng, look.stones.tones), soil, 0.4);
  // Soft drop shadow underneath.
  ctx.fillStyle = 'rgba(18,10,4,0.22)';
  ellipse(ctx, x + r * 0.14, y + r * 0.55, r * 0.92, r * 0.3);

  let shape: Path2D;
  if (rng() < look.stones.angular) {
    const n = intRange(rng, 5, 8);
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + range(rng, -0.15, 0.15);
      const rr = r * range(rng, 0.62, 1);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.88 });
    }
    shape = angularPath(pts);
  } else {
    shape = blobPath(blobPoints(rng, 8, 0.22, 0.9), x, y, r);
  }

  ctx.fillStyle = tone;
  ctx.fill(shape);

  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = 'rgba(255,255,255,0.17)';
  ellipse(ctx, x - r * 0.26, y - r * 0.32, r * 0.44, r * 0.24);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, x + r * 0.12, y + r * 0.55, r * 0.82, r * 0.32);
  ctx.restore();

  ctx.strokeStyle = 'rgba(45,30,15,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke(shape);
}

/** A large half-buried boulder with facets and a lighter top. */
function paintBoulder(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, x: number, y: number, r: number): void {
  const n = intRange(rng, 6, 9);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + range(rng, -0.14, 0.14);
    const rr = r * range(rng, 0.7, 1);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.86 });
  }
  const shape = angularPath(pts);
  ctx.fillStyle = 'rgba(12,8,4,0.3)';
  ellipse(ctx, x + r * 0.12, y + r * 0.62, r * 0.95, r * 0.32);
  ctx.fillStyle = pick(rng, ['#7c8088', '#6a6e76', '#8b8f97', '#5f636b']);
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  polygon(ctx, [pts[0], pts[1], { x, y: y - r * 0.1 }]);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  polygon(ctx, [pts[Math.floor(n / 2)], pts[Math.floor(n / 2) + 1] ?? pts[0], { x, y: y + r * 0.2 }]);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(28,22,16,0.4)';
  ctx.lineWidth = 1.6;
  ctx.stroke(shape);
  // Bury the lower half so the boulder reads as embedded in the soil.
  ctx.fillStyle = bandColorAt(band, y + r * 0.55);
  ellipse(ctx, x, y + r * 0.72, r * 1.05, r * 0.4);
}

// ---------------------------------------------------------------- details

function paintRoots(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, width: number, surfaceY: number): void {
  const detail = band.layer.look.detailColor;
  ctx.lineCap = 'round';
  // Root tendrils hanging down from the grass line.
  for (let i = 0; i < 18; i++) {
    const x = range(rng, 0, width);
    const len = range(rng, 45, 140);
    const drift = range(rng, -34, 34);
    ctx.strokeStyle = detail;
    ctx.globalAlpha = range(rng, 0.35, 0.72);
    ctx.lineWidth = range(rng, 1.2, 3);
    ctx.beginPath();
    ctx.moveTo(x, surfaceY + 2);
    ctx.quadraticCurveTo(x + drift * 0.35, surfaceY + len * 0.55, x + drift, surfaceY + len);
    ctx.stroke();
    // A side branch on some of them.
    if (rng() < 0.5) {
      const bx = x + drift * 0.5;
      const by = surfaceY + len * 0.55;
      ctx.lineWidth = Math.max(0.8, ctx.lineWidth * 0.6);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + drift * 0.4, by + 18, bx + drift * 0.8, by + 34);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // Tiny pale root hairs just under the grass.
  ctx.strokeStyle = 'rgba(216,186,140,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = range(rng, 0, width);
    const y = surfaceY + range(rng, 3, 16);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(rng, -4, 4), y + range(rng, 4, 11));
    ctx.stroke();
  }
  // A few pale grubs squiggling through the soil.
  for (let i = 0; i < 6; i++) {
    let x = range(rng, 0, width);
    let y = range(rng, band.top + 40, band.bottom - 20);
    ctx.strokeStyle = 'rgba(240,230,205,0.78)';
    ctx.lineWidth = range(rng, 2, 3.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      const nx = x + range(rng, -24, 24);
      const ny = y + range(rng, -16, 16);
      ctx.quadraticCurveTo(x + range(rng, -14, 14), y + range(rng, -12, 12), nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
}

function paintClay(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, width: number): void {
  const detail = band.layer.look.detailColor;
  // Pale, wavy clay lenses.
  for (let i = 0; i < 24; i++) {
    const y = range(rng, band.top + 6, band.bottom - 6);
    const len = range(rng, 140, 420);
    const x = range(rng, -80, width);
    const h = range(rng, 4, 15);
    ctx.fillStyle = detail;
    ctx.globalAlpha = range(rng, 0.16, 0.34);
    ellipse(ctx, x + len / 2, y, len / 2, h);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.22)';
    ellipse(ctx, x + len / 2, y - h * 0.45, len / 2.4, h * 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Smooth round pebbles.
  for (let i = 0; i < 18; i++) {
    const r = range(rng, 4, 9);
    const x = range(rng, r, width - r);
    const y = range(rng, band.top + r, band.bottom - r);
    ctx.fillStyle = 'rgba(70,40,20,0.2)';
    ellipse(ctx, x + r * 0.15, y + r * 0.5, r * 0.95, r * 0.35);
    ctx.fillStyle = mixHex('#b3a48c', detail, 0.45);
    ellipse(ctx, x, y, r, r * 0.88);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ellipse(ctx, x - r * 0.3, y - r * 0.3, r * 0.42, r * 0.3);
  }
}

function paintCracks(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, width: number): void {
  const detail = band.layer.look.detailColor;
  // Drier, lighter patches.
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = 'rgba(232,222,198,0.14)';
    ellipse(ctx, range(rng, 0, width), range(rng, band.top, band.bottom), range(rng, 40, 120), range(rng, 16, 44));
  }
  // Jagged cracks with small branches.
  ctx.strokeStyle = detail;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 0, width);
    const y = range(rng, band.top, band.bottom);
    const pts = jaggedPoints(rng, x, y, intRange(rng, 4, 9), range(rng, 12, 30));
    ctx.globalAlpha = range(rng, 0.35, 0.65);
    ctx.lineWidth = range(rng, 1, 2.6);
    polygon(ctx, pts);
    ctx.stroke();
    if (rng() < 0.6) {
      const at = pts[intRange(rng, 1, pts.length - 2)];
      const branch = jaggedPoints(rng, at.x, at.y, 3, range(rng, 8, 18));
      ctx.lineWidth *= 0.7;
      polygon(ctx, branch);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // Chipped flat slabs.
  for (let i = 0; i < 11; i++) {
    const w = range(rng, 26, 70);
    const h = w * range(rng, 0.22, 0.4);
    const x = range(rng, 0, width);
    const y = range(rng, band.top, band.bottom);
    const pts: Pt[] = [];
    const n = intRange(rng, 5, 7);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      pts.push({ x: x + Math.cos(a) * w * range(rng, 0.7, 1), y: y + Math.sin(a) * h * range(rng, 0.7, 1) });
    }
    ctx.fillStyle = 'rgba(70,60,48,0.28)';
    ellipse(ctx, x + 3, y + h * 0.7, w * 0.9, h * 0.7);
    ctx.fillStyle = mixHex('#b3aa97', band.layer.look.top, 0.3);
    polygon(ctx, pts);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.22)';
    polygon(ctx, [pts[0], pts[1], { x: x, y: y - h * 0.2 }]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,32,24,0.35)';
    ctx.lineWidth = 1.2;
    polygon(ctx, pts);
    ctx.stroke();
  }
}

function paintBoulders(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, width: number): void {
  // A handful of large half-buried boulders.
  for (let i = 0; i < 8; i++) {
    const r = range(rng, 34, 58);
    const x = range(rng, r, width - r);
    const y = range(rng, band.top + r * 0.6, band.bottom - r * 0.4);
    paintBoulder(ctx, rng, band, x, y, r);
  }
  // Loose gravel around them.
  for (let i = 0; i < 70; i++) {
    const r = range(rng, 3, 8);
    const x = range(rng, r, width - r);
    const y = range(rng, band.top + r, band.bottom - r);
    paintStone(ctx, rng, band.layer.look, bandColorAt(band, y), x, y, r);
  }
}

/** One prism crystal pointing along `angle`. */
function paintPrism(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number, w: number, color: string, edge: string): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const at = (along: number, side: number): Pt => ({ x: x + dx * along + px * side, y: y + dy * along + py * side });
  const baseL = at(0, w);
  const baseR = at(0, -w);
  const shL = at(len * 0.68, w);
  const shR = at(len * 0.68, -w);
  const tip = at(len, 0);
  const mid = at(len * 0.68, 0);
  ctx.fillStyle = color;
  polygon(ctx, [baseL, shL, tip, shR, baseR]);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  polygon(ctx, [mid, tip, shR, baseR]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  polygon(ctx, [shL, tip, mid]);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(0.8, w * 0.3);
  polygon(ctx, [baseL, shL, tip, shR, baseR]);
  ctx.stroke();
}

function paintCrystals(ctx: CanvasRenderingContext2D, rng: Rng, band: LayerBand, width: number): void {
  const cyan = band.layer.look.detailColor;
  const violet = '#b79bff';
  // Glowing veins: wide soft pass, then a bright thin core.
  for (let i = 0; i < 11; i++) {
    const x = range(rng, 0, width);
    const y = range(rng, band.top, band.bottom);
    const len = range(rng, 70, 200);
    const pts = jaggedPoints(rng, x, y, intRange(rng, 3, 6), len / 5);
    const color = rng() < 0.6 ? cyan : violet;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    polygon(ctx, pts);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 6;
    polygon(ctx, pts);
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(235,255,255,0.9)';
    polygon(ctx, pts);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Soft glow around the vein nodes (radial gradient, no shadow blur).
    for (const p of pts) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
      g.addColorStop(0, color.startsWith('#') ? `${color}66` : 'rgba(140,220,255,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ellipse(ctx, p.x, p.y, 26, 26);
    }
  }
  // Little crystal clusters.
  for (let i = 0; i < 16; i++) {
    const cx = range(rng, 0, width);
    const cy = range(rng, band.top, band.bottom);
    const n = intRange(rng, 3, 5);
    const color = rng() < 0.6 ? cyan : violet;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + range(rng, -0.9, 0.9);
      const len = range(rng, 10, 26);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, len * 1.6);
      g.addColorStop(0, 'rgba(150,230,255,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ellipse(ctx, cx, cy, len * 1.6, len * 1.6);
      paintPrism(ctx, cx, cy, a, len, len * 0.16, color, 'rgba(255,255,255,0.6)');
    }
  }
  // Tiny sparkles.
  for (let i = 0; i < 80; i++) {
    star(ctx, range(rng, 0, width), range(rng, band.top, band.bottom), range(rng, 1.4, 4), 'rgba(205,240,255,0.85)');
  }
}

// ---------------------------------------------------------------- main

/**
 * Paints the whole cross-section into the given context.
 *
 * The caller owns the canvas: it must be exactly spec.width x spec.height.
 */
export function paintStrata(ctx: CanvasRenderingContext2D, spec: StrataSpec): void {
  const { width, height, surfaceY } = spec;
  const bands = spec.bands;
  if (bands.length === 0 || width <= 0 || height <= 0) return;

  const rng = mulberry32(20260914);

  // Boundary curves: the grass line on top, then one wobble per layer boundary.
  const curves: Curve[] = [];
  for (let i = 0; i < bands.length; i++) {
    const isTop = i === 0;
    const base = isTop ? surfaceY : bands[i].top;
    const amp = isTop ? 2.5 : 11;
    curves.push(sampleCurve(makeWave(base, 1000 + i * 7, amp), width));
  }
  const lastBand = bands[bands.length - 1];
  curves.push(sampleCurve(() => lastBand.bottom, width));

  // 1. Base gradients, one per layer, clipped to the wavy band region.
  bands.forEach((band, i) => {
    const g = ctx.createLinearGradient(0, band.top, 0, band.bottom);
    g.addColorStop(0, band.layer.look.top);
    g.addColorStop(1, band.layer.look.bottom);
    ctx.fillStyle = g;
    ctx.fill(regionPath(curves[i], curves[i + 1]));
  });

  // 2. Soft wavy blends plus a thin strata line at every layer boundary.
  for (let i = 1; i < bands.length; i++) {
    const top = bands[i].top;
    const g = ctx.createLinearGradient(0, top - BLEND, 0, top + BLEND);
    g.addColorStop(0, bands[i - 1].layer.look.bottom);
    g.addColorStop(1, bands[i].layer.look.top);
    ctx.fillStyle = g;
    ctx.fill(regionPath(offsetCurve(curves[i], -BLEND), offsetCurve(curves[i], BLEND)));

    ctx.save();
    ctx.strokeStyle = 'rgba(28,16,6,0.28)';
    ctx.lineWidth = 2.4;
    strokeCurve(ctx, curves[i]);
    ctx.translate(0, -2.5);
    ctx.strokeStyle = 'rgba(255,242,220,0.12)';
    ctx.lineWidth = 1.4;
    strokeCurve(ctx, curves[i]);
    ctx.restore();
  }

  // 3. Per layer decoration: mottling, grain, stones, layer specific detail.
  bands.forEach((band, i) => {
    ctx.save();
    ctx.clip(regionPath(curves[i], curves[i + 1]));
    const look = band.layer.look;
    const bandRng = mulberry32(4400 + i * 31);

    // Soft mottling blobs.
    const blobCount = Math.max(18, Math.round((band.bottom - band.top) / 14));
    for (let b = 0; b < blobCount; b++) {
      ctx.fillStyle = pick(bandRng, look.blobs);
      const rx = range(bandRng, 26, 95);
      ellipse(ctx, range(bandRng, -40, width + 40), range(bandRng, band.top, band.bottom), rx, rx * range(bandRng, 0.35, 0.7));
    }

    // Grain specks, roughly one per 300 square pixels.
    const speckCount = Math.round((width * (band.bottom - band.top)) / 300);
    for (let s = 0; s < speckCount; s++) {
      ctx.fillStyle = bandRng() < 0.55 ? look.speckDark : look.speckLight;
      const size = range(bandRng, 1, 2.6);
      ctx.fillRect(range(bandRng, 0, width), range(bandRng, band.top, band.bottom), size, size);
    }

    // Embedded decorative stones.
    const stoneCount = Math.round((look.stones.per100k * width * (band.bottom - band.top)) / 100000);
    for (let st = 0; st < stoneCount; st++) {
      const r = range(bandRng, look.stones.minRadius, look.stones.maxRadius);
      const sy = range(bandRng, band.top + r, band.bottom - r);
      const sx = range(bandRng, r, width - r);
      paintStone(ctx, bandRng, look, bandColorAt(band, sy), sx, sy, r);
    }

    // Layer specific detail.
    switch (look.detail) {
      case 'roots':
        paintRoots(ctx, bandRng, band, width, surfaceY);
        break;
      case 'clay':
        paintClay(ctx, bandRng, band, width);
        break;
      case 'cracks':
        paintCracks(ctx, bandRng, band, width);
        break;
      case 'boulders':
        paintBoulders(ctx, bandRng, band, width);
        break;
      case 'crystals':
        paintCrystals(ctx, bandRng, band, width);
        break;
    }

    // A little extra shade toward the bottom of every layer.
    const shade = ctx.createLinearGradient(0, band.bottom - (band.bottom - band.top) * 0.35, 0, band.bottom);
    shade.addColorStop(0, 'rgba(20,10,4,0)');
    shade.addColorStop(1, 'rgba(20,10,4,0.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, band.top, width, band.bottom - band.top);
    ctx.restore();
  });

  // 4. Darker topsoil strip right below the grass line.
  const topsoil = ctx.createLinearGradient(0, surfaceY - 4, 0, surfaceY + 22);
  topsoil.addColorStop(0, 'rgba(58,32,12,0.5)');
  topsoil.addColorStop(1, 'rgba(58,32,12,0)');
  ctx.fillStyle = topsoil;
  ctx.fillRect(0, surfaceY - 4, width, 28);

  // 5. Bedrock below the last layer.
  const rockTop = lastBand.bottom;
  if (height > rockTop) {
    const rock = ctx.createLinearGradient(0, rockTop, 0, height);
    rock.addColorStop(0, '#4c5665');
    rock.addColorStop(0.12, '#39424f');
    rock.addColorStop(1, '#232833');
    ctx.fillStyle = rock;
    ctx.fillRect(0, rockTop, width, height - rockTop);
    // Slightly lighter top edge.
    ctx.fillStyle = 'rgba(158,176,196,0.22)';
    ctx.fillRect(0, rockTop, width, 5);
    // Big faint cracks.
    ctx.strokeStyle = 'rgba(10,14,20,0.28)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const pts = jaggedPoints(rng, range(rng, 0, width), range(rng, rockTop + 6, height), intRange(rng, 3, 6), range(rng, 30, 70));
      ctx.lineWidth = range(rng, 1.6, 4);
      polygon(ctx, pts);
      ctx.stroke();
    }
    // Sparse grain.
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.6 ? 'rgba(0,0,0,0.25)' : 'rgba(210,225,240,0.12)';
      ctx.fillRect(range(rng, 0, width), range(rng, rockTop, height), range(rng, 1, 2.4), range(rng, 1, 2.4));
    }
    // Big flat facets so the bedrock is not one dead slab.
    for (let i = 0; i < 7; i++) {
      const x = range(rng, 0, width);
      const y = range(rng, rockTop + 8, height);
      const r = range(rng, 18, 46);
      const pts: Pt[] = [];
      const n = intRange(rng, 5, 7);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        pts.push({ x: x + Math.cos(a) * r * range(rng, 0.7, 1), y: y + Math.sin(a) * r * range(rng, 0.45, 0.85) });
      }
      ctx.fillStyle = 'rgba(226,238,255,0.05)';
      polygon(ctx, pts);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.4;
      polygon(ctx, pts);
      ctx.stroke();
    }
  }

  // 6. A faint overall darkening with depth.
  const depth = ctx.createLinearGradient(0, surfaceY, 0, height);
  depth.addColorStop(0, 'rgba(0,0,0,0)');
  depth.addColorStop(1, 'rgba(6,6,24,0.28)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, surfaceY, width, height - surfaceY);

  // 7. The grass fringe above the surface line.
  paintGrass(ctx, rng, curves[0], width);
}

/** Lush grass tufts and flowers along the grass line (drawn on transparency). */
function paintGrass(ctx: CanvasRenderingContext2D, rng: Rng, curve: Curve, width: number): void {
  const dark = '#3f7f36';
  const light = '#77c755';
  const deep = '#2c5f28';
  const x0 = curve.x[0];
  const y0 = curve.y[0];

  // A thin green fringe hugging the line.
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < curve.x.length; i++) ctx.lineTo(curve.x[i], curve.y[i]);
  for (let i = curve.x.length - 1; i >= 0; i--) ctx.lineTo(curve.x[i], curve.y[i] + 7);
  ctx.closePath();
  ctx.fill();

  // Blades: each one a slim triangle leaning a little.
  ctx.lineCap = 'round';
  for (let x = 0; x < width; x += range(rng, 5, 11)) {
    const idx = Math.min(curve.x.length - 1, Math.round(x / WAVE_STEP));
    const baseY = curve.y[idx];
    const h = range(rng, 6, 16);
    const lean = range(rng, -5, 5);
    const w = range(rng, 1.4, 3);
    ctx.fillStyle = rng() < 0.45 ? light : dark;
    ctx.beginPath();
    ctx.moveTo(x - w, baseY + 2);
    ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.6, x + lean, baseY - h);
    ctx.quadraticCurveTo(x + lean * 0.4 + w, baseY - h * 0.5, x + w, baseY + 2);
    ctx.closePath();
    ctx.fill();
  }

  // Tufts and the occasional little flower.
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 0, width);
    const idx = Math.min(curve.x.length - 1, Math.round(x / WAVE_STEP));
    const baseY = curve.y[idx];
    for (let b = 0; b < 4; b++) {
      const h = range(rng, 8, 16);
      const lean = range(rng, -7, 7);
      ctx.strokeStyle = rng() < 0.5 ? light : dark;
      ctx.lineWidth = range(rng, 1.2, 2.2);
      ctx.beginPath();
      ctx.moveTo(x, baseY + 2);
      ctx.quadraticCurveTo(x + lean * 0.4, baseY - h * 0.6, x + lean, baseY - h);
      ctx.stroke();
    }
    if (rng() < 0.45) {
      const petal = pick(rng, ['#ff8fb1', '#ffd94d', '#f4f1e6', '#c39bff']);
      const fx = x + range(rng, -5, 5);
      const fy = baseY - range(rng, 11, 16);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(fx, baseY);
      ctx.lineTo(fx, fy + 2);
      ctx.stroke();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU;
        ctx.fillStyle = petal;
        ellipse(ctx, fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 1.9, 1.9);
      }
      ctx.fillStyle = '#ffc83d';
      ellipse(ctx, fx, fy, 1.5, 1.5);
    }
  }
}
