import { mulberry32 } from '../core/Random';
import { TAU, ellipse, roundRect } from './paint';

/**
 * The surface scenery, painted in code: a timber-framed cottage with a scalloped tile roof,
 * a storybook tree, and (separately) the mine head-frame with its ore cart. Everything is
 * drawn in a 520 x 300 design space and scaled to the canvas it is given. Thick warm-brown
 * ink outlines, flat colour with a lit side and a shaded side, little details everywhere -
 * the look of an old illustrated field guide rather than clip art.
 */

const INK = '#3b2616';
const DESIGN_W = 520;
const DESIGN_H = 300;
const BASE_Y = DESIGN_H - 6;

type Ctx = CanvasRenderingContext2D;

function ink(ctx: Ctx, width = 3, color = INK): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function poly(ctx: Ctx, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function grad(ctx: Ctx, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Fills the current path, then outlines it. */
function paintShape(ctx: Ctx, fill: string | CanvasGradient, lw = 3): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, lw);
}

/** A meadow bank the scenery stands on: lit rim, turf lip, flowers and tufts. */
function paintBank(ctx: Ctx, from: number, to: number, seed: number): void {
  const rng = mulberry32(seed);
  ctx.beginPath();
  ctx.moveTo(from, BASE_Y + 2);
  ctx.bezierCurveTo(from + 70, BASE_Y - 22, to - 120, BASE_Y - 26, to, BASE_Y + 2);
  ctx.lineTo(to, DESIGN_H);
  ctx.lineTo(from, DESIGN_H);
  ctx.closePath();
  paintShape(ctx, grad(ctx, BASE_Y - 26, DESIGN_H, '#98d35f', '#3f8a38'), 3);
  // Warm rim light along the top.
  ctx.beginPath();
  ctx.moveTo(from + 6, BASE_Y - 1);
  ctx.bezierCurveTo(from + 74, BASE_Y - 22, to - 118, BASE_Y - 26, to - 6, BASE_Y - 1);
  ctx.strokeStyle = 'rgba(230,255,170,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Tufts.
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = from + 14 + rng() * (to - from - 28);
    const y = BASE_Y - 6 + rng() * 9;
    ctx.strokeStyle = rng() < 0.5 ? '#2f7a33' : '#b8e86a';
    ctx.lineWidth = 2;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.moveTo(x + b * 3, y);
      ctx.quadraticCurveTo(x + b * 3 + (b - 1) * 4, y - 6, x + b * 3 + (b - 1) * 7, y - 11 - rng() * 4);
      ctx.stroke();
    }
  }
  // Wildflowers: poppies, daisies and violets.
  for (let i = 0; i < 16; i++) {
    const x = from + 18 + rng() * (to - from - 36);
    const y = BASE_Y - 3 + rng() * 6;
    const kind = rng();
    ctx.strokeStyle = '#2f7a33';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 11);
    ctx.stroke();
    if (kind < 0.4) {
      ctx.fillStyle = '#e8503a';
      ellipse(ctx, x, y - 13, 4.2, 3.6);
      ctx.fillStyle = '#3b1a10';
      ellipse(ctx, x, y - 13, 1.4, 1.4);
    } else if (kind < 0.75) {
      ctx.fillStyle = '#fffaf0';
      for (let p = 0; p < 6; p++) ellipse(ctx, x + Math.cos((p / 6) * TAU) * 3, y - 13 + Math.sin((p / 6) * TAU) * 3, 2, 2);
      ctx.fillStyle = '#ffc83d';
      ellipse(ctx, x, y - 13, 1.8, 1.8);
    } else {
      ctx.fillStyle = '#9a7be0';
      for (let p = 0; p < 4; p++) ellipse(ctx, x + Math.cos((p / 4) * TAU) * 2.6, y - 13 + Math.sin((p / 4) * TAU) * 2.6, 2, 2);
      ctx.fillStyle = '#ffe27a';
      ellipse(ctx, x, y - 13, 1.2, 1.2);
    }
  }
}

/** Round storybook tree: ink silhouette, three tones of leaf clumps, blossoms. */
function paintTree(ctx: Ctx): void {
  // Trunk with roots and bark lines.
  ctx.beginPath();
  ctx.moveTo(60, BASE_Y + 1);
  ctx.quadraticCurveTo(76, BASE_Y - 14, 79, BASE_Y - 40);
  ctx.quadraticCurveTo(80, BASE_Y - 90, 74, BASE_Y - 124);
  ctx.lineTo(106, BASE_Y - 124);
  ctx.quadraticCurveTo(100, BASE_Y - 88, 102, BASE_Y - 40);
  ctx.quadraticCurveTo(105, BASE_Y - 14, 122, BASE_Y + 1);
  ctx.quadraticCurveTo(90, BASE_Y - 8, 60, BASE_Y + 1);
  ctx.closePath();
  const trunk = ctx.createLinearGradient(66, 0, 120, 0);
  trunk.addColorStop(0, '#c98a4c');
  trunk.addColorStop(0.55, '#9a6234');
  trunk.addColorStop(1, '#6e4222');
  paintShape(ctx, trunk, 3.4);
  ctx.strokeStyle = 'rgba(59,38,22,0.5)';
  ctx.lineWidth = 2;
  for (const [x, y, h] of [[86, 214, 30], [96, 188, 24], [88, 160, 28]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - h * 0.5, x - 1, y - h);
    ctx.stroke();
  }

  const clumps: Array<[number, number, number]> = [
    [92, 108, 40], [54, 134, 30], [132, 136, 31], [70, 76, 29], [112, 80, 28], [92, 150, 30], [40, 110, 22],
  ];
  // Silhouette outline first, so the ink only shows on the outside of the canopy.
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  for (const [x, y, r] of clumps) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.fill();
  }
  ctx.fillStyle = '#2c6a46';
  for (const [x, y, r] of clumps) ellipse(ctx, x, y, r, r);
  ctx.fillStyle = '#48a057';
  for (const [x, y, r] of clumps) ellipse(ctx, x - r * 0.1, y - r * 0.14, r * 0.86, r * 0.84);
  ctx.fillStyle = '#8fd86e';
  for (const [x, y, r] of clumps) ellipse(ctx, x - r * 0.3, y - r * 0.38, r * 0.46, r * 0.34);
  // Leaf flecks and blossoms.
  const rng = mulberry32(77);
  for (let i = 0; i < 34; i++) {
    const [x, y, r] = clumps[Math.floor(rng() * clumps.length)];
    const a = rng() * TAU;
    const d = rng() * r * 0.8;
    ctx.fillStyle = rng() < 0.5 ? '#2c6a46' : '#b4ee8a';
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 2.6, 1.4, a);
  }
  for (const [x, y] of [[66, 132], [118, 112], [98, 150], [78, 92]] as const) {
    ctx.fillStyle = '#ffb3c8';
    for (let p = 0; p < 5; p++) ellipse(ctx, x + Math.cos((p / 5) * TAU) * 3.4, y + Math.sin((p / 5) * TAU) * 3.4, 2.6, 2.6);
    ctx.fillStyle = '#ffe27a';
    ellipse(ctx, x, y, 1.6, 1.6);
  }
}

/** A window that glows from inside, with a flower box beneath it. */
function paintWindow(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  // Shutters.
  for (const sx of [x - 11, x + w + 1]) {
    roundRect(ctx, sx, y + 1, 10, h - 2, 2);
    paintShape(ctx, '#4d8590', 2.4);
    ctx.strokeStyle = 'rgba(20,50,60,0.5)';
    ctx.lineWidth = 1.4;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(sx + 2, y + (k * h) / 5);
      ctx.lineTo(sx + 8, y + (k * h) / 5 - 2);
      ctx.stroke();
    }
  }
  roundRect(ctx, x, y, w, h, 3);
  paintShape(ctx, '#6b4226', 3);
  const gx = x + 4;
  const gy = y + 4;
  const gw = w - 8;
  const gh = h - 8;
  ctx.fillStyle = grad(ctx, gy, gy + gh, '#fff0b4', '#ffbd4a');
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  poly(ctx, [[gx + 2, gy + 2], [gx + gw * 0.55, gy + 2], [gx + 2, gy + gh * 0.55]]);
  ctx.fill();
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(gx + gw / 2, gy);
  ctx.lineTo(gx + gw / 2, gy + gh);
  ctx.moveTo(gx, gy + gh / 2);
  ctx.lineTo(gx + gw, gy + gh / 2);
  ctx.stroke();
  // Curtain tie-backs.
  ctx.fillStyle = 'rgba(214,96,86,0.85)';
  poly(ctx, [[gx, gy], [gx + 7, gy], [gx + 2, gy + gh * 0.5], [gx, gy + gh * 0.5]]);
  ctx.fill();
  poly(ctx, [[gx + gw, gy], [gx + gw - 7, gy], [gx + gw - 2, gy + gh * 0.5], [gx + gw, gy + gh * 0.5]]);
  ctx.fill();
  // Flower box.
  roundRect(ctx, x - 4, y + h - 2, w + 8, 10, 2);
  paintShape(ctx, '#8a5a30', 2.4);
  const colors = ['#ff6f91', '#ffd34d', '#ffffff', '#b58cff'];
  for (let i = 0; i < 6; i++) {
    const fx = x + 2 + (i * (w - 4)) / 5;
    ctx.fillStyle = '#3f9a3d';
    ellipse(ctx, fx, y + h - 3, 3.4, 2.6);
    ctx.fillStyle = colors[i % colors.length];
    ellipse(ctx, fx + (i % 2 ? 2 : -2), y + h - 7, 2.8, 2.8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, fx + (i % 2 ? 2 : -2), y + h - 6.5, 1, 1);
  }
}

/** The cottage: stone foundation, timber-framed plaster, scalloped tile roof, warm glow. */
function paintHouse(ctx: Ctx): void {
  const left = 176;
  const right = 384;
  const wallTop = 164;
  const stoneTop = 252;

  // Chimney (behind the roof).
  roundRect(ctx, 322, 66, 32, 76, 3);
  paintShape(ctx, grad(ctx, 66, 142, '#a9755c', '#80513f'), 3.4);
  ctx.strokeStyle = 'rgba(59,38,22,0.5)';
  ctx.lineWidth = 1.6;
  for (let r = 0; r < 6; r++) {
    const y = 78 + r * 12;
    ctx.beginPath();
    ctx.moveTo(322, y);
    ctx.lineTo(354, y);
    ctx.stroke();
    for (let c = 0; c < 2; c++) {
      ctx.beginPath();
      ctx.moveTo(332 + c * 14 + (r % 2) * 5, y);
      ctx.lineTo(332 + c * 14 + (r % 2) * 5, y + 12);
      ctx.stroke();
    }
  }
  roundRect(ctx, 317, 58, 42, 12, 3);
  paintShape(ctx, '#6e4533', 3);
  // Smoke curls.
  for (const [x, y, r, a] of [[338, 44, 9, 0.9], [346, 30, 11, 0.75], [336, 14, 13, 0.55]] as const) {
    ctx.fillStyle = `rgba(250,248,242,${a})`;
    ellipse(ctx, x, y, r, r * 0.86);
    ctx.fillStyle = `rgba(190,200,215,${a * 0.5})`;
    ellipse(ctx, x + 2, y + 3, r * 0.7, r * 0.5);
  }

  // Stone foundation.
  ctx.save();
  roundRect(ctx, left - 4, stoneTop - 2, right - left + 8, BASE_Y - stoneTop + 4, 3);
  ctx.clip();
  ctx.fillStyle = '#8c8a8e';
  ctx.fillRect(left - 4, stoneTop - 2, right - left + 8, BASE_Y - stoneTop + 4);
  const rng = mulberry32(5);
  for (let row = 0; row < 3; row++) {
    for (let x = left - 10 + (row % 2) * 10; x < right + 6; x += 20 + rng() * 8) {
      const w = 16 + rng() * 10;
      roundRect(ctx, x, stoneTop + row * 14, w, 12, 4);
      ctx.fillStyle = ['#a5a3a8', '#8f8d93', '#b8b4b0', '#7d7b82'][Math.floor(rng() * 4)];
      ctx.fill();
      ink(ctx, 1.6, 'rgba(40,28,20,0.75)');
    }
  }
  ctx.restore();
  roundRect(ctx, left - 4, stoneTop - 2, right - left + 8, BASE_Y - stoneTop + 4, 3);
  ink(ctx, 3.4);

  // Plaster walls.
  ctx.beginPath();
  ctx.rect(left, wallTop, right - left, stoneTop - wallTop);
  paintShape(ctx, grad(ctx, wallTop, stoneTop, '#fbefcf', '#e6c996'), 3.4);
  // Shade under the eaves.
  ctx.fillStyle = 'rgba(120,70,30,0.22)';
  ctx.fillRect(left + 2, wallTop + 2, right - left - 4, 14);
  // Timber frame.
  ctx.fillStyle = '#6b4226';
  for (const x of [left, left + 56, right - 66, right - 10]) ctx.fillRect(x, wallTop, 10, stoneTop - wallTop);
  ctx.fillRect(left, wallTop + 40, right - left, 8);
  ctx.fillRect(left, stoneTop - 8, right - left, 8);
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(left + 10, wallTop + 48);
  ctx.lineTo(left + 56, wallTop + 8);
  ctx.moveTo(right - 10, wallTop + 48);
  ctx.lineTo(right - 66 + 10, wallTop + 8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,16,8,0.7)';
  ctx.lineWidth = 1.6;
  for (const x of [left, left + 56, right - 66, right - 10]) ctx.strokeRect(x, wallTop, 10, stoneTop - wallTop);
  ctx.strokeRect(left, wallTop + 40, right - left, 8);
  ctx.strokeRect(left, stoneTop - 8, right - left, 8);

  paintWindow(ctx, left + 20, wallTop + 60, 32, 40);
  paintWindow(ctx, right - 54, wallTop + 60, 32, 40);

  // Arched door with iron straps.
  const dx = 262;
  const dw = 52;
  const dTop = 198;
  ctx.beginPath();
  ctx.moveTo(dx, stoneTop);
  ctx.lineTo(dx, dTop + dw / 2);
  ctx.arc(dx + dw / 2, dTop + dw / 2, dw / 2, Math.PI, 0);
  ctx.lineTo(dx + dw, stoneTop);
  ctx.closePath();
  const wood = ctx.createLinearGradient(dx, 0, dx + dw, 0);
  wood.addColorStop(0, '#a9703a');
  wood.addColorStop(1, '#7b4a24');
  paintShape(ctx, wood, 3.4);
  ctx.strokeStyle = 'rgba(59,38,22,0.55)';
  ctx.lineWidth = 1.6;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(dx + (k * dw) / 4, dTop + 4 + Math.abs(k - 2) * 4);
    ctx.lineTo(dx + (k * dw) / 4, stoneTop);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a3a44';
  for (const y of [dTop + 22, dTop + 42]) {
    ctx.fillRect(dx, y, dw, 4);
    ellipse(ctx, dx + 4, y + 2, 2.4, 2.4);
  }
  ctx.fillStyle = '#ffd34d';
  ellipse(ctx, dx + dw - 9, dTop + 34, 2.8, 2.8);
  // Doorstep.
  roundRect(ctx, dx - 8, stoneTop - 2, dw + 16, 9, 3);
  paintShape(ctx, '#a5a3a8', 2.6);

  // Hanging lantern.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(336, wallTop + 4);
  ctx.lineTo(336, wallTop + 22);
  ctx.stroke();
  const glow = ctx.createRadialGradient(336, wallTop + 34, 2, 336, wallTop + 34, 22);
  glow.addColorStop(0, 'rgba(255,224,130,0.8)');
  glow.addColorStop(1, 'rgba(255,224,130,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(310, wallTop + 8, 52, 52);
  roundRect(ctx, 330, wallTop + 22, 12, 16, 3);
  paintShape(ctx, '#ffd96a', 2.2);

  // Roof: overhanging gable covered in scalloped tiles.
  const apexX = (left + right) / 2;
  const apexY = 66;
  const eaveY = wallTop + 2;
  const overhang = 22;
  const roof: Array<[number, number]> = [[left - overhang, eaveY], [apexX, apexY], [right + overhang, eaveY]];
  poly(ctx, roof);
  ctx.fillStyle = '#a63a29';
  ctx.fill();
  ctx.save();
  poly(ctx, roof);
  ctx.clip();
  for (let row = 0; row < 8; row++) {
    const y = apexY + 12 + row * 12.5;
    for (let x = left - overhang - 20 + (row % 2) * 9; x < right + overhang + 20; x += 18) {
      ctx.beginPath();
      ctx.arc(x, y, 9.4, 0, Math.PI);
      ctx.fillStyle = (row + Math.floor(x / 18)) % 3 === 0 ? '#e0724a' : '#cf5538';
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,20,12,0.7)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,150,0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y - 1.5, 6.5, Math.PI * 0.15, Math.PI * 0.5);
      ctx.stroke();
    }
  }
  // Sun-side lighting on the left slope.
  ctx.fillStyle = 'rgba(255,230,170,0.16)';
  poly(ctx, [[left - overhang, eaveY], [apexX, apexY], [apexX, eaveY]]);
  ctx.fill();
  ctx.restore();
  poly(ctx, roof);
  ink(ctx, 3.6);
  // Ridge cap and eave board.
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(left - overhang, eaveY + 1);
  ctx.lineTo(right + overhang, eaveY + 1);
  ctx.stroke();
  ink(ctx, 1.4, 'rgba(30,16,8,0.6)');

  // Round attic window under the apex.
  ctx.beginPath();
  ctx.arc(apexX, 118, 17, 0, TAU);
  paintShape(ctx, '#6b4226', 3.4);
  ctx.beginPath();
  ctx.arc(apexX, 118, 12, 0, TAU);
  ctx.fillStyle = grad(ctx, 106, 130, '#fff0b4', '#ffbd4a');
  ctx.fill();
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(apexX - 12, 118);
  ctx.lineTo(apexX + 12, 118);
  ctx.moveTo(apexX, 106);
  ctx.lineTo(apexX, 130);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(ctx, apexX - 5, 112, 3, 2);

  // Ivy climbing the left corner.
  const rngI = mulberry32(31);
  ctx.strokeStyle = '#2f7a33';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(left + 3, stoneTop);
  ctx.bezierCurveTo(left - 4, stoneTop - 40, left + 10, wallTop + 50, left + 2, wallTop + 14);
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const x = left + 3 + Math.sin(t * 6) * 6;
    const y = stoneTop - t * (stoneTop - wallTop - 14);
    ctx.fillStyle = rngI() < 0.5 ? '#3f9a3d' : '#68c250';
    ellipse(ctx, x + (rngI() - 0.5) * 8, y, 4.4, 2.8, rngI() * 3);
  }
}

/** A woodpile, a barrel and a signpost pointing to the mine. */
function paintYardProps(ctx: Ctx): void {
  // Woodpile against the wall.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const x = 144 + i * 11 + row * 5.5;
      const y = BASE_Y - 6 - row * 10;
      ctx.beginPath();
      ctx.arc(x, y, 6.2, 0, TAU);
      paintShape(ctx, '#d6a566', 2.2);
      ctx.strokeStyle = 'rgba(120,70,30,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, TAU);
      ctx.stroke();
    }
  }
  // Rain barrel.
  ctx.beginPath();
  ctx.moveTo(396, BASE_Y - 4);
  ctx.quadraticCurveTo(388, BASE_Y - 26, 396, BASE_Y - 50);
  ctx.lineTo(424, BASE_Y - 50);
  ctx.quadraticCurveTo(432, BASE_Y - 26, 424, BASE_Y - 4);
  ctx.closePath();
  const barrel = ctx.createLinearGradient(392, 0, 428, 0);
  barrel.addColorStop(0, '#b27a42');
  barrel.addColorStop(1, '#774a25');
  paintShape(ctx, barrel, 3);
  ctx.fillStyle = '#3a3a44';
  for (const y of [BASE_Y - 40, BASE_Y - 12]) ctx.fillRect(391, y, 38, 4);
  ctx.beginPath();
  ctx.ellipse(410, BASE_Y - 50, 14, 4, 0, 0, TAU);
  paintShape(ctx, '#5f8fa0', 2.4);
  // Signpost with an arrow-shaped board (no words needed).
  roundRect(ctx, 458, BASE_Y - 78, 7, 80, 2);
  paintShape(ctx, '#7b4a24', 2.6);
  poly(ctx, [[440, BASE_Y - 74], [482, BASE_Y - 74], [496, BASE_Y - 64], [482, BASE_Y - 54], [440, BASE_Y - 54]]);
  paintShape(ctx, '#d1a05a', 2.8);
  ctx.strokeStyle = 'rgba(90,50,20,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(446, BASE_Y - 66);
  ctx.lineTo(480, BASE_Y - 66);
  ctx.moveTo(446, BASE_Y - 60);
  ctx.lineTo(474, BASE_Y - 60);
  ctx.stroke();
}

/** The home panel: cottage, tree and yard on a flowery bank. */
export function paintHome(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.scale(w / DESIGN_W, h / DESIGN_H);
  paintBank(ctx, 6, 514, 1234);
  paintTree(ctx);
  paintYardProps(ctx);
  paintHouse(ctx);
  ctx.restore();
}
