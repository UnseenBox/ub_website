import { INK } from '../core/constants';

export type Ctx = CanvasRenderingContext2D;
export type PathFn = (ctx: Ctx) => void;

export const GAME_FONT = '"Bahnschrift", "DIN Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

/** Handwriting, typewriter and poster faces, all from fonts already on the player's device. */
export const HAND_FONT = '"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", "Chalkboard SE", cursive';
export const TYPE_FONT = '"Courier New", Courier, monospace';
export const SHOUT_FONT = 'Impact, "Haettenschweiler", "Arial Narrow Bold", "Arial Black", sans-serif';

const LAYER_STEP = 3;

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function layer(ctx: Ctx, x: number, y: number, angle: number, path: PathFn): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.save();
  ctx.transform(c, s, -s, c, x, y);
  ctx.beginPath();
  path(ctx);
  ctx.restore();
}

/**
 * The game's core drawing trick: a flat top-down shape extruded straight up the screen,
 * which gives the room its slightly-angled look. `from`/`to` are heights above the floor.
 */
export function prism(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  from: number,
  to: number,
  path: PathFn,
  side: string,
  top: string,
  outline: string = INK,
  outlineWidth = 4.5,
): void {
  ctx.lineJoin = 'round';
  if (outlineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = outlineWidth;
    for (let h = from; h < to; h += LAYER_STEP) {
      layer(ctx, x, y - h, angle, path);
      ctx.stroke();
    }
    layer(ctx, x, y - to, angle, path);
    ctx.stroke();
  }
  ctx.fillStyle = side;
  for (let h = from; h < to; h += LAYER_STEP) {
    layer(ctx, x, y - h, angle, path);
    ctx.fill();
  }
  layer(ctx, x, y - to, angle, path);
  ctx.fillStyle = top;
  ctx.fill();
}

/** Runs `draw` in the local frame of a prism's top face. */
export function onTop(ctx: Ctx, x: number, y: number, angle: number, height: number, draw: PathFn): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  ctx.save();
  ctx.transform(c, s, -s, c, x, y - height);
  draw(ctx);
  ctx.restore();
}

function parse(hex: string): [number, number, number] {
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mixCache = new Map<string, string>();

/** Blends two hex colours. Quantised and cached, so it is safe to call every frame. */
export function mix(a: string, b: string, t: number): string {
  const q = Math.round(Math.min(1, Math.max(0, t)) * 12);
  if (q === 0) return a;
  const key = `${a}${b}${q}`;
  let value = mixCache.get(key);
  if (value === undefined) {
    const ca = parse(a);
    const cb = parse(b);
    const f = q / 12;
    value = `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * f)},${Math.round(ca[1] + (cb[1] - ca[1]) * f)},${Math.round(ca[2] + (cb[2] - ca[2]) * f)})`;
    mixCache.set(key, value);
  }
  return value;
}

/** Cheap deterministic noise in [0,1) for flicker that must not use the gameplay RNG. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function label(ctx: Ctx, text: string, x: number, y: number, size: number, fill: string, strokeWidth = 5): void {
  ctx.font = `italic 800 ${size}px ${GAME_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (strokeWidth > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
