import { ellipse, roundRect } from './paint';

/**
 * The little family home standing on its grass patch - used for the
 * "back home" panel and the end-of-day summary.
 *
 * The art is drawn in a fixed 520 x 300 design space and scaled to whatever
 * canvas the caller provides.
 */

const INK = '#3b2616';
const DESIGN_W = 520;
const DESIGN_H = 300;
/** Y of the ground line (bottom of the grass patch). */
const BASE_Y = DESIGN_H - 6;

function stroke(ctx: CanvasRenderingContext2D, width = 3): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Paints a cosy cottage, a tree and a mailbox onto a transparent canvas.
 *
 * The canvas must be w x h; everything is scaled to fit it.
 */
export function paintHome(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.scale(w / DESIGN_W, h / DESIGN_H);

  paintGrassPatch(ctx);
  paintTree(ctx);
  paintMailbox(ctx);
  paintHouse(ctx);

  ctx.restore();
}

/** Soft green mound the house and the tree stand on. */
function paintGrassPatch(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(24, BASE_Y);
  ctx.quadraticCurveTo(120, BASE_Y - 14, 250, BASE_Y - 8);
  ctx.quadraticCurveTo(390, BASE_Y - 15, 500, BASE_Y);
  ctx.lineTo(500, DESIGN_H);
  ctx.lineTo(24, DESIGN_H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, BASE_Y - 16, 0, DESIGN_H);
  g.addColorStop(0, '#7cc455');
  g.addColorStop(1, '#4c9438');
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, 3);

  // A few tufts of grass on the patch.
  ctx.strokeStyle = '#3f7f36';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [x, y] of [[60, BASE_Y - 6], [150, BASE_Y - 10], [340, BASE_Y - 9], [455, BASE_Y - 5]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3, y - 9, x + 7, y - 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.quadraticCurveTo(x + 8, y - 7, x + 13, y - 10);
    ctx.stroke();
  }
}

/** Round leafy tree beside the cottage. */
function paintTree(ctx: CanvasRenderingContext2D): void {
  // Trunk.
  ctx.beginPath();
  ctx.moveTo(58, BASE_Y - 2);
  ctx.quadraticCurveTo(63, BASE_Y - 60, 62, BASE_Y - 118);
  ctx.lineTo(92, BASE_Y - 118);
  ctx.quadraticCurveTo(89, BASE_Y - 58, 94, BASE_Y - 2);
  ctx.closePath();
  const trunk = ctx.createLinearGradient(58, 0, 94, 0);
  trunk.addColorStop(0, '#a9713d');
  trunk.addColorStop(1, '#7d4f27');
  ctx.fillStyle = trunk;
  ctx.fill();
  stroke(ctx, 3);

  // Canopy: overlapping soft blobs with a darker rim instead of hard lines.
  const puffs: [number, number, number][] = [
    [75, 118, 42], [42, 146, 30], [110, 148, 31], [66, 84, 30], [104, 96, 28],
  ];
  ctx.fillStyle = '#336f2b';
  for (const [x, y, r] of puffs) ellipse(ctx, x, y, r + 3, (r + 3) * 0.92);
  ctx.fillStyle = '#5fae43';
  for (const [x, y, r] of puffs) ellipse(ctx, x, y, r, r * 0.92);
  ctx.fillStyle = 'rgba(150,212,118,0.55)';
  for (const [x, y, r] of puffs) ellipse(ctx, x - r * 0.25, y - r * 0.3, r * 0.48, r * 0.4);

  // A couple of apples.
  for (const [x, y] of [[58, 134], [96, 106]] as const) {
    ctx.fillStyle = '#e0523f';
    ellipse(ctx, x, y, 7, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ellipse(ctx, x - 2, y - 2.5, 2.4, 1.8);
  }
}

/** Little roadside mailbox. */
function paintMailbox(ctx: CanvasRenderingContext2D): void {
  // Post.
  ctx.fillStyle = '#8a5a30';
  roundRect(ctx, 434, BASE_Y - 74, 9, 74, 3);
  ctx.fill();
  stroke(ctx, 2.5);

  // Box.
  ctx.beginPath();
  ctx.moveTo(420, BASE_Y - 74);
  ctx.quadraticCurveTo(420, BASE_Y - 96, 438, BASE_Y - 96);
  ctx.quadraticCurveTo(457, BASE_Y - 96, 457, BASE_Y - 74);
  ctx.closePath();
  const box = ctx.createLinearGradient(0, BASE_Y - 96, 0, BASE_Y - 74);
  box.addColorStop(0, '#f07f6a');
  box.addColorStop(1, '#c04a3c');
  ctx.fillStyle = box;
  ctx.fill();
  stroke(ctx, 3);
  // Flag.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(457, BASE_Y - 84);
  ctx.lineTo(468, BASE_Y - 84);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  roundRect(ctx, 463, BASE_Y - 96, 6, 12, 2);
  ctx.fill();
  stroke(ctx, 2);
}

/** The cottage itself. */
function paintHouse(ctx: CanvasRenderingContext2D): void {
  const left = 148;
  const right = 348;
  const wallTop = 156;

  // Chimney behind the roof.
  ctx.fillStyle = '#8d5c46';
  roundRect(ctx, 296, 62, 30, 62, 4);
  ctx.fill();
  stroke(ctx, 3);
  ctx.fillStyle = '#a06b52';
  roundRect(ctx, 292, 56, 38, 12, 4);
  ctx.fill();
  stroke(ctx, 3);

  // Smoke puffs.
  ctx.fillStyle = 'rgba(238,240,244,0.85)';
  for (const [x, y, r] of [[311, 44, 9], [322, 30, 7], [308, 18, 5]] as const) {
    ellipse(ctx, x, y, r, r);
  }

  // Walls.
  const wall = ctx.createLinearGradient(0, wallTop, 0, BASE_Y);
  wall.addColorStop(0, '#e0a86a');
  wall.addColorStop(1, '#b97b42');
  ctx.fillStyle = wall;
  roundRect(ctx, left, wallTop, right - left, BASE_Y - wallTop, 6);
  ctx.fill();
  stroke(ctx, 3.5);

  // Planks.
  ctx.strokeStyle = 'rgba(90,50,20,0.28)';
  ctx.lineWidth = 2;
  for (let x = left + 22; x < right - 6; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, wallTop + 4);
    ctx.lineTo(x, BASE_Y - 4);
    ctx.stroke();
  }

  // Roof.
  const roofPath = new Path2D();
  roofPath.moveTo(left - 24, wallTop + 6);
  roofPath.lineTo(248, 76);
  roofPath.lineTo(right + 24, wallTop + 6);
  roofPath.closePath();
  const roof = ctx.createLinearGradient(0, 76, 0, wallTop + 6);
  roof.addColorStop(0, '#e2694a');
  roof.addColorStop(1, '#b83f2c');
  ctx.fillStyle = roof;
  ctx.fill(roofPath);

  // Roof shingle lines, clipped to the roof.
  ctx.save();
  ctx.clip(roofPath);
  ctx.strokeStyle = 'rgba(120,40,26,0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const y = wallTop + 6 - (wallTop + 6 - 76) * t;
    ctx.beginPath();
    ctx.moveTo(left - 40, y);
    ctx.lineTo(right + 40, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.stroke(roofPath);

  // Door.
  ctx.fillStyle = '#8a5a30';
  roundRect(ctx, 238, 218, 54, BASE_Y - 218, 8);
  ctx.fill();
  stroke(ctx, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, 244, 224, 20, 54, 5);
  ctx.fill();
  ctx.fillStyle = '#ffd34d';
  ellipse(ctx, 282, 256, 4, 4);
  ctx.fill();
  stroke(ctx, 1.6);

  // Glowing window.
  const winX = 176;
  const winY = 184;
  const winW = 54;
  const winH = 44;
  const glow = ctx.createRadialGradient(winX + winW / 2, winY + winH / 2, 4, winX + winW / 2, winY + winH / 2, 62);
  glow.addColorStop(0, 'rgba(255,214,120,0.75)');
  glow.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = glow;
  ellipse(ctx, winX + winW / 2, winY + winH / 2, 62, 62);
  ctx.fillStyle = '#ffdf8c';
  roundRect(ctx, winX, winY, winW, winH, 5);
  ctx.fill();
  stroke(ctx, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(winX + winW / 2, winY);
  ctx.lineTo(winX + winW / 2, winY + winH);
  ctx.moveTo(winX, winY + winH / 2);
  ctx.lineTo(winX + winW, winY + winH / 2);
  ctx.stroke();

  // Flower box under the window.
  ctx.fillStyle = '#9a6134';
  roundRect(ctx, winX - 6, winY + winH + 4, winW + 12, 16, 3);
  ctx.fill();
  stroke(ctx, 2.5);
  const blooms: [number, string][] = [
    [winX + 2, '#e0523f'], [winX + 16, '#ffd94d'], [winX + 30, '#f28fb1'], [winX + 44, '#c39bff'], [winX + 56, '#e0523f'],
  ];
  for (const [bx, color] of blooms) {
    ctx.fillStyle = color;
    ellipse(ctx, bx, winY + winH + 3, 5, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, bx - 1.4, winY + winH + 1.6, 1.8, 1.4);
  }

  // Porch light.
  const lampX = 318;
  const lampY = 176;
  const lampGlow = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 34);
  lampGlow.addColorStop(0, 'rgba(255,226,150,0.8)');
  lampGlow.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = lampGlow;
  ellipse(ctx, lampX, lampY, 34, 34);
  ctx.fill();
  ctx.fillStyle = '#4a4a52';
  roundRect(ctx, lampX - 7, lampY - 9, 14, 16, 3);
  ctx.fill();
  stroke(ctx, 2.5);
  ctx.fillStyle = '#ffe9a8';
  roundRect(ctx, lampX - 4.5, lampY - 6.5, 9, 11, 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lampX, lampY - 9);
  ctx.lineTo(lampX, lampY - 15);
  ctx.stroke();

  // Small doorstep stone.
  ctx.fillStyle = '#9c968b';
  roundRect(ctx, 232, BASE_Y - 12, 66, 14, 4);
  ctx.fill();
  stroke(ctx, 2.5);
}
