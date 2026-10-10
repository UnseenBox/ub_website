import { TAU } from '../core/Mathx';

export type Ctx = CanvasRenderingContext2D;

/**
 * ART DIRECTION
 *
 * The room is a photograph taken in one colour. A single light source floods it
 * with a saturated hue; everything the light does not touch is true black, not
 * dark grey. Geometry is read almost entirely from the bright edge it catches on
 * the side facing the light.
 *
 * Because the scene is composited through a coloured light map with `multiply`,
 * the materials below are deliberately *pale*. They are not what you see: they
 * are what the light has to work with. A floor painted #6d7780 here lands on
 * screen as deep toxic green, or sodium amber, or nothing at all.
 *
 * Only three things in the game are allowed to keep their own colour, drawn
 * after the lighting: the cursor, which is the eye; gold, which is what you came
 * for; and red, which is violence and nothing else.
 */
export const PALETTE = {
  void: '#000000',

  // Materials, pre-light. Pale on purpose.
  floor: '#6f7a84',
  floorDeep: '#59636c',
  floorMark: '#39434c',
  wall: '#929ca6',
  wallTop: '#c6d0da',
  wallShadow: '#1b2026',
  prop: '#8d97a1',
  propDeep: '#6b757f',
  propEdge: '#98a3ad',
  propLit: '#c3ced8',
  rim: '#eef6ff',

  // Post-light accents. These keep their colour whatever the room is lit with.
  eye: '#8dffe0',
  eyeDim: '#2f7f6d',
  blood: '#c4142c',
  bloodDark: '#8c0f1d',
  gold: '#ffc44d',
  warm: '#ffc96b',
  cold: '#9fd8ff',
  alarm: '#ff3b52',
  player: '#f2f7ff',
  fog: '#9fb0c0',
  fogDim: '#5d6b79',
  ink: '#05070a',
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

/**
 * The bright edge a surface catches on the side facing a light.
 *
 * This is what makes the geometry readable once the darkness pass has taken
 * everything else away, and it is most of why the rooms look lit rather than
 * merely tinted. Only the two edges of the box that face the light are drawn.
 */
export function rimLightRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  lightX: number,
  lightY: number,
  strength: number,
  width = 1.6,
): void {
  if (strength <= 0.02) return;
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const dx = lightX - cx;
  const dy = lightY - cy;

  ctx.save();
  ctx.strokeStyle = withAlpha(PALETTE.rim, Math.min(0.95, strength));
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (dx > 0) {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
  }
  if (dy > 0) {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** The same idea for a round silhouette: an arc on the lit side. */
export function rimLightCircle(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  lightX: number,
  lightY: number,
  strength: number,
  width = 1.6,
): void {
  if (strength <= 0.02) return;
  const a = Math.atan2(lightY - y, lightX - x);
  ctx.save();
  ctx.strokeStyle = withAlpha(PALETTE.rim, Math.min(0.95, strength));
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, a - 1.15, a + 1.15);
  ctx.stroke();
  ctx.restore();
}

/**
 * The survey cross. The floors of these rooms are marked out in a grid of them,
 * as though the whole building had been measured by somebody before you arrived.
 * It is the one piece of set dressing that appears in every room.
 */
export function surveyMark(ctx: Ctx, x: number, y: number, size: number, alpha: number): void {
  ctx.strokeStyle = withAlpha(PALETTE.floorMark, alpha);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
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
