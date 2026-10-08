import { TAU } from '../core/Mathx';

export type Ctx = CanvasRenderingContext2D;

/** The whole game is drawn from this palette and nothing else. */
export const PALETTE = {
  void: '#04060a',
  floor: '#141d26',
  floorAlt: '#0f161d',
  wall: '#1e2935',
  wallTop: '#32414f',
  wallEdge: '#465a6c',
  prop: '#2a3845',
  propEdge: '#556c7f',
  propLit: '#7c93a5',
  fog: '#9fb0c0',
  fogDim: '#5d6b79',
  ink: '#05070a',
  eye: '#7df4d0',
  eyeDim: '#2e6f61',
  alarm: '#ff5468',
  warm: '#ffcf7a',
  cold: '#9fd8ff',
  player: '#dfeeea',
} as const;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
}

/** Soft radial halo. Used for every light, glow and pulse in the game. */
export function halo(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0.002 || radius <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.55, withAlpha(color, alpha * 0.35));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Accepts #rgb, #rrggbb and rgb(...) and returns an rgba string. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith('#')) {
    let r: number;
    let g: number;
    let b: number;
    if (color.length === 4) {
      r = parseInt(color[1] + color[1], 16);
      g = parseInt(color[2] + color[2], 16);
      b = parseInt(color[3] + color[3], 16);
    } else {
      r = parseInt(color.slice(1, 3), 16);
      g = parseInt(color.slice(3, 5), 16);
      b = parseInt(color.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}

/** Thin tapering line, for sight lines and silhouette limbs. */
export function taperedLine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.closePath();
}

/** Arc used for the thin awareness tell above a creature. */
export function arcMeter(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  fraction: number,
  color: string,
  alpha: number,
  width = 2,
): void {
  if (fraction <= 0.001) return;
  const spread = 1.15;
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI * 0.5 - spread * 0.5, -Math.PI * 0.5 - spread * 0.5 + spread * fraction);
  ctx.stroke();
}

/** Wedge showing where a creature is looking. Debug only, but shaped for clarity. */
export function cone(
  ctx: Ctx,
  x: number,
  y: number,
  facing: number,
  halfAngle: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
}

/**
 * Deterministic value noise, used for grain and for the subtle floor texture so
 * that nothing in the room shimmers between frames.
 */
export function hashNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function setShadow(ctx: Ctx, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function clearShadow(ctx: Ctx): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}
