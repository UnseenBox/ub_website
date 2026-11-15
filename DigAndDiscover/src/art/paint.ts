import type Phaser from 'phaser';
import type { Rng } from '../core/Random';

/** Shared canvas-2D painting helpers used by all procedural artwork. */

export const TAU = Math.PI * 2;

export interface Pt {
  x: number;
  y: number;
}

// ---------- color ----------

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function css(c: number, alpha = 1): string {
  const [r, g, b] = rgb(c);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function mix(a: number, b: number, t: number): number {
  const A = rgb(a);
  const B = rgb(b);
  const ch = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return (ch(0) << 16) | (ch(1) << 8) | ch(2);
}

export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t);
export const darken = (c: number, t: number): number => mix(c, 0x000000, t);

export function hsl(h: number, s: number, l: number): number {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

// ---------- shapes ----------

/** Irregular closed outline around the unit circle. */
export function blobPoints(rng: Rng, count: number, bump: number, squash = 1): Pt[] {
  const pts: Pt[] = [];
  const offset = rng() * TAU;
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * TAU + (rng() - 0.5) * (Math.PI / count) * 0.6;
    const r = 1 - bump * rng();
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * squash });
  }
  return pts;
}

/** Smooth closed path through the midpoints of the given outline. */
export function blobPath(pts: Pt[], cx: number, cy: number, sx: number, sy = sx): Path2D {
  const path = new Path2D();
  const n = pts.length;
  const X = (p: Pt) => cx + p.x * sx;
  const Y = (p: Pt) => cy + p.y * sy;
  const last = pts[n - 1];
  path.moveTo((X(last) + X(pts[0])) / 2, (Y(last) + Y(pts[0])) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    path.quadraticCurveTo(X(a), Y(a), (X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2);
  }
  path.closePath();
  return path;
}

export function fillBlob(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number, fill: string, bump = 0.25, squash = 0.85): void {
  ctx.fillStyle = fill;
  ctx.fill(blobPath(blobPoints(rng, 9, bump, squash), x, y, r));
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fill();
}

export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// ---------- textures ----------

/** Creates (or replaces) a canvas texture and paints it once. */
export function makeCanvasTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Phaser.Textures.CanvasTexture {
  if (textures.exists(key)) textures.remove(key);
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const tex = textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Could not create canvas texture "${key}"`);
  draw(tex.getContext(), w, h);
  tex.refresh();
  return tex;
}
