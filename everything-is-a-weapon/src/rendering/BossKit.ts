import { INK } from '../core/constants';
import { TAU } from '../core/math';
import type { Enemy } from '../entities/Enemy';
import type { Ctx } from './draw';

export type Tone = (color: string) => string;
export type Pt = readonly [number, number];

/** Everything a boss body needs: the shared hit-flash tone, facing and telegraph state. */
export interface BossDraw {
  hw: number;
  hd: number;
  tone: Tone;
  fx: number;
  fy: number;
  windup: number;
  hop: number;
  topY: number;
  lift: number;
}

export type BossBody = (ctx: Ctx, e: Enemy, x: number, y: number, time: number, p: BossDraw) => void;

/** Smooth closed (or open) curve through the points: organic silhouettes without a spline library. */
export function blob(ctx: Ctx, pts: ReadonlyArray<Pt>, closed = true): void {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  if (closed) {
    const m0 = mid(pts[n - 1]!, pts[0]!);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i]!, pts[(i + 1) % n]!);
      ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], m[0], m[1]);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < n - 1; i++) {
      const m = mid(pts[i]!, pts[i + 1]!);
      ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], m[0], m[1]);
    }
    ctx.lineTo(pts[n - 1]![0], pts[n - 1]![1]);
  }
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, ...stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

export function rad(ctx: Ctx, x: number, y: number, r0: number, r1: number, ...stops: string[]): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

/** Fill the current path, then ink it. */
export function paint(ctx: Ctx, fill: string | CanvasGradient, width = 3): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** A soft white shine; the single cheapest way to make a flat shape look like a surface. */
export function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.5, alpha = 0.5): void {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

export function shadeBand(ctx: Ctx, alpha = 0.22): void {
  ctx.fillStyle = `rgba(26, 14, 52, ${alpha})`;
  ctx.fill();
}

export function bolt(ctx: Ctx, x: number, y: number, r = 1.5, color = '#d8d2c4'): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(26, 14, 52, 0.55)';
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.35, r * 0.55, 0, TAU);
  ctx.fill();
}

/** A thick inked segment: arms, pipes, legs. */
export function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string, shineColor = 'rgba(255,255,255,0.35)'): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3.6;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = shineColor;
  ctx.lineWidth = Math.max(1, w * 0.22);
  ctx.beginPath();
  ctx.moveTo(x0 - 0.6, y0 - w * 0.22);
  ctx.lineTo(x1 - 0.6, y1 - w * 0.22);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** A curved tapering tentacle from (x0,y0) via (cx,cy) to (x1,y1), fat to thin. */
export function tentacle(ctx: Ctx, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number, fill: string | CanvasGradient, suckers = '', time = 0): void {
  const N = 14;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const spine: Array<{ x: number; y: number; w: number }> = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
    const d = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * t) / 2;
    left.push([px - (dy / d) * w, py + (dx / d) * w]);
    right.push([px + (dy / d) * w, py - (dx / d) * w]);
    spine.push({ x: px, y: py, w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0]![0], left[0]![1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  const tip = spine[N]!;
  const prev = spine[N - 1]!;
  const td = Math.hypot(tip.x - prev.x, tip.y - prev.y) || 1;
  ctx.lineTo(tip.x + ((tip.x - prev.x) / td) * tip.w * 1.4, tip.y + ((tip.y - prev.y) / td) * tip.w * 1.4);
  for (let i = N; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
  ctx.closePath();
  paint(ctx, fill, 2.8);
  if (suckers) {
    ctx.fillStyle = suckers;
    for (let i = 2; i < N - 1; i += 2) {
      const s = spine[i]!;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.8, s.w * 0.34) + Math.sin(time * 3 + i) * 0.15, 0, TAU);
      ctx.fill();
    }
  }
}

export interface EyeOpts {
  iris?: string;
  /** 0 open … 1 shut: a heavy upper lid. */
  lid?: number;
  /** 0 calm … 1 furious: the inner ends of the lids slam down. */
  angry?: number;
  lidColor?: string;
  dead?: boolean;
}

/** One expressive eye: shaded white, tracking iris, pupil, catch-light, slanted lid. */
export function eye(ctx: Ctx, x: number, y: number, r: number, lx: number, ly: number, side: -1 | 1, o: EyeOpts = {}): void {
  if (o.dead) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.6, r * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y - r * 0.7);
    ctx.lineTo(x + r * 0.7, y + r * 0.7);
    ctx.moveTo(x + r * 0.7, y - r * 0.7);
    ctx.lineTo(x - r * 0.7, y + r * 0.7);
    ctx.stroke();
    ctx.lineCap = 'butt';
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.12, 0, 0, TAU);
  ctx.fillStyle = rad(ctx, x - r * 0.3, y - r * 0.4, 0.5, r * 1.3, '#ffffff', '#ffffff', '#d4cde6');
  ctx.fill();
  ctx.clip();
  const ix = x + lx * r * 0.34;
  const iy = y + ly * r * 0.3;
  ctx.fillStyle = rad(ctx, ix - r * 0.15, iy - r * 0.2, 0.3, r * 0.62, o.iris ?? '#8a5a2b', '#3a2210');
  ctx.beginPath();
  ctx.arc(ix, iy, r * 0.62, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(ix, iy, r * 0.33, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ix - r * 0.22, iy - r * 0.24, r * 0.16, 0, TAU);
  ctx.fill();
  const lid = o.lid ?? 0;
  const angry = o.angry ?? 0;
  if (lid > 0 || angry > 0) {
    ctx.fillStyle = o.lidColor ?? INK;
    ctx.beginPath();
    const top = y - r * 1.3;
    const drop = lid * r * 1.6;
    // the inner end (towards the nose) sits lower than the outer end
    const inner = y - r * 1.2 + drop + angry * r * 1.25;
    const outer = y - r * 1.2 + drop - angry * r * 0.1;
    const leftY = side === 1 ? inner : outer;
    const rightY = side === 1 ? outer : inner;
    ctx.moveTo(x - r * 1.3, top);
    ctx.lineTo(x + r * 1.3, top);
    ctx.lineTo(x + r * 1.3, rightY + r * 0.1);
    ctx.lineTo(x - r * 1.3, leftY + r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.12, 0, 0, TAU);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.4, r * 0.34);
  ctx.stroke();
}

export function eyePair(ctx: Ctx, cx: number, cy: number, gap: number, r: number, lx: number, ly: number, o: EyeOpts = {}): void {
  eye(ctx, cx - gap, cy, r, lx, ly, -1, o);
  eye(ctx, cx + gap, cy, r, lx, ly, 1, o);
}

/** A mouth: dark cavity, a tongue, and a row of fangs top and bottom. `open` is in px. */
export function maw(ctx: Ctx, cx: number, cy: number, w: number, open: number, teeth = 5, tooth = '#fffbe8', tongue = '#d9506a'): void {
  const h = Math.max(1.5, open);
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx, cy - h * 0.5, cx + w, cy);
  ctx.quadraticCurveTo(cx, cy + h * 1.6, cx - w, cy);
  ctx.closePath();
  ctx.fillStyle = '#2a0d1c';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = tongue;
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.95, w * 0.6, h * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = tooth;
  for (let i = 0; i < teeth; i++) {
    const tx = cx - w + ((i + 0.5) / teeth) * w * 2;
    const th = Math.min(h * 0.7, 3.2 + (i % 2) * 1.4);
    ctx.beginPath();
    ctx.moveTo(tx - w / teeth * 0.45, cy - 1);
    ctx.lineTo(tx, cy + th);
    ctx.lineTo(tx + w / teeth * 0.45, cy - 1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - w / teeth * 0.4, cy + h * 1.4);
    ctx.lineTo(tx, cy + h * 1.4 - th * 0.8);
    ctx.lineTo(tx + w / teeth * 0.4, cy + h * 1.4);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx, cy - h * 0.5, cx + w, cy);
  ctx.quadraticCurveTo(cx, cy + h * 1.6, cx - w, cy);
  ctx.closePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function brow(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w = 3): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** A fat fist/glove: rounded, knuckled, shiny. */
export function fist(ctx: Ctx, x: number, y: number, r: number, color: string, thumbDir = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  paint(ctx, rad(ctx, x - r * 0.35, y - r * 0.4, 0.5, r * 1.3, lighten(color), color), 2.6);
  ctx.beginPath();
  ctx.ellipse(x + thumbDir * r * 0.55, y + r * 0.35, r * 0.38, r * 0.3, 0.5 * thumbDir, 0, TAU);
  paint(ctx, color, 2);
  ctx.strokeStyle = 'rgba(26, 14, 52, 0.4)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const k of [-0.3, 0.15]) {
    ctx.moveTo(x - r * 0.65, y + r * k);
    ctx.lineTo(x - r * 0.1, y + r * k);
  }
  ctx.stroke();
}

/** A wheel: tyre, tread ticks, hub and spokes. */
export function wheel(ctx: Ctx, x: number, y: number, r: number, spin: number, hub = '#b9c2d0'): void {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3d3a4a';
  ctx.lineWidth = Math.max(1.2, r * 0.22);
  for (let i = 0; i < 8; i++) {
    const a = spin + (i * TAU) / 8;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    ctx.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98);
    ctx.stroke();
  }
  ctx.fillStyle = rad(ctx, x - r * 0.15, y - r * 0.2, 0.3, r * 0.6, '#ffffff', hub);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.58, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(26, 14, 52, 0.55)';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI) / 3;
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.lineTo(x - Math.cos(a) * r * 0.5, y - Math.sin(a) * r * 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = '#6d7689';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, TAU);
  ctx.fill();
}

/** Lighten a #rrggbb / rgb() colour toward white. */
export function lighten(c: string, t = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  let r: number, g: number, b: number;
  if (m) {
    const n = parseInt(m[1]!, 16);
    r = n >> 16; g = (n >> 8) & 255; b = n & 255;
  } else {
    const rgb = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
    if (!rgb) return c;
    r = +rgb[1]!; g = +rgb[2]!; b = +rgb[3]!;
  }
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`;
}

export function darken(c: string, t = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  let r: number, g: number, b: number;
  if (m) {
    const n = parseInt(m[1]!, 16);
    r = n >> 16; g = (n >> 8) & 255; b = n & 255;
  } else {
    const rgb = /(\d+)\D+(\d+)\D+(\d+)/.exec(c);
    if (!rgb) return c;
    r = +rgb[1]!; g = +rgb[2]!; b = +rgb[3]!;
  }
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`;
}

/** Periodic blink: 0 while open, up to `shut` for a beat every few seconds. Per-enemy seeds desync it. */
export function blink(time: number, seed: number, rate = 0.21, shut = 0.9): number {
  const t = (time * rate + seed) % 1;
  if (t < 0.92) return 0;
  return Math.sin(((t - 0.92) / 0.08) * Math.PI) * shut;
}

/** True once the boss is hurt enough to rage (and still standing). */
export function raging(e: Enemy): boolean {
  return e.rageMult > 1 && !e.defeated;
}

/** Small spark/steam puffs that rise and fade. */
export function puffs(ctx: Ctx, x: number, y: number, time: number, seed: number, color = '120, 112, 130', n = 3, rise = 24): void {
  for (let i = 0; i < n; i++) {
    const age = (time * 0.8 + i / n + seed) % 1;
    ctx.fillStyle = `rgba(${color}, ${0.6 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(age * 6 + i * 2) * 3, y - age * rise, 2 + age * 4, 0, TAU);
    ctx.fill();
  }
}
