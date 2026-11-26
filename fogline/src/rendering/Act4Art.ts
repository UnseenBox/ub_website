// Procedural art for Act 4, "The Fog Returns": the north coast. Saltmarsh harbour
// (crane, containers, a beached boat), Gull Point lighthouse, Fort Ashby's walls,
// and the spore pods that shield the Bloom.

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

/** A dockside crane: lattice tower, jib and hook. */
function paintCrane(): HTMLCanvasElement {
  const W = 420, H = 520;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(91);
  ctx.strokeStyle = '#7a4a24';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(90, H); ctx.lineTo(120, 110); ctx.moveTo(170, H); ctx.lineTo(150, 110); ctx.stroke();
  ctx.lineWidth = 4;
  for (let y = 140; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(100, y); ctx.lineTo(165, y + 40); ctx.moveTo(165, y); ctx.lineTo(100, y + 40); ctx.stroke(); }
  ctx.fillStyle = '#6a3e1e';
  ctx.fillRect(70, 80, 130, 50);
  ctx.strokeStyle = '#7a4a24';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(130, 90); ctx.lineTo(410, 60); ctx.moveTo(130, 120); ctx.lineTo(410, 66); ctx.stroke();
  ctx.strokeStyle = '#1a1a18';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(380, 64); ctx.lineTo(380, 260); ctx.stroke();
  ctx.fillStyle = '#1a1a18';
  ctx.fillRect(370, 258, 20, 14);
  grime(ctx, rng, 70, 60, 340, 460);
  return canvas;
}

/** A rusted shipping container, side on. */
function paintContainer(seed: number, base: string): HTMLCanvasElement {
  const W = 480, H = 200;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, base);
  g.addColorStop(1, '#1c1a18');
  ctx.fillStyle = g;
  ctx.fillRect(4, 10, 472, 186);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let x = 14; x < 470; x += 16) ctx.fillRect(x, 10, 5, 186);
  ctx.fillStyle = 'rgba(120,60,30,0.4)';
  for (let i = 0; i < 10; i++) ctx.fillRect(rand(rng, 10, 460), rand(rng, 20, 120), 6, rand(rng, 30, 80));
  ctx.fillStyle = 'rgba(230,220,200,0.5)';
  ctx.font = 'bold 26px "Saira Stencil One", sans-serif';
  ctx.fillText(`SLTU ${100000 + Math.floor(rng() * 899999)}`, 24, 50);
  grime(ctx, rng, 4, 10, 472, 186);
  return canvas;
}

/** A fishing boat left on the mud at low tide. */
function paintBoat(): HTMLCanvasElement {
  const W = 460, H = 260;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(92);
  ctx.fillStyle = '#2a4a5a';
  ctx.beginPath(); ctx.moveTo(10, 120); ctx.lineTo(450, 110); ctx.lineTo(400, 230); ctx.quadraticCurveTo(220, 260, 60, 228); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c8c0a8';
  ctx.fillRect(14, 112, 432, 10);
  ctx.fillStyle = '#d8d4c4';
  ctx.fillRect(250, 40, 120, 76);
  ctx.fillStyle = '#161a1c';
  for (const x of [262, 300, 338]) ctx.fillRect(x, 54, 24, 22);
  ctx.strokeStyle = '#2a2a28';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(150, 112); ctx.lineTo(150, 0); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(150, 10); ctx.lineTo(40, 112); ctx.moveTo(150, 10); ctx.lineTo(240, 112); ctx.stroke();
  grime(ctx, rng, 10, 40, 440, 200);
  return canvas;
}

/** Gull Point lighthouse: striped tower, gallery and lamp room. */
function paintLighthouse(): HTMLCanvasElement {
  const W = 200, H = 620;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(93);
  ctx.beginPath(); ctx.moveTo(60, 120); ctx.lineTo(140, 120); ctx.lineTo(170, H); ctx.lineTo(30, H); ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = cylinderGradient(ctx, 30, 170, 0xe0dcd0, 0.2, 0.55);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(160,30,24,0.85)';
  for (let y = 170; y < H; y += 120) ctx.fillRect(0, y, W, 56);
  ctx.restore();
  ctx.fillStyle = '#1e2022';
  ctx.fillRect(44, 110, 112, 12);
  ctx.fillStyle = 'rgba(255,230,150,0.9)';
  ctx.fillRect(66, 58, 68, 52);
  ctx.fillStyle = '#1e2022';
  ctx.beginPath(); ctx.moveTo(56, 60); ctx.lineTo(100, 20); ctx.lineTo(144, 60); ctx.closePath(); ctx.fill();
  grime(ctx, rng, 30, 110, 140, 510);
  return canvas;
}

/** A length of Fort Ashby's stone curtain wall with a crenellated top. */
function paintFortWall(): HTMLCanvasElement {
  const W = 520, H = 260;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(94);
  const g = ctx.createLinearGradient(0, 40, 0, H);
  g.addColorStop(0, '#8a8478');
  g.addColorStop(1, '#4a463e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 60, W, H - 60);
  for (let x = 0; x < W; x += 64) ctx.fillRect(x, 30, 40, 32);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let y = 80; y < H; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (y / 26) % 2 ? 0 : 30; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(60,80,50,0.35)';
  for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(rand(rng, 0, W), rand(rng, 180, H), rand(rng, 10, 30), 0, Math.PI * 2); ctx.fill(); }
  grime(ctx, rng, 0, 30, W, H - 30);
  return canvas;
}

/** A spore pod: a pulsing pink sac on a stalk (the Bloom's shield). */
function paintPod(): HTMLCanvasElement {
  const W = 160, H = 200;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(95);
  ctx.strokeStyle = '#3a2a30';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(80, H); ctx.quadraticCurveTo(70, 150, 80, 110); ctx.stroke();
  const g = ctx.createRadialGradient(70, 70, 6, 80, 80, 66);
  g.addColorStop(0, '#f8c8e0');
  g.addColorStop(0.5, '#c86898');
  g.addColorStop(1, '#5a2a44');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(80, 80, 60, 70, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,20,50,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(80, 20); ctx.quadraticCurveTo(rand(rng, 30, 130), 80, 80, 148); ctx.stroke();
  }
  return canvas;
}

/** A soft grey-green spore cloud (Sporeling deaths). */
function paintSporeCloud(): HTMLCanvasElement {
  const W = 256, H = 256;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(96);
  for (let i = 0; i < 26; i++) {
    const x = rand(rng, 60, 196), y = rand(rng, 60, 196), r = rand(rng, 30, 80);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(170,190,150,0.5)');
    g.addColorStop(1, 'rgba(170,190,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

/** Rain streaks, tiled over the field in a storm. */
function paintRain(): HTMLCanvasElement {
  const W = 256, H = 256;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(99);
  ctx.strokeStyle = 'rgba(200,215,230,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 70; i++) {
    const x = rand(rng, 0, W), y = rand(rng, 0, H), l = rand(rng, 14, 30);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.22, y + l); ctx.stroke();
  }
  return canvas;
}

export function buildAct4Textures(scene: Phaser.Scene): void {
  add(scene, 'rain', paintRain());
  add(scene, 'crane', paintCrane());
  add(scene, 'container_0', paintContainer(97, '#7a2e22'));
  add(scene, 'container_1', paintContainer(98, '#2a4e6a'));
  add(scene, 'boat', paintBoat());
  add(scene, 'lighthouse', paintLighthouse());
  add(scene, 'fort_wall', paintFortWall());
  add(scene, 'spore_pod', paintPod());
  add(scene, 'spore_cloud', paintSporeCloud());
}
