import { ellipse, roundRect } from './paint';

export type NewToolSprite = 'hand-axe' | 'pickaxe' | 'jackhammer' | 'drill';

const CX = 30;
const TIP_Y = 228;
const INK = '#2b1c0e';

/** Strokes the current path with the house outline colour. */
function ink(ctx: CanvasRenderingContext2D, w = 1.6): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.stroke();
}

function fillPath(ctx: CanvasRenderingContext2D, p: Path2D, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fill(p);
}

/** Worn wooden handle with a lit side, a dark side and grain scratches. */
function wood(ctx: CanvasRenderingContext2D, top: number, bottom: number, halfW: number): void {
  const g = ctx.createLinearGradient(CX - halfW, 0, CX + halfW, 0);
  g.addColorStop(0, '#3f2c19');
  g.addColorStop(0.35, '#7a5330');
  g.addColorStop(0.7, '#8d6038');
  g.addColorStop(1, '#3a2816');
  ctx.fillStyle = g;
  roundRect(ctx, CX - halfW, top, halfW * 2, bottom - top, halfW * 0.75);
  ctx.fill();
  ink(ctx, 1.5);
  ctx.strokeStyle = 'rgba(38,22,8,0.38)';
  ctx.lineWidth = 1;
  const span = bottom - top;
  for (let i = 0; i < 6; i++) {
    const y = top + span * (0.12 + i * 0.14);
    const dx = i % 2 === 0 ? -1.6 : 1.6;
    ctx.beginPath();
    ctx.moveTo(CX + dx, y);
    ctx.quadraticCurveTo(CX - dx, y + 5, CX + dx * 0.6, y + 11);
    ctx.stroke();
  }
}

/** Faded tape wrap around the handle. */
function gripWrap(ctx: CanvasRenderingContext2D, top: number): void {
  ctx.fillStyle = '#5b3a21';
  roundRect(ctx, CX - 9, top, 18, 34, 6);
  ctx.fill();
  ink(ctx, 1.5);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = top + 7 + i * 10;
    ctx.strokeStyle = 'rgba(198,191,166,0.85)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(CX - 8, y);
    ctx.lineTo(CX + 8, y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Small chips and nicks on a steel edge. */
function chips(ctx: CanvasRenderingContext2D, spots: readonly (readonly [number, number, number])[]): void {
  ctx.fillStyle = 'rgba(58,66,74,0.85)';
  for (const [x, y, r] of spots) ellipse(ctx, x, y, r, r * 0.7);
}

/** 'hand-axe': wooden haft with a broad steel bit on one side. */
function handAxe(ctx: CanvasRenderingContext2D): void {
  wood(ctx, 6, 172, 6);
  gripWrap(ctx, 108);

  const head = new Path2D();
  head.moveTo(22, 164);
  head.lineTo(41, 164);
  head.lineTo(41, 188);
  head.quadraticCurveTo(40, 195, 35, 201);
  head.lineTo(30, TIP_Y);
  head.lineTo(6, 196);
  head.lineTo(14, 176);
  head.closePath();
  const steel = ctx.createLinearGradient(6, 164, 41, 220);
  steel.addColorStop(0, '#c8d1d9');
  steel.addColorStop(0.4, '#9aa3ad');
  steel.addColorStop(1, '#5d666f');
  fillPath(ctx, head, steel);
  ink(ctx, 2);

  ctx.fillStyle = '#7c848d';
  roundRect(ctx, 22, 164, 19, 24, 3);
  ctx.fill();
  ink(ctx, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, 26, 170, 2.2, 3);
  ctx.fill();

  ctx.strokeStyle = '#e4eaf0';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(7.5, 196.5);
  ctx.lineTo(28.5, 225);
  ctx.stroke();

  chips(ctx, [[12, 191, 1.8], [18, 199, 1.4], [24, 207, 1.6]]);
}

/** 'pickaxe': long haft with a curved blue-steel pick sweeping the full width. */
function pickaxe(ctx: CanvasRenderingContext2D): void {
  wood(ctx, 6, 216, 5.5);

  const head = new Path2D();
  head.moveTo(6, 196);
  head.quadraticCurveTo(30, 260, 54, 196);
  head.quadraticCurveTo(30, 224, 6, 196);
  head.closePath();
  const steel = ctx.createLinearGradient(0, 196, 0, 228);
  steel.addColorStop(0, '#aab4ff');
  steel.addColorStop(0.45, '#8b95cf');
  steel.addColorStop(1, '#5a6390');
  fillPath(ctx, head, steel);
  ink(ctx, 2);

  ctx.strokeStyle = '#c3caff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(8, 196);
  ctx.quadraticCurveTo(30, 221, 52, 196);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(46,52,84,0.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(9, 198);
  ctx.quadraticCurveTo(30, 255, 51, 198);
  ctx.stroke();

  ctx.fillStyle = '#6e779a';
  roundRect(ctx, 23, 200, 14, 14, 3);
  ctx.fill();
  ink(ctx, 1.4);

  chips(ctx, [[11, 199, 1.5], [48, 199, 1.5], [30, 224, 1.7]]);
}

/** 'jackhammer': orange machine body with a steel chisel bit. */
function jackhammer(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#3a2a20';
  roundRect(ctx, 7, 5, 11, 30, 5);
  ctx.fill();
  ink(ctx, 1.5);
  roundRect(ctx, 42, 5, 11, 30, 5);
  ctx.fill();
  ink(ctx, 1.5);

  const cap = ctx.createLinearGradient(22, 0, 38, 0);
  cap.addColorStop(0, '#9aa3ad');
  cap.addColorStop(0.5, '#6b737d');
  cap.addColorStop(1, '#4d545c');
  ctx.fillStyle = cap;
  roundRect(ctx, 22, 3, 16, 26, 5);
  ctx.fill();
  ink(ctx, 1.6);

  const body = ctx.createLinearGradient(10, 0, 50, 0);
  body.addColorStop(0, '#ff9d5c');
  body.addColorStop(0.45, '#f5893f');
  body.addColorStop(1, '#d8703a');
  ctx.fillStyle = body;
  roundRect(ctx, 10, 28, 40, 120, 10);
  ctx.fill();
  ink(ctx, 2);

  ctx.fillStyle = 'rgba(180,88,40,0.55)';
  roundRect(ctx, 42, 34, 8, 108, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,225,190,0.4)';
  roundRect(ctx, 16, 33, 22, 9, 4);
  ctx.fill();

  ctx.fillStyle = '#7a3c18';
  roundRect(ctx, 15, 52, 22, 7, 3);
  ctx.fill();
  roundRect(ctx, 15, 66, 22, 7, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,12,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(18 + i * 5.5, 53);
    ctx.lineTo(18 + i * 5.5, 58);
    ctx.stroke();
  }

  ctx.fillStyle = '#6b737d';
  roundRect(ctx, 21, 140, 18, 14, 3);
  ctx.fill();
  ink(ctx, 1.5);

  const bit = new Path2D();
  bit.moveTo(23, 150);
  bit.lineTo(37, 150);
  bit.lineTo(33, 206);
  bit.lineTo(30, TIP_Y);
  bit.lineTo(27, 206);
  bit.closePath();
  const steel = ctx.createLinearGradient(23, 0, 37, 0);
  steel.addColorStop(0, '#e2e8ee');
  steel.addColorStop(0.45, '#c8d0d8');
  steel.addColorStop(1, '#8b95a0');
  fillPath(ctx, bit, steel);
  ink(ctx, 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(26, 156);
  ctx.lineTo(25.5, 200);
  ctx.stroke();
  chips(ctx, [[31, 190, 1.4], [29, 172, 1.2]]);
}

/** 'drill': pistol-grip power drill pointing its bit straight down. */
function drill(ctx: CanvasRenderingContext2D): void {
  const grip = new Path2D();
  grip.moveTo(40, 44);
  grip.lineTo(52, 54);
  grip.lineTo(51, 100);
  grip.lineTo(39, 100);
  grip.closePath();
  ctx.fillStyle = '#c94f3f';
  ctx.fill(grip);
  ink(ctx, 1.8);

  ctx.fillStyle = '#3a3f47';
  roundRect(ctx, 37, 96, 17, 34, 5);
  ctx.fill();
  ink(ctx, 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, 40, 100, 11, 7, 3);
  ctx.fill();

  const g = ctx.createLinearGradient(10, 0, 42, 0);
  g.addColorStop(0, '#ff7a66');
  g.addColorStop(0.5, '#f56a57');
  g.addColorStop(1, '#d95a48');
  ctx.fillStyle = g;
  roundRect(ctx, 10, 18, 32, 96, 10);
  ctx.fill();
  ink(ctx, 2);
  ctx.fillStyle = 'rgba(255,220,210,0.4)';
  roundRect(ctx, 15, 23, 18, 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,60,48,0.5)';
  roundRect(ctx, 36, 26, 6, 80, 3);
  ctx.fill();

  ctx.fillStyle = '#3a3f47';
  roundRect(ctx, 41, 60, 6, 12, 3);
  ctx.fill();
  ink(ctx, 1.2);

  ctx.fillStyle = '#6b737d';
  roundRect(ctx, 17, 106, 20, 26, 5);
  ctx.fill();
  ink(ctx, 1.8);
  ctx.fillStyle = '#8d959e';
  roundRect(ctx, 18, 108, 18, 8, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,46,52,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(19 + i * 6, 120);
    ctx.lineTo(19 + i * 6, 128);
    ctx.stroke();
  }

  const bit = new Path2D();
  bit.moveTo(23, 128);
  bit.lineTo(33, 128);
  bit.lineTo(32, 208);
  bit.lineTo(30, TIP_Y);
  bit.lineTo(28, 208);
  bit.closePath();
  const steel = ctx.createLinearGradient(23, 0, 33, 0);
  steel.addColorStop(0, '#e2e8ee');
  steel.addColorStop(0.45, '#c8d0d8');
  steel.addColorStop(1, '#8b95a0');
  fillPath(ctx, bit, steel);
  ink(ctx, 1.6);
  ctx.strokeStyle = 'rgba(90,100,112,0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const y = 140 + i * 15;
    ctx.beginPath();
    ctx.moveTo(23.5, y);
    ctx.lineTo(32.5, y + 8);
    ctx.stroke();
  }
  chips(ctx, [[30, 190, 1.3], [27, 214, 1.1]]);
}

/** Paints one of the four digging tool sprites in a 60 x 232 logical box. */
export function paintNewToolSprite(ctx: CanvasRenderingContext2D, kind: NewToolSprite): void {
  if (kind === 'hand-axe') {
    handAxe(ctx);
  } else if (kind === 'pickaxe') {
    pickaxe(ctx);
  } else if (kind === 'jackhammer') {
    jackhammer(ctx);
  } else {
    drill(ctx);
  }
}
