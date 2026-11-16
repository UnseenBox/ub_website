import type Phaser from 'phaser';
import { TAU, ellipse, makeCanvasTexture } from './paint';

/**
 * A designed set of painted UI icons. Every icon is drawn procedurally on a
 * 128 x 128 transparent canvas with the same recipe: chunky dark-brown
 * outline, soft gradient body, one glossy highlight, darker lower edge.
 * No fonts and no bitmaps are used, so every glyph is a path or a stroke.
 */

/** Every icon key in this set. */
export const UI_ICON_KEYS = [
  'pickaxe',
  'shovel',
  'rock',
  'gem',
  'bolt',
  'refill',
  'clock',
  'sun',
  'moon',
  'ruler',
  'store',
  'target',
  'bag',
  'lock',
  'check',
  'cross',
  'play',
  'watch',
  'back',
  'magnifier',
  'flag',
  'bricks',
  'stopwatch',
  'sparkle',
  'zzz',
  'cash',
  'ledger',
  'house',
  'food',
  'water',
  'power',
  'calendar',
  'warning',
  'skull',
  'trophy',
  'junk',
  'deposit',
  'scanner',
  'swing',
] as const;

export type UiIconKey = typeof UI_ICON_KEYS[number];

/** Canvas size of every icon texture. */
export const UI_ICON_SIZE = 128;

const INK = '#3b2616';

/** Texture key of an icon: 'ui-' + key. */
export function uiIcon(key: UiIconKey): string {
  return 'ui-' + key;
}

// ---------- shared painting helpers ----------

function linGrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: string[],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  return g;
}

function radGrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: string[],
): CanvasGradient {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(i / (stops.length - 1), stops[i]);
  return g;
}

/** Chunky dark-brown outline of the current path. */
function ink(ctx: CanvasRenderingContext2D, width = 6): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Fills a shape and gives it the chunky dark-brown outline. */
function shape(ctx: CanvasRenderingContext2D, path: Path2D, fill: string | CanvasGradient, width = 6): void {
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
}

/** Darker lower edge: soft shadow clipped inside the given shape. */
function shadeBottom(ctx: CanvasRenderingContext2D, shape: Path2D, top: number, bottom: number, alpha = 0.3): void {
  ctx.save();
  ctx.clip(shape);
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(45,22,6,0)');
  g.addColorStop(1, `rgba(45,22,6,${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.restore();
}

/** One soft white highlight. */
function gloss(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0, alpha = 0.45): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.restore();
}

/** Four point sparkle shape. */
function sparklePath(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.moveTo(cx, cy - r);
  p.quadraticCurveTo(cx + r * 0.16, cy - r * 0.16, cx + r, cy);
  p.quadraticCurveTo(cx + r * 0.16, cy + r * 0.16, cx, cy + r);
  p.quadraticCurveTo(cx - r * 0.16, cy + r * 0.16, cx - r, cy);
  p.quadraticCurveTo(cx - r * 0.16, cy - r * 0.16, cx, cy - r);
  p.closePath();
  return p;
}

const WOOD = ['#c98a4c', '#9c6229', '#6b3d16'];
const WOOD_DARK = ['#8a5a2c', '#6a3f18', '#442509'];
const STEEL = ['#d3dde8', '#93a4b6', '#5d6d80'];
const STEEL_DARK = ['#9aa8b8', '#6e7d8d', '#47535f'];
const ROCK = ['#bdb6a8', '#8d8578', '#5c554b'];
const CYAN = ['#9df0ff', '#3cc0ef', '#1379b4'];
const YELLOW = ['#fff09a', '#ffc53a', '#ef8c15'];
const GOLD = ['#ffe9a3', '#f2b233', '#b4721a'];
const GREEN = ['#a6ef83', '#57c451', '#2b8a2c'];
const RED = ['#ff9c85', '#e5493b', '#9e241f'];
const BLUE = ['#9ad8ff', '#3f9fe8', '#1f5f9c'];
const BRASS = ['#ffe6a8', '#dfa341', '#9d6417'];
const CREAM = ['#fff6e4', '#f2dfb4', '#cdb482'];

/** A Z made of three straight strokes. */
function zPath(x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D();
  p.moveTo(x, y);
  p.lineTo(x + w, y);
  p.lineTo(x, y + h);
  p.lineTo(x + w, y + h);
  return p;
}

// ---------- painters ----------

function pPickaxe(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(64, 70);
  ctx.rotate(Math.PI / 4);

  const handle = new Path2D();
  roundRectPath(handle, -7, -12, 14, 62, 7);

  const head = new Path2D();
  head.moveTo(-48, -20);
  head.lineTo(-33, -42);
  head.quadraticCurveTo(0, -58, 33, -42);
  head.lineTo(48, -20);
  head.lineTo(30, -29);
  head.quadraticCurveTo(0, -40, -30, -29);
  head.closePath();

  shape(ctx, handle, linGrad(ctx, -8, 0, 8, 0, WOOD), 5);
  ctx.strokeStyle = 'rgba(50,28,10,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-2, 42);
  ctx.stroke();

  shape(ctx, head, linGrad(ctx, 0, -52, 0, -18, STEEL), 6);
  shadeBottom(ctx, head, -28, -14, 0.26);
  gloss(ctx, -14, -38, 12, 4, -0.5, 0.5);
  ctx.restore();
}

function pShovel(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(64, 62);
  ctx.rotate(Math.PI / 4);

  const ring = new Path2D();
  ring.arc(0, -46, 18, 0, TAU);
  ring.arc(0, -46, 9, 0, TAU, true);
  ctx.fillStyle = linGrad(ctx, -18, -64, 18, -28, WOOD);
  ctx.fill(ring, 'evenodd');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(ring);

  const shaft = new Path2D();
  roundRectPath(shaft, -7, -30, 14, 52, 7);
  shape(ctx, shaft, linGrad(ctx, -8, 0, 8, 0, WOOD), 5);

  const blade = new Path2D();
  blade.moveTo(-21, 18);
  blade.lineTo(21, 18);
  blade.lineTo(15, 46);
  blade.quadraticCurveTo(0, 60, -15, 46);
  blade.closePath();
  shape(ctx, blade, linGrad(ctx, -21, 18, 21, 58, STEEL_DARK), 6);
  shadeBottom(ctx, blade, 30, 58, 0.3);
  gloss(ctx, -9, 28, 5, 9, 0.2, 0.4);
  ctx.restore();
}

function pRock(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  const pts: [number, number][] = [
    [64, 16],
    [93, 24],
    [110, 50],
    [102, 79],
    [75, 96],
    [45, 92],
    [22, 70],
    [27, 42],
    [44, 22],
  ];
  body.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) body.lineTo(pts[i][0], pts[i][1]);
  body.closePath();

  shape(ctx, body, radGrad(ctx, 44, 34, 4, 64, 60, 70, ROCK), 6);
  shadeBottom(ctx, body, 58, 100, 0.32);

  ctx.strokeStyle = 'rgba(60,48,36,0.75)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(80, 30);
  ctx.lineTo(74, 48);
  ctx.lineTo(86, 58);
  ctx.moveTo(40, 56);
  ctx.lineTo(52, 66);
  ctx.lineTo(44, 78);
  ctx.stroke();

  gloss(ctx, 46, 32, 16, 9, -0.5, 0.42);
}

function pGem(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  body.moveTo(50, 24);
  body.lineTo(78, 24);
  body.lineTo(106, 52);
  body.lineTo(64, 108);
  body.lineTo(22, 52);
  body.closePath();

  shape(ctx, body, linGrad(ctx, 30, 20, 96, 104, CYAN), 6);

  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(50, 24);
  ctx.lineTo(78, 24);
  ctx.lineTo(64, 108);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 24);
  ctx.lineTo(22, 52);
  ctx.moveTo(64, 24);
  ctx.lineTo(106, 52);
  ctx.moveTo(22, 52);
  ctx.lineTo(106, 52);
  ctx.moveTo(64, 24);
  ctx.lineTo(64, 108);
  ctx.stroke();

  gloss(ctx, 42, 34, 10, 5, -0.6, 0.55);
}

function pBolt(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  body.moveTo(74, 10);
  body.lineTo(38, 68);
  body.lineTo(60, 68);
  body.lineTo(48, 118);
  body.lineTo(96, 52);
  body.lineTo(72, 52);
  body.closePath();

  shape(ctx, body, linGrad(ctx, 40, 10, 90, 118, YELLOW), 6);
  shadeBottom(ctx, body, 60, 118, 0.28);
  gloss(ctx, 60, 40, 8, 16, 0.25, 0.45);
}

function pRefill(ctx: CanvasRenderingContext2D): void {
  const a0 = Math.PI * 0.35;
  const a1 = Math.PI * 1.85;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(64, 66, 44, a0, a1);
  ctx.stroke();
  ctx.strokeStyle = '#3f9fe8';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(64, 66, 44, a0, a1);
  ctx.stroke();

  const hx = 64 + Math.cos(a1) * 44;
  const hy = 66 + Math.sin(a1) * 44;
  const head = new Path2D();
  head.moveTo(hx + 12, hy - 10);
  head.lineTo(hx - 12, hy - 4);
  head.lineTo(hx - 2, hy + 14);
  head.closePath();
  shape(ctx, head, linGrad(ctx, hx - 12, hy - 10, hx + 12, hy + 14, BLUE), 5);

  const bolt = new Path2D();
  bolt.moveTo(70, 36);
  bolt.lineTo(46, 74);
  bolt.lineTo(62, 74);
  bolt.lineTo(54, 104);
  bolt.lineTo(84, 62);
  bolt.lineTo(68, 62);
  bolt.closePath();
  shape(ctx, bolt, linGrad(ctx, 50, 36, 80, 104, YELLOW), 5);
}

function pClock(ctx: CanvasRenderingContext2D): void {
  const rim = new Path2D();
  rim.arc(64, 64, 54, 0, TAU);
  shape(ctx, rim, radGrad(ctx, 46, 44, 4, 64, 64, 56, BRASS), 6);

  const face = new Path2D();
  face.arc(64, 64, 42, 0, TAU);
  ctx.fillStyle = radGrad(ctx, 52, 50, 2, 64, 64, 44, CREAM);
  ctx.fill(face);
  ctx.strokeStyle = 'rgba(90,62,26,0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke(face);

  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const long = i % 3 === 0;
    const r1 = long ? 30 : 34;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1);
    ctx.lineTo(64 + Math.cos(a) * 39, 64 + Math.sin(a) * 39);
    ctx.stroke();
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(64, 64);
  ctx.lineTo(64 - 19, 64 - 13);
  ctx.moveTo(64, 64);
  ctx.lineTo(64 + 24, 64 - 16);
  ctx.stroke();

  ctx.fillStyle = INK;
  ellipse(ctx, 64, 64, 5, 5);
  gloss(ctx, 46, 42, 11, 7, -0.6, 0.4);
}

function pSun(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
    ctx.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f2a92c';
  ctx.lineWidth = 8;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
    ctx.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
    ctx.stroke();
  }

  const body = new Path2D();
  body.arc(64, 64, 36, 0, TAU);
  shape(ctx, body, radGrad(ctx, 50, 48, 3, 64, 64, 38, YELLOW), 6);
  gloss(ctx, 50, 46, 11, 8, -0.6, 0.5);
}

function pMoon(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  body.moveTo(80, 14);
  body.quadraticCurveTo(12, 64, 80, 114);
  body.quadraticCurveTo(54, 64, 80, 14);
  body.closePath();
  shape(ctx, body, linGrad(ctx, 40, 20, 90, 110, CREAM), 6);
  gloss(ctx, 56, 44, 7, 15, 0.3, 0.45);

  const s = sparklePath(98, 40, 16);
  shape(ctx, s, linGrad(ctx, 86, 26, 110, 56, GOLD), 4);
}

function pRuler(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  roundRectPath(body, 42, 10, 44, 108, 10);
  shape(ctx, body, linGrad(ctx, 42, 0, 86, 0, WOOD), 6);
  shadeBottom(ctx, body, 70, 118, 0.28);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = 24 + i * 11;
    const long = i % 2 === 0;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(48 + (long ? 22 : 13), y);
    ctx.stroke();
  }
  gloss(ctx, 52, 24, 4, 10, 0.1, 0.35);
}

function pStore(ctx: CanvasRenderingContext2D): void {
  const body = new Path2D();
  roundRectPath(body, 24, 58, 80, 48, 8);
  shape(ctx, body, linGrad(ctx, 24, 58, 104, 106, CREAM), 6);

  const awn = new Path2D();
  awn.moveTo(14, 38);
  awn.lineTo(114, 38);
  awn.lineTo(104, 62);
  awn.lineTo(24, 62);
  awn.closePath();
  ctx.save();
  ctx.clip(awn);
  ctx.fillStyle = '#e5493b';
  ctx.fillRect(14, 38, 100, 24);
  ctx.fillStyle = '#fff3dc';
  for (let i = 0; i < 5; i += 2) ctx.fillRect(14 + i * 20, 38, 20, 24);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke(awn);

  const door = new Path2D();
  roundRectPath(door, 82, 76, 16, 30, 6);
  shape(ctx, door, '#8a5a2c', 4);

  const win = new Path2D();
  roundRectPath(win, 32, 76, 26, 20, 5);
  shape(ctx, win, '#8fd3ff', 4);

  const counter = new Path2D();
  roundRectPath(counter, 16, 100, 96, 14, 5);
  shape(ctx, counter, linGrad(ctx, 16, 100, 112, 114, WOOD_DARK), 6);
  gloss(ctx, 30, 40, 10, 3, -0.1, 0.35);
}

function pTarget(ctx: CanvasRenderingContext2D): void {
  const rings: [number, string][] = [
    [50, '#e5493b'],
    [34, '#fff3dc'],
    [18, '#e5493b'],
  ];
  for (const [r, color] of rings) {
    const c = new Path2D();
    c.arc(64, 64, r, 0, TAU);
    shape(ctx, c, color, 5);
  }
  const dot = new Path2D();
  dot.arc(64, 64, 7, 0, TAU);
  shape(ctx, dot, '#fff3dc', 4);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(38, 96);
  ctx.lineTo(76, 56);
  ctx.stroke();
  ctx.strokeStyle = '#e8e3d6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(38, 96);
  ctx.lineTo(76, 56);
  ctx.stroke();

  const tip = new Path2D();
  tip.moveTo(86, 44);
  tip.lineTo(64, 52);
  tip.lineTo(78, 66);
  tip.closePath();
  shape(ctx, tip, linGrad(ctx, 64, 44, 86, 66, STEEL), 4);

  const fletch = new Path2D();
  fletch.moveTo(30, 104);
  fletch.lineTo(44, 96);
  fletch.lineTo(44, 88);
  fletch.closePath();
  shape(ctx, fletch, '#e5493b', 4);
}

function pBag(ctx: CanvasRenderingContext2D): void {
  const neck = new Path2D();
  roundRectPath(neck, 48, 30, 32, 22, 8);
  shape(ctx, neck, linGrad(ctx, 48, 30, 80, 52, WOOD_DARK), 5);

  const body = new Path2D();
  body.moveTo(46, 48);
  body.quadraticCurveTo(20, 84, 26, 104);
  body.quadraticCurveTo(64, 122, 102, 104);
  body.quadraticCurveTo(108, 84, 82, 48);
  body.closePath();
  shape(ctx, body, linGrad(ctx, 30, 50, 100, 118, ['#e3c896', '#c8a26b', '#96703f']), 6);
  shadeBottom(ctx, body, 70, 116, 0.28);

  ctx.strokeStyle = 'rgba(110,78,40,0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(44, 62);
  ctx.quadraticCurveTo(64, 74, 84, 62);
  ctx.moveTo(40, 86);
  ctx.quadraticCurveTo(64, 96, 88, 86);
  ctx.stroke();

  gloss(ctx, 46, 72, 8, 16, 0.35, 0.35);
}

function pLock(ctx: CanvasRenderingContext2D): void {
  const shackle = new Path2D();
  shackle.arc(64, 52, 20, Math.PI, TAU);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.stroke(shackle);
  ctx.strokeStyle = '#e0a83c';
  ctx.lineWidth = 9;
  ctx.stroke(shackle);

  const body = new Path2D();
  roundRectPath(body, 34, 50, 60, 54, 14);
  shape(ctx, body, linGrad(ctx, 34, 50, 94, 104, GOLD), 6);
  shadeBottom(ctx, body, 78, 104, 0.26);

  ctx.fillStyle = INK;
  ellipse(ctx, 64, 70, 7, 7);
  ctx.beginPath();
  ctx.moveTo(59, 72);
  ctx.lineTo(69, 72);
  ctx.lineTo(67, 88);
  ctx.lineTo(61, 88);
  ctx.closePath();
  ctx.fill();

  gloss(ctx, 44, 60, 6, 10, 0.4, 0.4);
}

function pCheck(ctx: CanvasRenderingContext2D): void {
  const badge = new Path2D();
  badge.arc(64, 64, 52, 0, TAU);
  shape(ctx, badge, radGrad(ctx, 46, 44, 4, 64, 64, 54, GREEN), 6);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(38, 66);
  ctx.lineTo(56, 84);
  ctx.lineTo(92, 44);
  ctx.stroke();
  gloss(ctx, 44, 40, 12, 8, -0.6, 0.35);
}

function pCross(ctx: CanvasRenderingContext2D): void {
  const badge = new Path2D();
  badge.arc(64, 64, 52, 0, TAU);
  shape(ctx, badge, radGrad(ctx, 46, 44, 4, 64, 64, 54, RED), 6);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(42, 42);
  ctx.lineTo(86, 86);
  ctx.moveTo(86, 42);
  ctx.lineTo(42, 86);
  ctx.stroke();
  gloss(ctx, 44, 40, 12, 8, -0.6, 0.3);
}

function pPlay(ctx: CanvasRenderingContext2D): void {
  const badge = new Path2D();
  roundRectPath(badge, 14, 26, 100, 76, 28);
  shape(ctx, badge, linGrad(ctx, 14, 26, 114, 102, GREEN), 6);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(14, 54);
  ctx.lineTo(114, 54);
  ctx.lineTo(114, 26);
  ctx.lineTo(14, 26);
  ctx.closePath();
  ctx.fill();

  const tri = new Path2D();
  tri.moveTo(48, 40);
  tri.lineTo(90, 64);
  tri.lineTo(48, 88);
  tri.closePath();
  shape(ctx, tri, '#ffffff', 5);
}

function pWatch(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(64, 40);
  ctx.lineTo(40, 14);
  ctx.moveTo(64, 40);
  ctx.lineTo(90, 16);
  ctx.stroke();
  ctx.strokeStyle = '#9aa6b2';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 40);
  ctx.lineTo(40, 14);
  ctx.moveTo(64, 40);
  ctx.lineTo(90, 16);
  ctx.stroke();

  const body = new Path2D();
  roundRectPath(body, 16, 40, 96, 66, 12);
  shape(ctx, body, linGrad(ctx, 16, 40, 112, 106, ['#6f7f90', '#46525e', '#2c333c']), 6);

  const screen = new Path2D();
  roundRectPath(screen, 26, 50, 76, 46, 7);
  shape(ctx, screen, linGrad(ctx, 26, 50, 102, 96, ['#2f4a5c', '#1b2c38']), 4);

  const tri = new Path2D();
  tri.moveTo(56, 60);
  tri.lineTo(80, 73);
  tri.lineTo(56, 86);
  tri.closePath();
  shape(ctx, tri, '#ff9f2e', 4);

  const legL = new Path2D();
  roundRectPath(legL, 30, 106, 12, 12, 4);
  const legR = new Path2D();
  roundRectPath(legR, 86, 106, 12, 12, 4);
  shape(ctx, legL, '#46525e', 4);
  shape(ctx, legR, '#46525e', 4);
}

function pBack(ctx: CanvasRenderingContext2D): void {
  const badge = new Path2D();
  roundRectPath(badge, 14, 26, 100, 76, 28);
  shape(ctx, badge, linGrad(ctx, 14, 26, 114, 102, BLUE), 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(14, 54);
  ctx.lineTo(114, 54);
  ctx.lineTo(114, 26);
  ctx.lineTo(14, 26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(44, 42);
  ctx.lineTo(44, 86);
  ctx.lineTo(84, 64);
  ctx.closePath();
  ctx.fill();
  ink(ctx, 5);
  const shaft = new Path2D();
  roundRectPath(shaft, 60, 56, 30, 16, 6);
  shape(ctx, shaft, '#ffffff', 5);
}

function pMagnifier(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 4);

  const handle = new Path2D();
  roundRectPath(handle, -8, 26, 16, 46, 8);
  shape(ctx, handle, linGrad(ctx, -8, 26, 8, 72, WOOD_DARK), 6);

  const rim = new Path2D();
  rim.arc(0, -8, 36, 0, TAU);
  shape(ctx, rim, linGrad(ctx, -36, -44, 36, 28, STEEL), 6);

  const lens = new Path2D();
  lens.arc(0, -8, 26, 0, TAU);
  ctx.fillStyle = radGrad(ctx, -10, -20, 2, 0, -8, 28, ['#bfeaff', '#63b6ea', '#2a72a8']);
  ctx.fill(lens);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke(lens);

  gloss(ctx, -12, -22, 9, 5, -0.7, 0.55);
  ctx.restore();
}

function pFlag(ctx: CanvasRenderingContext2D): void {
  const mound = new Path2D();
  mound.moveTo(14, 112);
  mound.quadraticCurveTo(40, 88, 64, 96);
  mound.quadraticCurveTo(92, 88, 116, 112);
  mound.closePath();
  shape(ctx, mound, linGrad(ctx, 14, 90, 116, 114, ['#a8703c', '#7d4c22', '#523010']), 5);

  const pole = new Path2D();
  roundRectPath(pole, 56, 14, 11, 96, 5);
  shape(ctx, pole, linGrad(ctx, 56, 0, 67, 0, WOOD), 5);

  const pennant = new Path2D();
  pennant.moveTo(67, 18);
  pennant.lineTo(112, 34);
  pennant.lineTo(67, 52);
  pennant.closePath();
  shape(ctx, pennant, linGrad(ctx, 67, 18, 112, 52, RED), 5);
  gloss(ctx, 76, 26, 7, 4, 0.2, 0.35);
}

function pBricks(ctx: CanvasRenderingContext2D): void {
  const wall = new Path2D();
  roundRectPath(wall, 12, 26, 104, 80, 6);
  ctx.fillStyle = '#f4e2bd';
  ctx.fill(wall);

  const rows = 4;
  const rh = 20;
  for (let r = 0; r < rows; r++) {
    const y = 26 + r * rh;
    const offset = r % 2 === 0 ? 0 : -13;
    for (let c = 0; c < 3; c++) {
      const x = 12 + offset + c * 26;
      if (x < 12 || x > 90) continue;
      const b = new Path2D();
      roundRectPath(b, x + 2, y + 2, 22, rh - 4, 3);
      ctx.fillStyle = r % 3 === 0 ? '#b4553c' : '#c2644a';
      ctx.fill(b);
      ctx.strokeStyle = 'rgba(110,48,26,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke(b);
    }
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke(wall);
}

function pStopwatch(ctx: CanvasRenderingContext2D): void {
  const stem = new Path2D();
  roundRectPath(stem, 56, 12, 14, 20, 4);
  shape(ctx, stem, linGrad(ctx, 56, 12, 70, 32, STEEL_DARK), 5);

  const knob = new Path2D();
  roundRectPath(knob, 48, 4, 30, 12, 5);
  shape(ctx, knob, linGrad(ctx, 48, 4, 78, 16, STEEL), 5);

  const knob2 = new Path2D();
  roundRectPath(knob2, 92, 42, 16, 22, 5);
  shape(ctx, knob2, linGrad(ctx, 92, 42, 108, 64, STEEL), 5);

  const body = new Path2D();
  body.arc(64, 72, 44, 0, TAU);
  shape(ctx, body, radGrad(ctx, 46, 52, 4, 64, 72, 46, STEEL), 6);

  const face = new Path2D();
  face.arc(64, 72, 33, 0, TAU);
  ctx.fillStyle = radGrad(ctx, 54, 60, 2, 64, 72, 34, CREAM);
  ctx.fill(face);
  ctx.strokeStyle = 'rgba(90,62,26,0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke(face);

  ctx.fillStyle = INK;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ellipse(ctx, 64 + Math.cos(a) * 26, 72 + Math.sin(a) * 26, 2, 2);
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(64, 72);
  ctx.lineTo(64, 52);
  ctx.moveTo(64, 72);
  ctx.lineTo(80, 80);
  ctx.stroke();
  gloss(ctx, 44, 50, 10, 6, -0.6, 0.4);
}

function pSparkle(ctx: CanvasRenderingContext2D): void {
  const big = sparklePath(58, 62, 46);
  shape(ctx, big, linGrad(ctx, 20, 20, 96, 104, GOLD), 5);
  const small = sparklePath(98, 32, 20);
  shape(ctx, small, linGrad(ctx, 80, 14, 116, 52, YELLOW), 4);
  const tiny = sparklePath(102, 92, 14);
  shape(ctx, tiny, linGrad(ctx, 90, 80, 114, 106, YELLOW), 4);
  gloss(ctx, 44, 40, 7, 12, 0.3, 0.5);
}

function pZzz(ctx: CanvasRenderingContext2D): void {
  const z1 = zPath(20, 88, 28, 26);
  const z2 = zPath(50, 60, 32, 30);
  const z3 = zPath(80, 26, 36, 34);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(z1);
  ctx.stroke(z2);
  ctx.stroke(z3);
  ctx.strokeStyle = '#5fb2e8';
  ctx.lineWidth = 5;
  ctx.stroke(z1);
  ctx.stroke(z2);
  ctx.stroke(z3);
}

function pCash(ctx: CanvasRenderingContext2D): void {
  const note = new Path2D();
  roundRectPath(note, 12, 38, 104, 52, 10);
  shape(ctx, note, linGrad(ctx, 12, 38, 116, 90, ['#8ce07a', '#4cb04c', '#2a7a2f']), 6);
  shadeBottom(ctx, note, 62, 90, 0.22);

  const inner = new Path2D();
  roundRectPath(inner, 22, 48, 84, 32, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.stroke(inner);

  ctx.strokeStyle = '#f6ffe8';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(64, 46);
  ctx.lineTo(64, 82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(72, 52);
  ctx.bezierCurveTo(72, 44, 56, 44, 56, 52);
  ctx.bezierCurveTo(56, 58, 72, 56, 72, 63);
  ctx.bezierCurveTo(72, 71, 56, 71, 56, 62);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, 30, 52, 6, 4, -0.3);
  gloss(ctx, 34, 50, 10, 4, -0.2, 0.35);
}

function pLedger(ctx: CanvasRenderingContext2D): void {
  const pages = new Path2D();
  roundRectPath(pages, 30, 22, 78, 86, 6);
  shape(ctx, pages, linGrad(ctx, 30, 22, 108, 108, CREAM), 5);

  const cover = new Path2D();
  roundRectPath(cover, 18, 16, 76, 92, 9);
  shape(ctx, cover, linGrad(ctx, 18, 16, 94, 108, ['#a83b34', '#7d2620', '#521512']), 6);
  shadeBottom(ctx, cover, 70, 108, 0.3);

  const corner = new Path2D();
  corner.moveTo(18, 16);
  corner.lineTo(52, 16);
  corner.lineTo(18, 50);
  corner.closePath();
  shape(ctx, corner, linGrad(ctx, 18, 16, 52, 50, GOLD), 4);

  const coin = new Path2D();
  coin.arc(64, 68, 16, 0, TAU);
  shape(ctx, coin, radGrad(ctx, 56, 58, 2, 64, 68, 18, GOLD), 4);
  ctx.strokeStyle = 'rgba(140,86,16,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(64, 68, 10, 0, TAU);
  ctx.stroke();
  gloss(ctx, 54, 42, 8, 5, -0.5, 0.35);
}

function pHouse(ctx: CanvasRenderingContext2D): void {
  const chimney = new Path2D();
  roundRectPath(chimney, 84, 22, 16, 26, 3);
  shape(ctx, chimney, linGrad(ctx, 84, 22, 100, 48, ['#c2644a', '#93412c']), 5);

  const walls = new Path2D();
  roundRectPath(walls, 26, 56, 76, 56, 6);
  shape(ctx, walls, linGrad(ctx, 26, 56, 102, 112, CREAM), 6);

  const roof = new Path2D();
  roof.moveTo(10, 62);
  roof.lineTo(64, 12);
  roof.lineTo(118, 62);
  roof.closePath();
  shape(ctx, roof, linGrad(ctx, 64, 12, 64, 62, ['#f0705a', '#cf3a2c', '#8e2018']), 6);
  shadeBottom(ctx, roof, 44, 62, 0.24);

  const door = new Path2D();
  roundRectPath(door, 76, 78, 22, 34, 6);
  shape(ctx, door, linGrad(ctx, 76, 78, 98, 112, WOOD_DARK), 5);

  const win = new Path2D();
  roundRectPath(win, 38, 72, 30, 26, 5);
  shape(ctx, win, linGrad(ctx, 38, 72, 68, 98, ['#fff0a8', '#ffb13a']), 5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(53, 73);
  ctx.lineTo(53, 97);
  ctx.moveTo(39, 85);
  ctx.lineTo(67, 85);
  ctx.stroke();
  gloss(ctx, 44, 78, 6, 4, -0.4, 0.4);
}

function pFood(ctx: CanvasRenderingContext2D): void {
  const loaf = new Path2D();
  loaf.moveTo(18, 96);
  loaf.quadraticCurveTo(14, 40, 64, 38);
  loaf.quadraticCurveTo(114, 40, 110, 96);
  loaf.closePath();
  shape(ctx, loaf, linGrad(ctx, 64, 36, 64, 98, ['#f0cd8c', '#d59d4f', '#a56b28']), 6);
  shadeBottom(ctx, loaf, 66, 98, 0.28);

  ctx.strokeStyle = 'rgba(120,72,26,0.65)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const x of [44, 64, 84]) {
    ctx.beginPath();
    ctx.moveTo(x - 12, 68);
    ctx.quadraticCurveTo(x, 52, x + 12, 68);
    ctx.stroke();
  }
  gloss(ctx, 44, 54, 12, 7, -0.5, 0.4);
}

function pWater(ctx: CanvasRenderingContext2D): void {
  const drop = new Path2D();
  drop.moveTo(64, 12);
  drop.quadraticCurveTo(102, 60, 96, 80);
  drop.quadraticCurveTo(90, 108, 64, 108);
  drop.quadraticCurveTo(38, 108, 32, 80);
  drop.quadraticCurveTo(26, 60, 64, 12);
  drop.closePath();
  shape(ctx, drop, radGrad(ctx, 48, 46, 4, 64, 70, 56, ['#a8e8ff', '#42b6ef', '#1a6fb0']), 6);
  shadeBottom(ctx, drop, 70, 108, 0.24);
  gloss(ctx, 52, 60, 7, 16, 0.25, 0.6);
}

function pPower(ctx: CanvasRenderingContext2D): void {
  const glow = ctx.createRadialGradient(64, 50, 6, 64, 50, 58);
  glow.addColorStop(0, 'rgba(255,226,120,0.55)');
  glow.addColorStop(1, 'rgba(255,226,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(4, 0, 120, 110);

  const glass = new Path2D();
  glass.arc(64, 48, 30, 0, TAU);
  shape(ctx, glass, radGrad(ctx, 52, 34, 2, 64, 48, 32, ['#fff6c8', '#ffd23a', '#e08a12']), 6);

  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(58, 36);
  ctx.lineTo(46, 52);
  ctx.stroke();

  const base = new Path2D();
  roundRectPath(base, 46, 74, 36, 16, 5);
  shape(ctx, base, linGrad(ctx, 46, 74, 82, 90, STEEL), 5);

  const base2 = new Path2D();
  roundRectPath(base2, 50, 90, 28, 14, 5);
  shape(ctx, base2, linGrad(ctx, 50, 90, 78, 104, STEEL_DARK), 5);

  ctx.strokeStyle = 'rgba(70,55,40,0.6)';
  ctx.lineWidth = 3;
  for (const y of [79, 84]) {
    ctx.beginPath();
    ctx.moveTo(49, y);
    ctx.lineTo(79, y);
    ctx.stroke();
  }
}

function pCalendar(ctx: CanvasRenderingContext2D): void {
  const page = new Path2D();
  roundRectPath(page, 18, 28, 92, 86, 9);
  shape(ctx, page, linGrad(ctx, 18, 28, 110, 114, CREAM), 6);

  const header = new Path2D();
  header.moveTo(27, 28);
  header.lineTo(101, 28);
  header.quadraticCurveTo(110, 28, 110, 37);
  header.lineTo(110, 54);
  header.lineTo(18, 54);
  header.lineTo(18, 37);
  header.quadraticCurveTo(18, 28, 27, 28);
  header.closePath();
  shape(ctx, header, linGrad(ctx, 18, 28, 110, 54, ['#f0705a', '#cf3a2c']), 5);

  for (const x of [40, 88]) {
    const ring = new Path2D();
    roundRectPath(ring, x - 5, 14, 10, 22, 5);
    shape(ctx, ring, linGrad(ctx, x - 5, 14, x + 5, 36, STEEL), 5);
  }

  ctx.fillStyle = 'rgba(120,90,50,0.35)';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillRect(28 + c * 19, 62 + r * 17, 12, 11);
    }
  }
  const marked = new Path2D();
  marked.arc(28 + 2 * 19 + 6, 62 + 1 * 17 + 5, 11, 0, TAU);
  ctx.strokeStyle = '#e5493b';
  ctx.lineWidth = 3.5;
  ctx.stroke(marked);
}

function pWarning(ctx: CanvasRenderingContext2D): void {
  const tri = new Path2D();
  tri.moveTo(64, 16);
  tri.quadraticCurveTo(70, 16, 73, 23);
  tri.lineTo(114, 100);
  tri.quadraticCurveTo(120, 112, 108, 112);
  tri.lineTo(20, 112);
  tri.quadraticCurveTo(8, 112, 14, 100);
  tri.lineTo(55, 23);
  tri.quadraticCurveTo(58, 16, 64, 16);
  tri.closePath();
  shape(ctx, tri, linGrad(ctx, 64, 16, 64, 112, ['#fff0a0', '#ffc53a', '#e5890f']), 6);
  shadeBottom(ctx, tri, 80, 112, 0.22);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(64, 44);
  ctx.lineTo(64, 76);
  ctx.stroke();
  ctx.fillStyle = INK;
  ellipse(ctx, 64, 94, 6, 6);
  gloss(ctx, 50, 40, 8, 14, 0.35, 0.35);
}

function pSkull(ctx: CanvasRenderingContext2D): void {
  const jaw = new Path2D();
  roundRectPath(jaw, 40, 78, 48, 28, 10);
  shape(ctx, jaw, linGrad(ctx, 40, 78, 88, 106, CREAM), 6);

  const head = new Path2D();
  head.ellipse(64, 52, 40, 36, 0, 0, TAU);
  shape(ctx, head, radGrad(ctx, 46, 36, 4, 64, 52, 42, CREAM), 6);
  shadeBottom(ctx, head, 62, 90, 0.22);

  ctx.fillStyle = '#3a2a20';
  ellipse(ctx, 50, 50, 12, 13);
  ellipse(ctx, 78, 50, 12, 13);
  const nose = new Path2D();
  nose.moveTo(64, 62);
  nose.lineTo(70, 74);
  nose.lineTo(58, 74);
  nose.closePath();
  ctx.fillStyle = '#3a2a20';
  ctx.fill(nose);

  ctx.strokeStyle = 'rgba(90,62,26,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(48 + i * 12, 84);
    ctx.lineTo(48 + i * 12, 104);
  }
  ctx.stroke();
  gloss(ctx, 46, 32, 11, 7, -0.5, 0.4);
}

function pTrophy(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(34, 46, 18, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#e0a83c';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(94, 46, 18, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.strokeStyle = '#e0a83c';
  ctx.lineWidth = 8;
  ctx.stroke();

  const cup = new Path2D();
  cup.moveTo(38, 22);
  cup.lineTo(90, 22);
  cup.quadraticCurveTo(88, 60, 64, 70);
  cup.quadraticCurveTo(40, 60, 38, 22);
  cup.closePath();
  shape(ctx, cup, linGrad(ctx, 38, 22, 90, 70, GOLD), 6);
  shadeBottom(ctx, cup, 48, 70, 0.24);

  const stem = new Path2D();
  roundRectPath(stem, 57, 68, 14, 22, 4);
  shape(ctx, stem, linGrad(ctx, 57, 68, 71, 90, ['#f2c25a', '#c18a25']), 5);

  const base = new Path2D();
  roundRectPath(base, 42, 88, 44, 14, 5);
  shape(ctx, base, linGrad(ctx, 42, 88, 86, 102, ['#f7d488', '#c08a24']), 6);

  const foot = new Path2D();
  roundRectPath(foot, 32, 100, 64, 14, 6);
  shape(ctx, foot, linGrad(ctx, 32, 100, 96, 114, ['#f7d488', '#a9701a']), 6);
  gloss(ctx, 50, 30, 6, 10, 0.3, 0.4);
}

function pJunk(ctx: CanvasRenderingContext2D): void {
  const can = new Path2D();
  roundRectPath(can, 74, 14, 18, 30, 3);
  shape(ctx, can, linGrad(ctx, 74, 14, 92, 44, STEEL_DARK), 5);

  const body = new Path2D();
  body.moveTo(32, 46);
  body.lineTo(96, 46);
  body.lineTo(86, 112);
  body.lineTo(42, 112);
  body.closePath();
  shape(ctx, body, linGrad(ctx, 32, 46, 96, 112, ['#aab3bb', '#79838c', '#4d565e']), 6);
  shadeBottom(ctx, body, 74, 112, 0.26);

  ctx.strokeStyle = 'rgba(60,70,80,0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(48, 54);
  ctx.lineTo(46, 104);
  ctx.moveTo(64, 54);
  ctx.lineTo(63, 104);
  ctx.moveTo(80, 54);
  ctx.lineTo(78, 104);
  ctx.stroke();

  const lid = new Path2D();
  roundRectPath(lid, 24, 32, 80, 16, 6);
  shape(ctx, lid, linGrad(ctx, 24, 32, 104, 48, ['#c3ccd4', '#89939c', '#5b646c']), 6);

  const handle = new Path2D();
  roundRectPath(handle, 48, 22, 32, 10, 5);
  shape(ctx, handle, '#79838c', 5);
  gloss(ctx, 44, 54, 6, 12, 0.1, 0.3);
}

function pDeposit(ctx: CanvasRenderingContext2D): void {
  const mound = new Path2D();
  mound.moveTo(10, 116);
  mound.quadraticCurveTo(34, 58, 64, 60);
  mound.quadraticCurveTo(96, 60, 118, 116);
  mound.closePath();
  shape(ctx, mound, linGrad(ctx, 10, 60, 118, 116, ['#b07a44', '#845022', '#553013']), 6);

  const hole = new Path2D();
  hole.moveTo(42, 116);
  hole.lineTo(42, 88);
  hole.quadraticCurveTo(64, 62, 86, 88);
  hole.lineTo(86, 116);
  hole.closePath();
  shape(ctx, hole, linGrad(ctx, 42, 62, 86, 116, ['#3a2416', '#1c1109']), 5);

  const postL = new Path2D();
  roundRectPath(postL, 30, 62, 12, 52, 4);
  const postR = new Path2D();
  roundRectPath(postR, 86, 62, 12, 52, 4);
  const lintel = new Path2D();
  roundRectPath(lintel, 26, 54, 76, 14, 4);
  shape(ctx, postL, linGrad(ctx, 26, 54, 102, 114, WOOD_DARK), 5);
  shape(ctx, postR, linGrad(ctx, 26, 54, 102, 114, WOOD_DARK), 5);
  shape(ctx, lintel, linGrad(ctx, 26, 54, 102, 114, WOOD_DARK), 5);
}

function pScanner(ctx: CanvasRenderingContext2D): void {
  const arcs: [number, number][] = [
    [26, 0.95],
    [38, 0.6],
    [50, 0.32],
  ];
  for (const [r, alpha] of arcs) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(64, 64, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.strokeStyle = '#3fd6c8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  }

  const dot = new Path2D();
  dot.arc(64, 64, 11, 0, TAU);
  shape(ctx, dot, radGrad(ctx, 58, 56, 1, 64, 64, 12, ['#bffff4', '#3fd6c8', '#1d8f85']), 5);
  gloss(ctx, 59, 58, 3, 3, 0, 0.5);
}

function pSwing(ctx: CanvasRenderingContext2D): void {
  const arcPath = new Path2D();
  arcPath.moveTo(18, 104);
  arcPath.quadraticCurveTo(64, 6, 110, 104);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.stroke(arcPath);
  ctx.strokeStyle = '#c98a4c';
  ctx.lineWidth = 6;
  ctx.stroke(arcPath);

  ctx.save();
  ctx.translate(96, 76);
  ctx.rotate(0.75);
  const handle = new Path2D();
  roundRectPath(handle, -5, -34, 10, 40, 5);
  shape(ctx, handle, linGrad(ctx, -5, -34, 5, 6, WOOD), 5);
  const blade = new Path2D();
  blade.moveTo(-14, 4);
  blade.lineTo(14, 4);
  blade.lineTo(10, 24);
  blade.quadraticCurveTo(0, 34, -10, 24);
  blade.closePath();
  shape(ctx, blade, linGrad(ctx, -14, 4, 14, 30, STEEL), 5);
  ctx.restore();
}

/** Path2D flavoured rounded rectangle. */
function roundRectPath(path: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.arcTo(x + w, y, x + w, y + h, rr);
  path.arcTo(x + w, y + h, x, y + h, rr);
  path.arcTo(x, y + h, x, y, rr);
  path.arcTo(x, y, x + w, y, rr);
  path.closePath();
}

const PAINTERS: Record<UiIconKey, (ctx: CanvasRenderingContext2D) => void> = {
  pickaxe: pPickaxe,
  shovel: pShovel,
  rock: pRock,
  gem: pGem,
  bolt: pBolt,
  refill: pRefill,
  clock: pClock,
  sun: pSun,
  moon: pMoon,
  ruler: pRuler,
  store: pStore,
  target: pTarget,
  bag: pBag,
  lock: pLock,
  check: pCheck,
  cross: pCross,
  play: pPlay,
  watch: pWatch,
  back: pBack,
  magnifier: pMagnifier,
  flag: pFlag,
  bricks: pBricks,
  stopwatch: pStopwatch,
  sparkle: pSparkle,
  zzz: pZzz,
  cash: pCash,
  ledger: pLedger,
  house: pHouse,
  food: pFood,
  water: pWater,
  power: pPower,
  calendar: pCalendar,
  warning: pWarning,
  skull: pSkull,
  trophy: pTrophy,
  junk: pJunk,
  deposit: pDeposit,
  scanner: pScanner,
  swing: pSwing,
};

/**
 * Paints one icon onto a ctx whose origin is the top-left of a size x size
 * square (default 128).
 */
export function drawUiIcon(ctx: CanvasRenderingContext2D, key: UiIconKey, size = UI_ICON_SIZE): void {
  const painter = PAINTERS[key];
  ctx.save();
  ctx.scale(size / UI_ICON_SIZE, size / UI_ICON_SIZE);
  painter(ctx);
  ctx.restore();
}

/** Creates all icon textures once (skips ones that already exist). */
export function paintUiIcons(textures: Phaser.Textures.TextureManager): void {
  for (const key of UI_ICON_KEYS) {
    const texKey = uiIcon(key);
    if (textures.exists(texKey)) continue;
    makeCanvasTexture(textures, texKey, UI_ICON_SIZE, UI_ICON_SIZE, (ctx) => drawUiIcon(ctx, key));
  }
}
