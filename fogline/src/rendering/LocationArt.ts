// Procedural art for the campaign's locations and field objectives: farm silo and
// barn, orchard trees and sheds, station buildings, lamps, the relay mast, the
// fuel depot and the evacuation bus. Same muted, weathered palette as EnvironmentArt.

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

function paintSilo(): HTMLCanvasElement {
  const W = 180, H = 520;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(31);
  ctx.fillStyle = cylinderGradient(ctx, 30, 150, 0x5a5e5c, 0.2, 0.6);
  ctx.fillRect(30, 80, 120, H - 80);
  ctx.beginPath();
  ctx.ellipse(90, 82, 60, 60, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 110; y < H; y += 36) ctx.fillRect(30, y, 120, 3);
  grime(ctx, rng, 30, 40, 120, H - 40);
  // rust streaks and a ladder
  ctx.fillStyle = 'rgba(110,60,30,0.35)';
  for (let i = 0; i < 6; i++) ctx.fillRect(rand(rng, 36, 140), rand(rng, 90, 300), 4, rand(rng, 60, 200));
  ctx.strokeStyle = '#1e1f1e';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(126, 60); ctx.lineTo(126, H); ctx.moveTo(138, 60); ctx.lineTo(138, H); ctx.stroke();
  for (let y = 70; y < H; y += 14) { ctx.beginPath(); ctx.moveTo(126, y); ctx.lineTo(138, y); ctx.stroke(); }
  return canvas;
}

function paintBarn(): HTMLCanvasElement {
  const W = 420, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(32);
  shape(ctx, [[20, 120], [210, 20], [400, 120], [400, 300], [20, 300]], '#4a2a22');
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 30; x < 400; x += 18) ctx.fillRect(x, 110, 3, 190);
  shape(ctx, [[0, 128], [210, 10], [420, 128], [404, 136], [210, 30], [16, 136]], '#2a2522');
  // big doors, one hanging open
  ctx.fillStyle = '#120c0a';
  ctx.fillRect(150, 170, 120, 130);
  ctx.strokeStyle = '#6a4636';
  ctx.lineWidth = 5;
  ctx.strokeRect(150, 170, 60, 130);
  ctx.beginPath(); ctx.moveTo(150, 170); ctx.lineTo(210, 300); ctx.moveTo(210, 170); ctx.lineTo(150, 300); ctx.stroke();
  ctx.fillStyle = '#120c0a';
  ctx.fillRect(190, 70, 40, 34);
  grime(ctx, rng, 20, 20, 380, 280);
  return canvas;
}

function paintOrchardTree(seed: number): HTMLCanvasElement {
  const W = 260, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  ctx.strokeStyle = '#2a221c';
  ctx.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number): void => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    if (depth <= 0) return;
    const n = 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x2, y2, a + rand(rng, -0.75, 0.75), len * rand(rng, 0.6, 0.78), w * 0.68, depth - 1);
  };
  branch(W / 2, H, -Math.PI / 2 + rand(rng, -0.08, 0.08), 92, 16, 5);
  // a few dead leaves and fallen fruit at the foot
  ctx.fillStyle = 'rgba(90,60,30,0.5)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rand(rng, 40, 220), rand(rng, 40, 200), 3, 2);
  return canvas;
}

function paintShed(): HTMLCanvasElement {
  const W = 300, H = 200;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(33);
  shape(ctx, [[10, 60], [290, 40], [290, 200], [10, 200]], '#4e5048');
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 16; x < 290; x += 12) ctx.fillRect(x, 50, 2, 150);
  shape(ctx, [[0, 64], [300, 36], [300, 46], [0, 74]], '#2b2c2a');
  ctx.fillStyle = '#0f0f0e';
  ctx.fillRect(110, 110, 80, 90);
  grime(ctx, rng, 10, 40, 280, 160);
  return canvas;
}

function paintStation(): HTMLCanvasElement {
  const W = 460, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(34);
  ctx.fillStyle = '#5a5650';
  ctx.fillRect(10, 70, 440, 230);
  shape(ctx, [[0, 76], [40, 30], [420, 30], [460, 76]], '#3a2e2a');
  // canopy over the platform
  ctx.fillStyle = '#2a2b2c';
  ctx.fillRect(0, 150, 460, 12);
  for (const x of [20, 150, 310, 440]) ctx.fillRect(x - 3, 162, 6, 138);
  // windows, some broken and dark, one faint light
  for (let i = 0; i < 7; i++) {
    const x = 30 + i * 60;
    ctx.fillStyle = i === 4 ? 'rgba(210,170,90,0.55)' : '#121314';
    ctx.fillRect(x, 92, 34, 44);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 16, 92, 2, 44);
  }
  ctx.fillStyle = '#121314';
  ctx.fillRect(200, 190, 60, 110);
  // sign
  ctx.fillStyle = '#26323a';
  ctx.fillRect(150, 44, 160, 20);
  ctx.fillStyle = '#c8c8b8';
  ctx.font = 'bold 14px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MILLBROOK', 230, 59);
  grime(ctx, rng, 10, 30, 440, 270);
  return canvas;
}

function paintBusShelter(): HTMLCanvasElement {
  const W = 220, H = 160;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#2a2c2e';
  ctx.fillRect(0, 0, W, 10);
  for (const x of [6, 214]) ctx.fillRect(x - 3, 10, 6, 150);
  ctx.fillStyle = 'rgba(150,170,180,0.18)';
  ctx.fillRect(10, 14, 200, 120);
  ctx.strokeStyle = 'rgba(200,220,230,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 20); ctx.lineTo(90, 110); ctx.moveTo(60, 30); ctx.lineTo(30, 90); ctx.stroke();
  ctx.fillStyle = '#3a3226';
  ctx.fillRect(30, 110, 160, 8);
  return canvas;
}

function paintLamp(): HTMLCanvasElement {
  const W = 90, H = 360;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = cylinderGradient(ctx, 40, 50, 0x2e3032, 0.2, 0.6);
  ctx.fillRect(41, 30, 8, H - 30);
  ctx.fillStyle = '#2e3032';
  ctx.fillRect(10, 26, 40, 6);
  ctx.fillStyle = '#1a1b1c';
  ctx.fillRect(6, 30, 24, 10);
  return canvas;
}

function paintMast(): HTMLCanvasElement {
  const W = 200, H = 600;
  const { canvas, ctx } = makeCanvas(W, H);
  // lattice tower narrowing upwards
  ctx.strokeStyle = '#3a3e40';
  ctx.lineWidth = 5;
  const L = (y: number): number => 30 + (y / H) * 40, R = (y: number): number => W - 30 - (y / H) * 40;
  ctx.beginPath(); ctx.moveTo(L(H) - 20, H); ctx.lineTo(W / 2 - 10, 40); ctx.moveTo(R(H) + 20, H); ctx.lineTo(W / 2 + 10, 40); ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let y = 80; y < H; y += 46) {
    const t = (y - 40) / (H - 40);
    const lx = W / 2 - 10 - t * 60, rx = W / 2 + 10 + t * 60;
    const t2 = (y + 46 - 40) / (H - 40);
    ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.lineTo(W / 2 - 10 - t2 * 60, y + 46); ctx.stroke();
  }
  // dishes and a red warning light
  ctx.fillStyle = '#8a8e8a';
  ctx.beginPath(); ctx.ellipse(W / 2 - 24, 150, 16, 20, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W / 2 + 26, 230, 14, 18, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3e40';
  ctx.fillRect(W / 2 - 2, 0, 4, 44);
  ctx.fillStyle = '#ff3a2a';
  ctx.beginPath(); ctx.arc(W / 2, 6, 6, 0, Math.PI * 2); ctx.fill();
  // equipment hut at the foot
  ctx.fillStyle = '#4a4c48';
  ctx.fillRect(20, H - 90, 90, 90);
  ctx.fillStyle = '#2a2b2a';
  ctx.fillRect(16, H - 96, 98, 8);
  ctx.fillStyle = '#111';
  ctx.fillRect(40, H - 60, 26, 60);
  return canvas;
}

function paintFuel(): HTMLCanvasElement {
  const W = 420, H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(35);
  // two horizontal tanks on cradles, a pump stand
  for (const [x, y, w, h] of [[10, 70, 250, 110], [140, 20, 230, 90]] as const) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#9a9a88');
    g.addColorStop(0.45, '#6e6e60');
    g.addColorStop(1, '#2e2e28');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x + h / 2, y + h / 2, h / 2.6, h / 2, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.lineTo(x + w - h / 2, y);
    ctx.ellipse(x + w - h / 2, y + h / 2, h / 2.6, h / 2, 0, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b02a1a';
    ctx.font = 'bold 22px Impact, sans-serif';
    ctx.fillText('FUEL', x + w / 2 - 26, y + h / 2 + 8);
  }
  ctx.fillStyle = '#2a2a26';
  for (const x of [40, 110, 190, 240]) ctx.fillRect(x, 176, 14, 44);
  ctx.fillStyle = '#5a3a26';
  ctx.fillRect(360, 110, 40, 110);
  grime(ctx, rng, 10, 20, 400, 200);
  return canvas;
}

function paintBus(): HTMLCanvasElement {
  const W = 600, H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(36);
  // side view, facing right
  const g = ctx.createLinearGradient(0, 30, 0, 190);
  g.addColorStop(0, '#c8a040');
  g.addColorStop(0.6, '#9a7428');
  g.addColorStop(1, '#4a3814');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(10, 40); ctx.lineTo(560, 40); ctx.quadraticCurveTo(594, 44, 594, 90);
  ctx.lineTo(594, 180); ctx.lineTo(10, 180); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1c1e';
  ctx.fillRect(10, 150, 584, 10);
  // windows with silhouettes of passengers
  for (let i = 0; i < 9; i++) {
    const x = 30 + i * 58;
    ctx.fillStyle = '#16191c';
    ctx.fillRect(x, 58, 46, 46);
    ctx.fillStyle = 'rgba(60,50,40,0.9)';
    if (rng() < 0.75) {
      ctx.beginPath(); ctx.arc(x + 23, 84, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x + 13, 92, 20, 12);
    }
  }
  ctx.fillStyle = '#20262a';
  ctx.fillRect(552, 54, 36, 60);
  ctx.fillStyle = 'rgba(255,230,160,0.9)';
  ctx.fillRect(586, 128, 8, 14);
  ctx.fillStyle = '#0c0c0b';
  for (const x of [110, 470]) {
    ctx.beginPath(); ctx.arc(x, 182, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a36';
    ctx.beginPath(); ctx.arc(x, 182, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c0c0b';
  }
  grime(ctx, rng, 10, 40, 584, 140);
  return canvas;
}

function paintHouse(seed: number): HTMLCanvasElement {
  const W = 260, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  const wall = ['#5a4a40', '#4e5052', '#605448'][seed % 3];
  shape(ctx, [[10, 110], [130, 20], [250, 110], [250, 300], [10, 300]], wall);
  shape(ctx, [[0, 116], [130, 10], [260, 116], [246, 124], [130, 30], [14, 124]], '#2a2624');
  ctx.fillStyle = '#2a2624';
  ctx.fillRect(170, 30, 24, 60);
  for (const [x, y] of [[40, 140], [160, 140], [40, 220]]) {
    const lit = rng() < 0.2;
    ctx.fillStyle = lit ? 'rgba(210,170,90,0.6)' : '#111214';
    ctx.fillRect(x, y, 50, 56);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 24, y, 2, 56);
    if (rng() < 0.5) {
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x - 4, y + rand(rng, 10, 30), 58, 6);
    }
  }
  ctx.fillStyle = '#18120e';
  ctx.fillRect(160, 220, 50, 80);
  grime(ctx, rng, 10, 20, 240, 280);
  return canvas;
}

function paintOverpass(): HTMLCanvasElement {
  const W = 900, H = 300;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(51);
  ctx.fillStyle = '#5c5e5e';
  ctx.fillRect(0, 40, W, 70);
  ctx.fillStyle = '#3e4040';
  ctx.fillRect(0, 110, W, 14);
  ctx.fillStyle = '#6e7070';
  ctx.fillRect(0, 26, W, 14);
  for (const x of [120, 420, 720]) {
    ctx.fillStyle = cylinderGradient(ctx, x - 30, x + 30, 0x5a5c5c, 0.2, 0.6);
    ctx.fillRect(x - 30, 124, 60, H - 124);
  }
  // a broken section with rebar
  ctx.clearRect(560, 20, 70, 60);
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(560 + i * 12, 60); ctx.lineTo(556 + i * 12 + rand(rng, -6, 6), 30); ctx.stroke(); }
  ctx.fillStyle = '#c8b870';
  ctx.font = 'bold 18px Consolas, monospace';
  ctx.fillText('HWY 9  MILLBROOK', 60, 80);
  grime(ctx, rng, 0, 26, W, H - 26);
  return canvas;
}

function paintRail(post: string): HTMLCanvasElement {
  const W = 400, H = 90;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = post;
  for (let x = 6; x < W; x += 48) ctx.fillRect(x, 20, 8, 70);
  ctx.fillStyle = '#8a8c88';
  ctx.fillRect(0, 18, W, 14);
  ctx.fillRect(0, 48, W, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 30, W, 3);
  return canvas;
}

function paintWreck(): HTMLCanvasElement {
  const W = 520, H = 240;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(52);
  // A downed helicopter on its side: fuselage, broken tail boom, bent rotor.
  shape(ctx, [[60, 120], [120, 70], [300, 64], [360, 100], [370, 200], [80, 210]], '#3e4a3a');
  shape(ctx, [[340, 110], [510, 150], [506, 166], [350, 150]], '#36402f');
  ctx.fillStyle = '#16191a';
  shape(ctx, [[130, 82], [200, 78], [196, 130], [126, 136]], '#141a1e');
  ctx.strokeStyle = '#1e201e';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(190, 66); ctx.lineTo(40, 30); ctx.moveTo(210, 66); ctx.lineTo(420, 20); ctx.stroke();
  ctx.fillStyle = '#c8c0a0';
  ctx.font = 'bold 22px Impact, sans-serif';
  ctx.fillText('KESTREL', 220, 150);
  ctx.fillStyle = 'rgba(255,140,40,0.55)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(rand(rng, 300, 360), rand(rng, 140, 200), rand(rng, 6, 14), 0, Math.PI * 2); ctx.fill(); }
  grime(ctx, rng, 60, 60, 450, 150);
  return canvas;
}

function paintTruck(): HTMLCanvasElement {
  const W = 520, H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(53);
  // Army cargo truck, facing right: canvas back, cab at the front.
  const g = ctx.createLinearGradient(0, 30, 0, 180);
  g.addColorStop(0, '#6a7050');
  g.addColorStop(1, '#3a3e2a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(10, 40); ctx.quadraticCurveTo(170, 10, 340, 40); ctx.lineTo(340, 160); ctx.lineTo(10, 160); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let x = 40; x < 340; x += 50) { ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, 160); ctx.stroke(); }
  ctx.fillStyle = '#4a5036';
  ctx.fillRect(350, 70, 150, 100);
  ctx.fillStyle = '#16191c';
  ctx.fillRect(420, 84, 60, 40);
  ctx.fillStyle = 'rgba(255,230,160,0.9)';
  ctx.fillRect(494, 140, 8, 12);
  ctx.fillStyle = '#0c0c0b';
  for (const x of [90, 260, 440]) { ctx.beginPath(); ctx.arc(x, 178, 30, 0, Math.PI * 2); ctx.fill(); }
  grime(ctx, rng, 10, 30, 490, 140);
  return canvas;
}

function paintNest(): HTMLCanvasElement {
  const W = 220, H = 220;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(54);
  // A swollen growth of grey flesh with a glowing core, veined, sprouting tendrils.
  ctx.strokeStyle = '#2a2826';
  ctx.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.1 + 0.8 * rng());
    ctx.beginPath(); ctx.moveTo(110, 150); ctx.quadraticCurveTo(110 + Math.cos(a) * 60, 150 + Math.sin(a) * 90, 110 + Math.cos(a) * 100, 150 + Math.sin(a) * 140); ctx.stroke();
  }
  const g = ctx.createRadialGradient(110, 150, 10, 110, 150, 90);
  g.addColorStop(0, '#9aa090');
  g.addColorStop(0.6, '#5a5e54');
  g.addColorStop(1, '#2e302a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(110, 160, 92, 60, 0, 0, Math.PI * 2); ctx.fill();
  const core = ctx.createRadialGradient(110, 150, 0, 110, 150, 36);
  core.addColorStop(0, 'rgba(230,255,200,1)');
  core.addColorStop(0.5, 'rgba(150,220,120,0.8)');
  core.addColorStop(1, 'rgba(80,140,60,0)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(110, 150, 36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,30,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(110, 150); ctx.lineTo(110 + rand(rng, -90, 90), 160 + rand(rng, -50, 50)); ctx.stroke(); }
  return canvas;
}

function paintDrum(): HTMLCanvasElement {
  const W = 80, H = 110;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = cylinderGradient(ctx, 6, 74, 0xb02a1a, 0.3, 0.6);
  ctx.fillRect(6, 8, 68, 100);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const y of [36, 74]) ctx.fillRect(6, y, 68, 4);
  ctx.fillStyle = '#e8c040';
  ctx.beginPath(); ctx.moveTo(40, 44); ctx.lineTo(54, 68); ctx.lineTo(26, 68); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 16px Impact, sans-serif';
  ctx.fillText('!', 37, 65);
  ctx.fillStyle = '#7a1a10';
  ctx.beginPath(); ctx.ellipse(40, 9, 34, 6, 0, 0, Math.PI * 2); ctx.fill();
  return canvas;
}

function paintCrate(): HTMLCanvasElement {
  const W = 120, H = 110;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#5a6a3a';
  ctx.fillRect(6, 10, 108, 96);
  ctx.strokeStyle = '#2e361e';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 10, 108, 96);
  ctx.beginPath(); ctx.moveTo(6, 10); ctx.lineTo(114, 106); ctx.moveTo(114, 10); ctx.lineTo(6, 106); ctx.stroke();
  ctx.fillStyle = '#e8e0c0';
  ctx.fillRect(38, 46, 44, 24);
  ctx.fillStyle = '#b02a1a';
  ctx.fillRect(56, 48, 8, 20);
  ctx.fillRect(50, 54, 20, 8);
  return canvas;
}

function paintChute(): HTMLCanvasElement {
  const W = 240, H = 200;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#d8d0b8';
  ctx.beginPath(); ctx.ellipse(120, 60, 110, 56, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(120, 4); ctx.lineTo(20 + i * 50, 60); ctx.lineTo(45 + i * 50, 60); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(40,40,40,0.8)';
  ctx.lineWidth = 2;
  for (const x of [14, 70, 170, 226]) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(120, H); ctx.stroke(); }
  return canvas;
}

function paintSoldier(): HTMLCanvasElement {
  // Seen from behind, leaning on the sandbags with a rifle across the parapet.
  const W = 150, H = 170;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(55);
  ctx.fillStyle = '#2e3226';
  ctx.beginPath(); ctx.moveTo(20, H); ctx.quadraticCurveTo(26, 70, 75, 62); ctx.quadraticCurveTo(124, 70, 130, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a4030';
  ctx.fillRect(48, 90, 54, 50);
  ctx.fillStyle = '#7a6250';
  ctx.beginPath(); ctx.ellipse(75, 52, 17, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a4232';
  ctx.beginPath(); ctx.ellipse(75, 40, 26, 18, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(48, 38, 54, 6);
  // rifle across, pointing up-right toward the field
  ctx.strokeStyle = '#1a1b1c';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(40, 120); ctx.lineTo(125, 40); ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(120, 46); ctx.lineTo(140, 28); ctx.stroke();
  grime(ctx, rng, 20, 30, 110, 140);
  return canvas;
}

export function buildLocationTextures(scene: Phaser.Scene): void {
  add(scene, 'house', paintHouse(61));
  add(scene, 'overpass', paintOverpass());
  add(scene, 'guardrail', paintRail('#5a5c58'));
  add(scene, 'bridge_rail', paintRail('#3a3c3a'));
  add(scene, 'asset_wreck', paintWreck());
  add(scene, 'asset_truck', paintTruck());
  add(scene, 'asset_nest', paintNest());
  add(scene, 'fuel_drum', paintDrum());
  add(scene, 'supply_crate', paintCrate());
  add(scene, 'parachute', paintChute());
  add(scene, 'squad_soldier', paintSoldier());
  add(scene, 'silo', paintSilo());
  add(scene, 'barn', paintBarn());
  add(scene, 'orchard_tree', paintOrchardTree(41));
  add(scene, 'shed', paintShed());
  add(scene, 'station', paintStation());
  add(scene, 'bus_shelter', paintBusShelter());
  add(scene, 'lamp', paintLamp());
  add(scene, 'asset_mast', paintMast());
  add(scene, 'asset_fuel', paintFuel());
  add(scene, 'asset_bus', paintBus());
}
