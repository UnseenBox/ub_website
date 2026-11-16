import { TAU, css, darken, ellipse, polygon, roundRect } from './paint';

/** Shop tools that can be painted procedurally. */
export type ToolArtKind = 'hand-axe' | 'pickaxe' | 'jackhammer' | 'drill';

const SIZE = 128;
const OUTLINE = '#2b1c0e';
const WOOD = 0x7a5330;

/** Strokes the current path with the shared dark outline. */
function outline(ctx: CanvasRenderingContext2D, width = 3): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Fills the current path with a flat colour. */
function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fill();
}

/** Paints one shop icon of the given kind onto a cleared 128 x 128 canvas. */
export function paintToolArt(ctx: CanvasRenderingContext2D, kind: ToolArtKind): void {
  ctx.save();
  ctx.lineJoin = 'round';
  if (kind === 'hand-axe') paintHandAxe(ctx);
  else if (kind === 'pickaxe') paintPickaxe(ctx);
  else if (kind === 'jackhammer') paintJackhammer(ctx);
  else paintDrill(ctx);
  ctx.restore();
}

/** Short wooden handle with a single-bit steel head. */
function paintHandAxe(ctx: CanvasRenderingContext2D): void {
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = css(WOOD);
  roundRect(ctx, -5, -24, 10, 62, 5);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = css(darken(WOOD, 0.2));
  roundRect(ctx, -6, 14, 12, 16, 4);
  ctx.fill();
  outline(ctx);
  ctx.beginPath();
  ctx.moveTo(-14, -40);
  ctx.lineTo(4, -40);
  ctx.lineTo(7, -32);
  ctx.lineTo(21, -29);
  ctx.quadraticCurveTo(30, -25, 28, -14);
  ctx.lineTo(21, -6);
  ctx.lineTo(7, -9);
  ctx.lineTo(5, -14);
  ctx.lineTo(-14, -14);
  ctx.closePath();
  fill(ctx, '#9aa3ad');
  outline(ctx);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, -31);
  ctx.lineTo(20, -27);
  ctx.stroke();
  ctx.strokeStyle = '#e4eaf0';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(16, -25);
  ctx.quadraticCurveTo(25, -23, 24, -15);
  ctx.stroke();
}

/** Long wooden handle with a curved blue-steel head pointed at both ends. */
function paintPickaxe(ctx: CanvasRenderingContext2D): void {
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = css(WOOD);
  roundRect(ctx, -4, -36, 8, 92, 4);
  ctx.fill();
  outline(ctx);
  ctx.beginPath();
  ctx.moveTo(-38, -30);
  ctx.quadraticCurveTo(0, -50, 38, -30);
  ctx.quadraticCurveTo(0, -40, -38, -30);
  ctx.closePath();
  fill(ctx, '#aab4ff');
  outline(ctx);
  ctx.fillStyle = css(darken(WOOD, 0.25));
  ellipse(ctx, 0, -40, 8, 5);
  outline(ctx, 2);
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-28, -33);
  ctx.quadraticCurveTo(0, -46, 28, -33);
  ctx.stroke();
}

/** Chunky orange power tool with grips on top and a chisel bit below. */
function paintJackhammer(ctx: CanvasRenderingContext2D): void {
  ctx.translate(SIZE / 2, SIZE / 2 + 6);
  ctx.rotate(-Math.PI / 12);
  ctx.fillStyle = '#3a2a20';
  roundRect(ctx, -9, -46, 8, 20, 4);
  ctx.fill();
  outline(ctx);
  roundRect(ctx, 5, -46, 8, 20, 4);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#6b737d';
  roundRect(ctx, -30, -24, 17, 34, 6);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#ff9d5c';
  roundRect(ctx, -16, -30, 46, 44, 9);
  ctx.fill();
  ctx.fillStyle = '#d8703a';
  roundRect(ctx, -13, 0, 40, 11, 4);
  ctx.fill();
  roundRect(ctx, -16, -30, 46, 44, 9);
  outline(ctx);
  ctx.beginPath();
  ctx.arc(6, -18, 5, 0, TAU);
  ctx.fillStyle = '#d8703a';
  ctx.fill();
  outline(ctx, 2);
  ctx.fillStyle = '#d8703a';
  roundRect(ctx, 12, 6, 18, 10, 3);
  ctx.fill();
  outline(ctx);
  polygon(ctx, [
    { x: 14, y: 12 },
    { x: 27, y: 12 },
    { x: 24, y: 38 },
    { x: 21, y: 44 },
    { x: 18, y: 37 },
  ]);
  ctx.fillStyle = '#c8d0d8';
  ctx.fill();
  outline(ctx);
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 16);
  ctx.lineTo(19, 34);
  ctx.stroke();
}

/** Coral pistol-grip drill with a battery block and a steel bit. */
function paintDrill(ctx: CanvasRenderingContext2D): void {
  ctx.translate(SIZE / 2 - 4, SIZE / 2 + 2);
  ctx.rotate(Math.PI / 18);
  polygon(ctx, [
    { x: -28, y: -12 },
    { x: -12, y: -12 },
    { x: -8, y: 20 },
    { x: -23, y: 20 },
  ]);
  ctx.fillStyle = '#d95a48';
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#3a3f47';
  roundRect(ctx, -31, 18, 27, 16, 4);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#ff7a66';
  roundRect(ctx, -34, -34, 44, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#d95a48';
  roundRect(ctx, -31, -25, 38, 14, 4);
  ctx.fill();
  roundRect(ctx, -34, -34, 44, 26, 8);
  outline(ctx);
  ctx.fillStyle = '#ff7a66';
  roundRect(ctx, 8, -32, 14, 22, 5);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#6b737d';
  roundRect(ctx, 20, -30, 14, 18, 4);
  ctx.fill();
  outline(ctx);
  polygon(ctx, [
    { x: 34, y: -28 },
    { x: 45, y: -26 },
    { x: 48, y: -7 },
    { x: 36, y: -9 },
  ]);
  ctx.fillStyle = '#c8d0d8';
  ctx.fill();
  outline(ctx);
  ctx.strokeStyle = '#eef1ff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(37, -25);
  ctx.lineTo(39, -12);
  ctx.stroke();
}
