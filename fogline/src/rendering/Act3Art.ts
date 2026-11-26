// Procedural art for Act 3, "The Source": the quarry, the rail yard, the
// Meridian gate and the lab yard, plus the train and the gate generator that
// missions defend. Same muted, weathered palette as LocationArt.

import Phaser from 'phaser';
import { Rng, cylinderGradient, makeCanvas, mulberry32, rand, scratches, speckle } from './CanvasUtil';

function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function grime(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number): void {
  speckle(ctx, rng, x, y, w, h, Math.round((w * h) / 140), '#0c0a08', 3, 0.08, 0.35);
  scratches(ctx, rng, x, y, w, h, Math.round(w / 6), '#000', h * 0.3, 0.18, true);
}

function shape(ctx: CanvasRenderingContext2D, pts: number[][], fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A heap of broken quarry stone. */
function paintRock(seed: number): HTMLCanvasElement {
  const W = 300, H = 200;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  for (let i = 0; i < 7; i++) {
    const cx = rand(rng, 50, 250), cy = rand(rng, 110, 180), r = rand(rng, 30, 70);
    const pts: number[][] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rand(rng, -0.3, 0.3);
      pts.push([cx + Math.cos(a) * r * rand(rng, 0.7, 1.1), Math.min(H - 2, cy + Math.sin(a) * r * 0.7)]);
    }
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, '#8a8478');
    g.addColorStop(1, '#3e3a34');
    shape(ctx, pts, g);
  }
  grime(ctx, rng, 10, 60, 280, 140);
  return canvas;
}

/** The stone crusher: a tall frame with a slanted conveyor. */
function paintCrusher(): HTMLCanvasElement {
  const W = 420, H = 420;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(71);
  ctx.strokeStyle = '#2a2826';
  ctx.lineWidth = 10;
  for (const x of [60, 160, 260]) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 20, 120); ctx.stroke(); }
  ctx.lineWidth = 5;
  for (let y = 160; y < H; y += 70) { ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(280, y - 20); ctx.stroke(); }
  shape(ctx, [[30, 60], [310, 40], [320, 170], [40, 190]], '#5a4a32');
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 40; x < 310; x += 26) ctx.fillRect(x, 50, 4, 130);
  // the conveyor running down to the right
  shape(ctx, [[300, 120], [416, 330], [404, 344], [288, 136]], '#2e2c28');
  ctx.fillStyle = 'rgba(110,60,30,0.4)';
  for (let i = 0; i < 8; i++) ctx.fillRect(rand(rng, 40, 300), rand(rng, 60, 180), 5, rand(rng, 30, 90));
  grime(ctx, rng, 30, 40, 290, 380);
  return canvas;
}

/** A rusted rail boxcar, side on. */
function paintBoxcar(seed: number, base: string): HTMLCanvasElement {
  const W = 560, H = 230;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 20, 0, 190);
  g.addColorStop(0, base);
  g.addColorStop(1, '#241a14');
  ctx.fillStyle = g;
  ctx.fillRect(10, 20, 540, 170);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 20; x < 550; x += 30) ctx.fillRect(x, 20, 3, 170);
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(220, 40, 120, 150);
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 4;
  ctx.strokeRect(220, 40, 120, 150);
  ctx.fillStyle = '#0c0c0b';
  for (const x of [70, 140, 420, 490]) { ctx.beginPath(); ctx.arc(x, 204, 24, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(230,220,190,0.55)';
  ctx.font = 'bold 26px "Saira Stencil One", sans-serif';
  ctx.fillText(`HV ${400 + Math.floor(rng() * 500)}`, 40, 70);
  grime(ctx, rng, 10, 20, 540, 170);
  return canvas;
}

/** A rail signal post with two lamps. */
function paintSignal(): HTMLCanvasElement {
  const W = 60, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#2a2a28';
  ctx.fillRect(26, 60, 8, H - 60);
  ctx.fillRect(12, 20, 36, 70);
  ctx.fillStyle = '#d83020';
  ctx.beginPath(); ctx.arc(30, 40, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#304030';
  ctx.beginPath(); ctx.arc(30, 70, 9, 0, Math.PI * 2); ctx.fill();
  return canvas;
}

/** A length of chain-link security fence with barbed wire on top. */
function paintFence(): HTMLCanvasElement {
  const W = 400, H = 160;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.strokeStyle = 'rgba(150,150,140,0.55)';
  ctx.lineWidth = 1.2;
  for (let x = -H; x < W; x += 12) {
    ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x + 130, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 130, 30); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.fillStyle = '#3a3a36';
  for (let x = 4; x < W; x += 100) ctx.fillRect(x, 10, 7, H - 10);
  ctx.strokeStyle = '#2a2a26';
  ctx.lineWidth = 2;
  for (const y of [14, 22]) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.7) * 3);
    ctx.stroke();
  }
  return canvas;
}

/** Meridian Station's main block: concrete, dark windows, a sign and a vent stack. */
function paintMeridian(): HTMLCanvasElement {
  const W = 700, H = 420;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(73);
  const g = ctx.createLinearGradient(0, 60, 0, H);
  g.addColorStop(0, '#8a8c88');
  g.addColorStop(1, '#4a4c48');
  ctx.fillStyle = g;
  ctx.fillRect(20, 120, 660, 300);
  ctx.fillStyle = '#6a6c68';
  ctx.fillRect(480, 30, 80, 100);
  ctx.fillStyle = cylinderGradient(ctx, 600, 650, 0x5a5c58, 0.25, 0.6);
  ctx.fillRect(600, 0, 50, 130);
  for (let row = 0; row < 3; row++) {
    for (let x = 50; x < 660; x += 60) {
      ctx.fillStyle = rng() < 0.12 ? 'rgba(160,220,140,0.55)' : '#141616';
      ctx.fillRect(x, 160 + row * 80, 36, 44);
    }
  }
  ctx.fillStyle = '#1c1e1e';
  ctx.fillRect(300, 330, 100, 90);
  ctx.fillStyle = '#d8d4c4';
  ctx.font = 'bold 34px "Saira Stencil One", sans-serif';
  ctx.fillText('MERIDIAN', 60, 150);
  // fog seeping out of the doors and windows
  for (let i = 0; i < 26; i++) {
    const r = rand(rng, 20, 60);
    const fx = rand(rng, 260, 440), fy = rand(rng, 300, 420);
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    fg.addColorStop(0, 'rgba(200,210,200,0.25)');
    fg.addColorStop(1, 'rgba(200,210,200,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
  }
  grime(ctx, rng, 20, 120, 660, 300);
  return canvas;
}

/** A guard tower on legs. */
function paintTower(): HTMLCanvasElement {
  const W = 200, H = 460;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(74);
  ctx.strokeStyle = '#2a2a26';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(40, H); ctx.lineTo(60, 140); ctx.moveTo(160, H); ctx.lineTo(140, 140); ctx.stroke();
  ctx.lineWidth = 4;
  for (let y = 180; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(52, y); ctx.lineTo(150, y + 60); ctx.moveTo(150, y); ctx.lineTo(52, y + 60); ctx.stroke(); }
  shape(ctx, [[30, 60], [170, 60], [176, 150], [24, 150]], '#4a4c44');
  shape(ctx, [[14, 60], [100, 14], [186, 60]], '#2c2e2a');
  ctx.fillStyle = '#101212';
  ctx.fillRect(44, 80, 112, 36);
  grime(ctx, rng, 24, 14, 160, 140);
  return canvas;
}

/** A storage tank for the lab yard. */
function paintTank(): HTMLCanvasElement {
  const W = 260, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(75);
  ctx.fillStyle = cylinderGradient(ctx, 20, 240, 0x7a7e78, 0.25, 0.6);
  ctx.fillRect(20, 60, 220, 240);
  ctx.beginPath(); ctx.ellipse(130, 62, 110, 30, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 100; y < H; y += 50) ctx.fillRect(20, y, 220, 3);
  ctx.fillStyle = '#e8c040';
  ctx.beginPath(); ctx.moveTo(130, 140); ctx.lineTo(160, 190); ctx.lineTo(100, 190); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 30px "Saira Stencil One", sans-serif';
  ctx.fillText('☣', 116, 184);
  grime(ctx, rng, 20, 40, 220, 260);
  return canvas;
}

/** The evacuation train: a locomotive pulling one flat car. */
function paintTrain(): HTMLCanvasElement {
  const W = 640, H = 240;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(76);
  const g = ctx.createLinearGradient(0, 30, 0, 190);
  g.addColorStop(0, '#5a6250');
  g.addColorStop(1, '#2a2e24');
  ctx.fillStyle = g;
  ctx.fillRect(20, 110, 330, 80);
  ctx.fillRect(370, 50, 250, 140);
  ctx.fillStyle = '#3a4032';
  ctx.fillRect(520, 20, 70, 40);
  ctx.fillStyle = '#121416';
  ctx.fillRect(540, 70, 60, 40);
  ctx.fillStyle = 'rgba(255,230,160,0.9)';
  ctx.beginPath(); ctx.arc(620, 150, 9, 0, Math.PI * 2); ctx.fill();
  // crates on the flat car
  ctx.fillStyle = '#5a6a3a';
  for (const x of [40, 130, 220]) ctx.fillRect(x, 70, 80, 40);
  ctx.fillStyle = '#0c0c0b';
  for (const x of [60, 150, 300, 400, 480, 580]) { ctx.beginPath(); ctx.arc(x, 204, 22, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(230,220,190,0.6)';
  ctx.font = 'bold 22px "Saira Stencil One", sans-serif';
  ctx.fillText('ARMY 7', 400, 100);
  grime(ctx, rng, 20, 20, 600, 170);
  return canvas;
}

/** The gate generator: a boxy diesel set with cables and a warning light. */
function paintGenerator(): HTMLCanvasElement {
  const W = 360, H = 260;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(77);
  const g = ctx.createLinearGradient(0, 60, 0, 240);
  g.addColorStop(0, '#7a7440');
  g.addColorStop(1, '#3a3820');
  ctx.fillStyle = g;
  ctx.fillRect(30, 70, 300, 170);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let x = 50; x < 200; x += 14) ctx.fillRect(x, 100, 6, 90);
  ctx.fillStyle = '#1c1e1e';
  ctx.fillRect(220, 100, 90, 70);
  ctx.fillStyle = cylinderGradient(ctx, 260, 290, 0x3a3a36, 0.3, 0.6);
  ctx.fillRect(260, 20, 30, 50);
  ctx.fillStyle = '#ff9030';
  ctx.beginPath(); ctx.arc(60, 60, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(330, 200); ctx.quadraticCurveTo(352, 240, 300, 256); ctx.stroke();
  grime(ctx, rng, 30, 70, 300, 170);
  return canvas;
}

export function buildAct3Textures(scene: Phaser.Scene): void {
  add(scene, 'rock_0', paintRock(81));
  add(scene, 'rock_1', paintRock(82));
  add(scene, 'crusher', paintCrusher());
  add(scene, 'boxcar_0', paintBoxcar(83, '#6a3a24'));
  add(scene, 'boxcar_1', paintBoxcar(84, '#3e4a52'));
  add(scene, 'signal', paintSignal());
  add(scene, 'fence', paintFence());
  add(scene, 'meridian', paintMeridian());
  add(scene, 'tower', paintTower());
  add(scene, 'tank', paintTank());
  add(scene, 'asset_train', paintTrain());
  add(scene, 'asset_generator', paintGenerator());
}
