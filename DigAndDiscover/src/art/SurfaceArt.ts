import { mulberry32 } from '../core/Random';
import { TAU, ellipse, roundRect } from './paint';
import { paintHouseMiniMax } from './HouseMiniMax';

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
  paintHouseMiniMax(ctx);
  ctx.restore();
}

/**
 * The mine: a timber head-frame with a pulley and bucket, a glowing lantern, a crate with a
 * pickaxe, and an ore cart on rails heaped with gems.
 */
export function paintMine(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.scale(w / DESIGN_W, h / DESIGN_H);
  paintBank(ctx, 6, 514, 4321);

  // Rails and sleepers.
  ctx.fillStyle = '#6b4226';
  for (let x = 340; x < 500; x += 22) ctx.fillRect(x, BASE_Y - 4, 12, 5);
  ctx.strokeStyle = '#4a4e58';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(336, BASE_Y - 6);
  ctx.lineTo(506, BASE_Y - 6);
  ctx.stroke();

  // Head-frame legs and braces.
  const legs = (x0: number, x1: number): void => {
    ctx.fillStyle = '#8a5a30';
    poly(ctx, [[x0, BASE_Y], [x0 + 14, BASE_Y], [x1 + 8, 96], [x1 - 8, 96]]);
    ctx.fill();
    ink(ctx, 3);
  };
  legs(120, 220);
  legs(330, 236);
  // Cross beams.
  for (const [y, inset] of [[176, 36], [230, 12]] as const) {
    const xl = 120 + inset * 0.9;
    const xr = 344 - inset * 0.9;
    roundRect(ctx, xl, y, xr - xl, 12, 2);
    paintShape(ctx, '#a06a38', 2.8);
  }
  ctx.strokeStyle = '#8a5a30';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(150, 232);
  ctx.lineTo(300, 178);
  ctx.moveTo(300, 232);
  ctx.lineTo(160, 178);
  ctx.stroke();
  ink(ctx, 1.4, 'rgba(30,16,8,0.7)');
  // Nails.
  ctx.fillStyle = '#2b2b34';
  for (const [x, y] of [[158, 182], [286, 182], [140, 236], [304, 236], [228, 104], [236, 104]] as const) ellipse(ctx, x, y, 2, 2);

  // Pulley wheel at the apex.
  ctx.beginPath();
  ctx.arc(228, 88, 26, 0, TAU);
  paintShape(ctx, '#5b6270', 3.4);
  ctx.beginPath();
  ctx.arc(228, 88, 17, 0, TAU);
  paintShape(ctx, '#3e434d', 2.4);
  ctx.strokeStyle = '#8a93a2';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(228, 88);
    ctx.lineTo(228 + Math.cos(a) * 17, 88 + Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd34d';
  ellipse(ctx, 228, 88, 4, 4);
  // Rope and bucket.
  ctx.strokeStyle = '#c9a15e';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(206, 90);
  ctx.lineTo(204, 214);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,50,20,0.7)';
  ctx.lineWidth = 1;
  for (let y = 100; y < 212; y += 8) {
    ctx.beginPath();
    ctx.moveTo(202, y);
    ctx.lineTo(207, y + 4);
    ctx.stroke();
  }
  poly(ctx, [[188, 214], [220, 214], [216, 244], [192, 244]]);
  paintShape(ctx, grad(ctx, 214, 244, '#7c8696', '#4a4f5a'), 3);
  ctx.fillStyle = '#2b2b34';
  ctx.fillRect(189, 224, 30, 3);

  // Lantern on a hook.
  const lg = ctx.createRadialGradient(292, 150, 2, 292, 150, 34);
  lg.addColorStop(0, 'rgba(255,224,130,0.85)');
  lg.addColorStop(1, 'rgba(255,224,130,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(250, 110, 84, 84);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(292, 126);
  ctx.lineTo(292, 138);
  ctx.stroke();
  roundRect(ctx, 284, 138, 16, 20, 4);
  paintShape(ctx, '#ffd96a', 2.4);

  // Crate and pickaxe.
  roundRect(ctx, 56, BASE_Y - 40, 44, 40, 3);
  paintShape(ctx, '#b97e44', 3);
  ctx.strokeStyle = '#7b4a24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, BASE_Y - 36);
  ctx.lineTo(96, BASE_Y - 4);
  ctx.moveTo(96, BASE_Y - 36);
  ctx.lineTo(60, BASE_Y - 4);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(60, BASE_Y - 36, 36, 32);
  ctx.strokeStyle = '#8a5a30';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(98, BASE_Y - 6);
  ctx.lineTo(128, BASE_Y - 78);
  ctx.stroke();
  ink(ctx, 1.6);
  ctx.strokeStyle = '#5b6270';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(110, BASE_Y - 88);
  ctx.quadraticCurveTo(128, BASE_Y - 96, 148, BASE_Y - 72);
  ctx.stroke();
  ink(ctx, 1.6);

  // Ore cart with gems.
  for (const wx of [372, 440]) {
    ctx.beginPath();
    ctx.arc(wx, BASE_Y - 12, 9, 0, TAU);
    paintShape(ctx, '#3e434d', 2.6);
    ctx.fillStyle = '#8a93a2';
    ellipse(ctx, wx, BASE_Y - 12, 2.6, 2.6);
  }
  poly(ctx, [[352, BASE_Y - 56], [464, BASE_Y - 56], [452, BASE_Y - 20], [364, BASE_Y - 20]]);
  paintShape(ctx, grad(ctx, BASE_Y - 56, BASE_Y - 20, '#8a95a6', '#58606e'), 3.2);
  ctx.fillStyle = '#c4a063';
  ctx.fillRect(350, BASE_Y - 62, 116, 8);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(350, BASE_Y - 62, 116, 8);
  ctx.fillStyle = '#e8eef5';
  for (const x of [364, 390, 416, 442]) ellipse(ctx, x, BASE_Y - 38, 2.2, 2.2);
  ctx.fillStyle = 'rgba(176,96,52,0.45)';
  ellipse(ctx, 400, BASE_Y - 28, 22, 6);
  // Heap of ore and gems.
  const heap: Array<[number, number, number, string]> = [
    [374, 68, 14, '#8f959e'], [398, 74, 17, '#a7adb6'], [424, 68, 15, '#8f959e'], [448, 72, 11, '#a7adb6'],
  ];
  for (const [x, up, r, c] of heap) {
    ctx.beginPath();
    ctx.ellipse(x, BASE_Y - up, r, r * 0.8, 0, 0, TAU);
    paintShape(ctx, c, 2.4);
  }
  const gems: Array<[number, number, string]> = [[386, 82, '#5cc8ff'], [410, 88, '#ff5a7a'], [432, 80, '#5fe08a'], [398, 70, '#ffd34d']];
  for (const [x, up, c] of gems) {
    poly(ctx, [[x, BASE_Y - up - 10], [x + 8, BASE_Y - up], [x, BASE_Y - up + 8], [x - 8, BASE_Y - up]]);
    paintShape(ctx, c, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    poly(ctx, [[x, BASE_Y - up - 8], [x + 3, BASE_Y - up - 2], [x - 2, BASE_Y - up - 3]]);
    ctx.fill();
  }
  ctx.restore();
}
