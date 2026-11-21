// Particle and effect textures: muzzle flashes, blood, dust, smoke, fire,
// explosion glow, shockwave ring, tracer, orbital beam, gunship, grenade.

import Phaser from 'phaser';
import { cylinderGradient, makeCanvas, mulberry32, rand, softCircle, speckle } from './CanvasUtil';

function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function muzzleFlash(seed: number): HTMLCanvasElement {
  const S = 160;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = mulberry32(seed);
  const c = S / 2;
  ctx.globalCompositeOperation = 'lighter';
  softCircle(ctx, c, c, 56, 'rgba(255,190,90,0.55)', 'rgba(255,120,30,0)');
  const spikes = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + rand(rng, -0.3, 0.3);
    const len = rand(rng, 36, 74);
    const w = rand(rng, 7, 13);
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, 'rgba(255,245,210,1)');
    g.addColorStop(0.4, 'rgba(255,190,90,0.85)');
    g.addColorStop(1, 'rgba(255,110,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -w / 2);
    ctx.quadraticCurveTo(len * 0.5, -w * 0.4, len, 0);
    ctx.quadraticCurveTo(len * 0.5, w * 0.4, 0, w / 2);
    ctx.fill();
    ctx.restore();
  }
  softCircle(ctx, c, c, 22, 'rgba(255,255,240,1)', 'rgba(255,220,150,0)');
  return canvas;
}

function radial(size: number, inner: string, outer: string): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  softCircle(ctx, size / 2, size / 2, size / 2, inner, outer);
  return canvas;
}

function smokePuff(seed: number): HTMLCanvasElement {
  const S = 96;
  const { canvas, ctx } = makeCanvas(S, S);
  const rng = mulberry32(seed);
  for (let i = 0; i < 9; i++) {
    softCircle(ctx, S / 2 + rand(rng, -18, 18), S / 2 + rand(rng, -14, 14), rand(rng, 18, 30), 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)');
  }
  return canvas;
}

function chunk(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(14, 12);
  const rng = mulberry32(seed);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = rand(rng, 3, 6);
    const x = 7 + Math.cos(a) * r, y = 6 + Math.sin(a) * r * 0.8;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.fill();
  return canvas;
}

function ring(): HTMLCanvasElement {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvas;
}

function tracer(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(128, 6);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,220,150,0)');
  g.addColorStop(0.7, 'rgba(255,230,170,0.7)');
  g.addColorStop(1, 'rgba(255,250,230,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 1, 128, 4);
  return canvas;
}

function beam(): HTMLCanvasElement {
  const W = 64, H = 512;
  const { canvas, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(160,220,255,0)');
  g.addColorStop(0.35, 'rgba(180,230,255,0.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(0.65, 'rgba(180,230,255,0.6)');
  g.addColorStop(1, 'rgba(160,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

function gunship(): HTMLCanvasElement {
  const W = 300, H = 110;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(55);
  const olive = 0x3a3e32;
  // tail boom
  ctx.fillStyle = cylinderGradient(ctx, 0, 0, olive, 0.1, 0.4);
  ctx.beginPath();
  ctx.moveTo(150, 50); ctx.lineTo(282, 44); ctx.lineTo(284, 52); ctx.lineTo(150, 64);
  ctx.fill();
  // tail fin + rotor
  ctx.fillStyle = '#2c3026';
  ctx.beginPath(); ctx.moveTo(268, 46); ctx.lineTo(290, 14); ctx.lineTo(298, 16); ctx.lineTo(284, 50); ctx.fill();
  ctx.fillStyle = 'rgba(30,30,30,0.5)';
  ctx.beginPath(); ctx.ellipse(288, 34, 4, 20, 0, 0, Math.PI * 2); ctx.fill();
  // narrow tandem fuselage
  const body = ctx.createLinearGradient(0, 30, 0, 90);
  body.addColorStop(0, '#3e4336');
  body.addColorStop(0.5, '#2a2e25');
  body.addColorStop(1, '#121410');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(24, 66);
  ctx.quadraticCurveTo(30, 40, 70, 34);
  ctx.lineTo(150, 30);
  ctx.quadraticCurveTo(176, 34, 178, 54);
  ctx.lineTo(170, 74);
  ctx.lineTo(60, 80);
  ctx.quadraticCurveTo(30, 78, 24, 66);
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, rng, 0, 0, W, H, 300, '#141610', 2, 0.1, 0.4);
  ctx.restore();
  // canopy
  ctx.fillStyle = '#1d2628';
  ctx.beginPath();
  ctx.moveTo(44, 50); ctx.quadraticCurveTo(60, 30, 104, 30); ctx.lineTo(108, 48); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(180,200,200,0.2)';
  ctx.beginPath(); ctx.moveTo(54, 44); ctx.quadraticCurveTo(66, 34, 90, 33); ctx.lineTo(70, 44); ctx.fill();
  // stub wings, rocket pods, chin gun
  ctx.fillStyle = '#22251d';
  ctx.fillRect(100, 62, 60, 7);
  ctx.fillStyle = '#2e3228';
  ctx.fillRect(108, 68, 38, 12);
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(108, 74, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#18191a';
  ctx.fillRect(14, 74, 34, 5);
  ctx.beginPath(); ctx.arc(44, 78, 6, 0, Math.PI * 2); ctx.fill();
  // skids
  ctx.strokeStyle = '#151612';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(60, 96); ctx.lineTo(160, 96); ctx.moveTo(80, 80); ctx.lineTo(76, 96); ctx.moveTo(140, 78); ctx.lineTo(144, 96); ctx.stroke();
  // rotor mast
  ctx.fillStyle = '#1a1b18';
  ctx.fillRect(110, 18, 10, 14);
  return canvas;
}

function rotor(): HTMLCanvasElement {
  const W = 340, H = 24;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  softCircle(ctx, 0, 0, W / 2, 'rgba(20,20,20,0.35)', 'rgba(20,20,20,0.05)');
  ctx.restore();
  ctx.fillStyle = 'rgba(15,15,15,0.7)';
  ctx.fillRect(0, H / 2 - 1.5, W, 3);
  return canvas;
}

function grenade(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(24, 24);
  ctx.fillStyle = cylinderGradient(ctx, 4, 20, 0x5a5c40, 0.4, 0.6);
  ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b08a3c';
  ctx.fillRect(5, 13, 14, 3);
  return canvas;
}

function scorch(): HTMLCanvasElement {
  const W = 256, H = 64;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(88);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  softCircle(ctx, 0, 0, W / 2, 'rgba(10,8,6,0.85)', 'rgba(10,8,6,0)');
  ctx.restore();
  speckle(ctx, rng, 20, 10, W - 40, H - 20, 120, '#000', 3, 0.1, 0.4);
  return canvas;
}

export function buildFxTextures(scene: Phaser.Scene): void {
  add(scene, 'flash_0', muzzleFlash(1));
  add(scene, 'flash_1', muzzleFlash(2));
  add(scene, 'flash_2', muzzleFlash(3));
  add(scene, 'dot', radial(16, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  add(scene, 'glow', radial(256, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  add(scene, 'smoke_0', smokePuff(4));
  add(scene, 'smoke_1', smokePuff(5));
  add(scene, 'chunk_0', chunk(6));
  add(scene, 'chunk_1', chunk(7));
  add(scene, 'ring', ring());
  add(scene, 'tracer', tracer());
  add(scene, 'beam', beam());
  add(scene, 'gunship', gunship());
  add(scene, 'rotor', rotor());
  add(scene, 'grenade', grenade());
  add(scene, 'scorch', scorch());
  const px = makeCanvas(4, 4);
  px.ctx.fillStyle = '#fff';
  px.ctx.fillRect(0, 0, 4, 4);
  add(scene, 'px', px.canvas);
}
