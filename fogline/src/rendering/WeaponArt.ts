// First-person weapon view models (drawn pointing up the screen, muzzle at the
// top, in perspective so the rear is wider) plus side-profile HUD icons.

import Phaser from 'phaser';
import { Rng, cylinderGradient, hex, makeCanvas, mulberry32, rand, scratches, shadeColor, softCircle, speckle } from './CanvasUtil';

export const VIEW_W = 300;
export const VIEW_H = 400;
/** Muzzle position in view-model texture pixels (top centre). */
export const MUZZLE_Y = 8;

const CX = VIEW_W / 2;

function trap(ctx: CanvasRenderingContext2D, yTop: number, yBot: number, wTop: number, wBot: number, base: number, light = 0.22, dark = 0.6, xOff = 0): void {
  ctx.beginPath();
  ctx.moveTo(CX + xOff - wTop / 2, yTop);
  ctx.lineTo(CX + xOff + wTop / 2, yTop);
  ctx.lineTo(CX + xOff + wBot / 2, yBot);
  ctx.lineTo(CX + xOff - wBot / 2, yBot);
  ctx.closePath();
  ctx.fillStyle = cylinderGradient(ctx, CX + xOff - wBot / 2, CX + xOff + wBot / 2, base, light, dark);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5,5,5,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function wear(ctx: CanvasRenderingContext2D, rng: Rng, y0: number, y1: number, w: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(CX - w / 2, y0, w, y1 - y0);
  ctx.clip();
  scratches(ctx, rng, CX - w / 2, y0, w, y1 - y0, 50, '#b0b4b6', 8, 0.18);
  speckle(ctx, rng, CX - w / 2, y0, w, y1 - y0, 120, '#000', 1.5, 0.05, 0.25);
  ctx.restore();
}

function widthAt(y: number, yTop: number, yBot: number, wTop: number, wBot: number): number {
  return wTop + (wBot - wTop) * ((y - yTop) / (yBot - yTop));
}

/** Rail teeth along a trapezoid's top face. */
function railTeeth(ctx: CanvasRenderingContext2D, yTop: number, yBot: number, wTop: number, wBot: number, frac = 0.42): void {
  for (let y = yTop + 4; y < yBot - 2;) {
    const w = widthAt(y, yTop, yBot, wTop, wBot) * frac;
    const step = 3 + (y - yTop) / (yBot - yTop) * 5;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(CX - w / 2, y, w, step * 0.45);
    ctx.fillStyle = 'rgba(150,155,160,0.22)';
    ctx.fillRect(CX - w / 2, y + step * 0.45, w, 1);
    y += step;
  }
}

function frontSightAFrame(ctx: CanvasRenderingContext2D, y: number, w: number, h: number, color = '#141516'): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX - w / 2, y + h);
  ctx.lineTo(CX - w * 0.18, y);
  ctx.moveTo(CX + w / 2, y + h);
  ctx.lineTo(CX + w * 0.18, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(CX - 1.6, y + 2, 3.2, h * 0.7);
}

function glove(ctx: CanvasRenderingContext2D, rng: Rng, gx: number, gy: number, s: number): void {
  // sleeve running out of frame bottom-left
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(gx - 34 * s, gy + 34 * s);
  ctx.lineTo(gx + 6 * s, gy + 44 * s);
  ctx.lineTo(gx - 40 * s, VIEW_H + 10);
  ctx.lineTo(gx - 150 * s, VIEW_H + 10);
  ctx.closePath();
  ctx.fillStyle = cylinderGradient(ctx, gx - 150 * s, gx + 10 * s, 0x4a4c38, 0.15, 0.6);
  ctx.fill();
  ctx.clip();
  // muted woodland camo blotches
  for (let i = 0; i < 26; i++) {
    const c = ['rgba(40,38,26,0.6)', 'rgba(92,84,58,0.5)', 'rgba(28,32,24,0.6)'][i % 3];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(gx - rand(rng, 0, 150) * s, gy + rand(rng, 30, 200) * s, rand(rng, 8, 20) * s, rand(rng, 4, 10) * s, rand(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // cuff
  ctx.fillStyle = '#1f201b';
  ctx.beginPath();
  ctx.ellipse(gx - 14 * s, gy + 36 * s, 24 * s, 10 * s, -0.35, 0, Math.PI * 2);
  ctx.fill();
  // back of hand
  ctx.fillStyle = cylinderGradient(ctx, gx - 30 * s, gx + 12 * s, 0x2c2b26, 0.25, 0.6);
  ctx.beginPath();
  ctx.ellipse(gx - 10 * s, gy + 14 * s, 22 * s, 24 * s, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // fingers wrapping over the handguard
  for (let i = 0; i < 4; i++) {
    const fy = gy - 6 * s + i * 11 * s;
    ctx.fillStyle = cylinderGradient(ctx, gx, gx + 26 * s, 0x34332c, 0.3, 0.5);
    ctx.beginPath();
    ctx.ellipse(gx + 10 * s, fy, 17 * s, 5.6 * s, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,150,120,0.15)';
    ctx.fillRect(gx + 2 * s, fy - 3 * s, 14 * s, 1.2 * s);
  }
  // knuckle pad
  ctx.fillStyle = '#1a1a17';
  ctx.beginPath();
  ctx.ellipse(gx - 6 * s, gy + 4 * s, 9 * s, 16 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------ view models

function viewService(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(1);
  const wood = 0x6b4426, steel = 0x3d3f40;
  trap(ctx, 82, 230, 30, 66, wood, 0.25, 0.55);
  // wood grain
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX - 15, 82); ctx.lineTo(CX + 15, 82); ctx.lineTo(CX + 33, 230); ctx.lineTo(CX - 33, 230); ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,16,6,0.4)';
  for (let i = 0; i < 18; i++) {
    const x = CX + rand(rng, -30, 30);
    ctx.lineWidth = rand(rng, 0.6, 1.6);
    ctx.beginPath();
    ctx.moveTo(x * 0.5 + CX * 0.5, 82);
    ctx.quadraticCurveTo(x + rand(rng, -5, 5), 150, x * 1.1 - CX * 0.1, 230);
    ctx.stroke();
  }
  speckle(ctx, rng, CX - 35, 82, 70, 150, 120, '#1a0c04', 1.6, 0.1, 0.4);
  scratches(ctx, rng, CX - 35, 82, 70, 150, 30, '#c09060', 7, 0.25);
  ctx.restore();
  // gas cylinder + barrel
  trap(ctx, 34, 96, 12, 16, 0x2b2c2d);
  trap(ctx, 12, 96, 8, 11, steel, 0.35, 0.6);
  // slotted flash suppressor
  trap(ctx, 4, 30, 11, 12, 0x1d1e1f, 0.3, 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  for (let y = 8; y < 28; y += 5) ctx.fillRect(CX - 1, y, 2, 3);
  // front sight with protective ears
  ctx.fillStyle = '#18191a';
  ctx.fillRect(CX - 9, 56, 18, 8);
  ctx.fillRect(CX - 9, 44, 3.5, 16);
  ctx.fillRect(CX + 5.5, 44, 3.5, 16);
  ctx.fillRect(CX - 1.5, 42, 3, 18);
  // receiver
  trap(ctx, 230, 400, 54, 92, steel, 0.25, 0.6);
  wear(ctx, rng, 230, 400, 80);
  // rear aperture
  ctx.strokeStyle = '#121314';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(CX, 292, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#121314';
  ctx.fillRect(CX - 18, 296, 8, 22);
  ctx.fillRect(CX + 10, 296, 8, 22);
  glove(ctx, rng, CX - 30, 150, 1.0);
  return canvas;
}

function viewM4(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(2);
  const black = 0x26282b;
  trap(ctx, 30, 84, 9, 11, 0x2e3032, 0.35, 0.6);
  // birdcage flash hider
  trap(ctx, 4, 32, 12, 13, 0x151617, 0.35, 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  for (let y = 7; y < 28; y += 6) {
    ctx.fillRect(CX - 4, y, 2, 4);
    ctx.fillRect(CX + 2, y, 2, 4);
  }
  frontSightAFrame(ctx, 60, 30, 26);
  // quad rail handguard
  trap(ctx, 84, 206, 32, 62, black, 0.2, 0.65);
  railTeeth(ctx, 84, 206, 32, 62, 0.46);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (let y = 96; y < 200; y += 22) {
    const w = widthAt(y, 84, 206, 32, 62);
    ctx.fillRect(CX - w / 2 + 2, y, 3, 8);
    ctx.fillRect(CX + w / 2 - 5, y, 3, 8);
  }
  // upper receiver
  trap(ctx, 206, 400, 64, 104, 0x2a2c2f, 0.22, 0.6);
  railTeeth(ctx, 206, 270, 64, 76, 0.4);
  wear(ctx, rng, 206, 400, 90);
  // ejection port + forward assist on the right
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(CX + 26, 300, 18, 46);
  ctx.fillStyle = '#3a3c3f';
  ctx.beginPath(); ctx.arc(CX + 46, 286, 6, 0, Math.PI * 2); ctx.fill();
  // red-dot optic seen from behind
  const oy = 244;
  ctx.fillStyle = '#18191b';
  ctx.fillRect(CX - 14, oy + 18, 28, 26);
  ctx.beginPath();
  ctx.ellipse(CX, oy, 34, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = cylinderGradient(ctx, CX - 34, CX + 34, 0x2c2e31, 0.3, 0.6);
  ctx.fill();
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(CX, oy, 25, 18, 0, 0, Math.PI * 2);
  const lens = ctx.createLinearGradient(CX - 25, oy - 18, CX + 25, oy + 18);
  lens.addColorStop(0, 'rgba(80,120,110,0.95)');
  lens.addColorStop(0.5, 'rgba(25,40,40,0.95)');
  lens.addColorStop(1, 'rgba(60,90,100,0.95)');
  ctx.fillStyle = lens;
  ctx.fill();
  softCircle(ctx, CX, oy - 2, 5, 'rgba(255,40,30,1)', 'rgba(255,40,30,0)');
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.ellipse(CX - 10, oy - 8, 8, 3, -0.4, 0, Math.PI * 2); ctx.fill();
  // charging handle
  ctx.fillStyle = '#1a1b1d';
  ctx.fillRect(CX - 30, 384, 60, 12);
  glove(ctx, rng, CX - 34, 132, 1.0);
  return canvas;
}

function viewM249(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(3);
  // folded bipod legs
  ctx.strokeStyle = '#121314';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(CX - 18, 70); ctx.lineTo(CX - 32, 172);
  ctx.moveTo(CX + 18, 70); ctx.lineTo(CX + 32, 172);
  ctx.stroke();
  trap(ctx, 34, 150, 13, 16, 0x2e3032, 0.35, 0.6);
  trap(ctx, 4, 36, 16, 17, 0x151617, 0.3, 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  for (let y = 8; y < 32; y += 6) { ctx.fillRect(CX - 5, y, 2.4, 4); ctx.fillRect(CX + 3, y, 2.4, 4); }
  ctx.fillStyle = '#141516';
  ctx.fillRect(CX - 2, 40, 4, 14);
  // perforated heat shield
  trap(ctx, 62, 150, 24, 32, 0x34362f, 0.25, 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  for (let y = 68; y < 146; y += 9) for (const dx of [-0.25, 0, 0.25]) {
    const w = widthAt(y, 62, 150, 24, 32);
    ctx.beginPath(); ctx.ellipse(CX + dx * w, y, 2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  // carry handle
  ctx.strokeStyle = '#1c1d1f';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(CX - 26, 196); ctx.quadraticCurveTo(CX, 150, CX + 26, 196);
  ctx.stroke();
  // receiver with feed cover
  trap(ctx, 150, 400, 64, 128, 0x2b2d2a, 0.2, 0.6);
  trap(ctx, 200, 330, 56, 82, 0x33352f, 0.25, 0.55);
  wear(ctx, rng, 150, 400, 110);
  ctx.fillStyle = '#0e0f0e';
  ctx.fillRect(CX - 18, 318, 36, 8);
  // belt of linked brass entering from the left
  for (let i = 0; i < 8; i++) {
    const bx = CX - 40 - i * 13, by = 262 + i * 9;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.55);
    ctx.fillStyle = cylinderGradient(ctx, -5, 5, 0xb08a3c, 0.4, 0.5);
    ctx.fillRect(-4.5, -16, 9, 24);
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath(); ctx.moveTo(-4.5, -16); ctx.lineTo(0, -24); ctx.lineTo(4.5, -16); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  }
  // soft ammo pouch
  ctx.fillStyle = cylinderGradient(ctx, 0, 110, 0x4a4a32, 0.2, 0.55);
  ctx.beginPath();
  ctx.moveTo(10, 330); ctx.quadraticCurveTo(50, 300, 104, 320); ctx.lineTo(96, VIEW_H); ctx.lineTo(0, VIEW_H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
  glove(ctx, rng, CX - 40, 196, 1.05);
  return canvas;
}

function viewM32(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(4);
  // 40mm barrel with visible bore
  trap(ctx, 16, 150, 50, 62, 0x2d2f2a, 0.3, 0.6);
  wear(ctx, rng, 16, 150, 60);
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.ellipse(CX, 20, 21, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,120,110,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(CX, 20, 24, 10, 0, 0, Math.PI * 2); ctx.stroke();
  railTeeth(ctx, 40, 150, 14, 18, 0.9);
  // flip-up ladder sight
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 3;
  ctx.strokeRect(CX - 14, 150, 28, 34);
  for (let y = 156; y < 184; y += 6) { ctx.beginPath(); ctx.moveTo(CX - 14, y); ctx.lineTo(CX + 14, y); ctx.stroke(); }
  // revolving cylinder
  trap(ctx, 180, 330, 120, 150, 0x30322c, 0.25, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX - 60, 180); ctx.lineTo(CX + 60, 180); ctx.lineTo(CX + 75, 330); ctx.lineTo(CX - 75, 330); ctx.closePath();
  ctx.clip();
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = CX + s * (20 + k * 22);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 6, 184, 12, 142);
    ctx.fillStyle = 'rgba(180,180,170,0.15)';
    ctx.fillRect(x - 6, 184, 2, 142);
  }
  ctx.restore();
  trap(ctx, 330, 400, 90, 110, 0x262824, 0.2, 0.6);
  wear(ctx, rng, 180, 400, 140);
  glove(ctx, rng, CX - 42, 104, 1.1);
  return canvas;
}

function viewShotgun(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(5);
  const steel = 0x2f3132, wood = 0x5a3a20;
  // Magazine tube under the barrel, then the wide 12-gauge barrel with a bead sight.
  trap(ctx, 30, 212, 24, 36, 0x262728, 0.3, 0.6, 0);
  trap(ctx, 6, 212, 22, 32, steel, 0.35, 0.6);
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.ellipse(CX, 10, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d8d0b0';
  ctx.beginPath(); ctx.arc(CX, 22, 3, 0, Math.PI * 2); ctx.fill();
  // Ribbed wooden pump (fore-end).
  trap(ctx, 108, 224, 62, 88, wood, 0.25, 0.55);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(CX - 31, 108); ctx.lineTo(CX + 31, 108); ctx.lineTo(CX + 44, 224); ctx.lineTo(CX - 44, 224); ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(20,10,4,0.55)';
  for (let y = 114; y < 220; y += 10) ctx.fillRect(CX - 46, y, 92, 4);
  speckle(ctx, rng, CX - 46, 108, 92, 116, 120, '#1a0c04', 1.6, 0.1, 0.35);
  ctx.restore();
  // Receiver and stock.
  trap(ctx, 224, 400, 96, 156, steel, 0.25, 0.6);
  wear(ctx, rng, 224, 400, 136);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(CX + 28, 262, 14, 52);
  glove(ctx, rng, CX - 44, 156, 1.3);
  return canvas;
}

function viewM82(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(6);
  // Long fluted barrel with a big muzzle brake, a scope above, chunky receiver.
  trap(ctx, 20, 240, 18, 26, 0x2a2c2e, 0.35, 0.6);
  trap(ctx, 2, 30, 36, 38, 0x1c1d1e, 0.3, 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  for (let y = 6; y < 28; y += 7) { ctx.fillRect(CX - 18, y, 8, 4); ctx.fillRect(CX + 10, y, 8, 4); }
  // scope tube and lens
  trap(ctx, 150, 290, 44, 58, 0x18191a, 0.3, 0.6);
  ctx.fillStyle = '#0a1418';
  ctx.beginPath(); ctx.ellipse(CX, 152, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,180,220,0.35)';
  ctx.beginPath(); ctx.ellipse(CX - 5, 150, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  trap(ctx, 240, 400, 96, 150, 0x34372f, 0.25, 0.6);
  wear(ctx, rng, 240, 400, 130);
  glove(ctx, rng, CX - 46, 200, 1.25);
  return canvas;
}

function viewFlamer(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(7);
  // Nozzle with a pilot light, a fuel line, the wand and grip.
  trap(ctx, 4, 70, 30, 34, 0x2c2a26, 0.3, 0.6);
  ctx.fillStyle = '#050505';
  ctx.beginPath(); ctx.ellipse(CX, 8, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  softCircle(ctx, CX + 18, 22, 10, 'rgba(120,180,255,1)', 'rgba(120,180,255,0)');
  trap(ctx, 70, 260, 26, 40, 0x4a4a40, 0.3, 0.6);
  ctx.strokeStyle = '#1a1a18';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(CX + 14, 110); ctx.quadraticCurveTo(CX + 70, 230, CX + 60, 400); ctx.stroke();
  trap(ctx, 260, 400, 70, 110, 0x3a3830, 0.25, 0.6);
  wear(ctx, rng, 70, 400, 100);
  glove(ctx, rng, CX - 40, 170, 1.2);
  return canvas;
}

function viewRpg(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(8);
  // A fat olive launch tube with the rocket's warhead poking out, a sight box and grips.
  trap(ctx, 40, 400, 58, 74, 0x4a5236, 0.3, 0.6);
  ctx.fillStyle = '#0a0a08';
  ctx.beginPath(); ctx.ellipse(CX, 40, 29, 10, 0, 0, Math.PI * 2); ctx.fill();
  // warhead cone
  ctx.fillStyle = '#5a5e4a';
  ctx.beginPath(); ctx.moveTo(CX - 20, 42); ctx.lineTo(CX, 2); ctx.lineTo(CX + 20, 42); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const y of [120, 250]) ctx.fillRect(CX - 36, y, 72, 6);
  trap(ctx, 150, 210, 22, 24, 0x1c1d1a, 0.3, 0.6, -46);
  ctx.fillStyle = '#e8c040';
  ctx.fillRect(CX - 30, 300, 60, 8);
  wear(ctx, rng, 40, 400, 70);
  glove(ctx, rng, CX - 44, 230, 1.3);
  return canvas;
}

function viewRailgun(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(9);
  // Twin rails with blue coils between them, a capacitor block and a glowing charge strip.
  trap(ctx, 4, 250, 12, 18, 0x2a2e34, 0.35, 0.6, -16);
  trap(ctx, 4, 250, 12, 18, 0x2a2e34, 0.35, 0.6, 16);
  for (let y = 30; y < 240; y += 22) {
    softCircle(ctx, CX, y, 9, 'rgba(120,200,255,0.9)', 'rgba(120,200,255,0)');
    ctx.fillStyle = '#3a5a78';
    ctx.fillRect(CX - 12, y - 3, 24, 6);
  }
  trap(ctx, 240, 400, 100, 150, 0x30343a, 0.25, 0.6);
  ctx.fillStyle = 'rgba(120,200,255,0.85)';
  ctx.fillRect(CX - 40, 290, 80, 6);
  ctx.fillRect(CX - 46, 330, 92, 4);
  wear(ctx, rng, 240, 400, 130);
  glove(ctx, rng, CX - 48, 200, 1.25);
  return canvas;
}

function viewDoorgun(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(10);
  // Six barrels in a cluster, a drum housing, spade grips on each side.
  for (const dx of [-15, -6, 3, 12]) trap(ctx, 6, 190, 8, 11, 0x26282a, 0.35, 0.6, dx);
  ctx.fillStyle = '#121314';
  ctx.fillRect(CX - 26, 70, 52, 10);
  ctx.fillRect(CX - 26, 150, 52, 10);
  trap(ctx, 190, 320, 70, 110, 0x2e3230, 0.25, 0.6);
  trap(ctx, 320, 400, 110, 140, 0x22241f, 0.25, 0.6);
  ctx.strokeStyle = '#1a1b18';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(CX - 70, 330); ctx.lineTo(CX - 70, 400); ctx.moveTo(CX + 70, 330); ctx.lineTo(CX + 70, 400); ctx.stroke();
  // ammo belt feeding in from the right
  ctx.fillStyle = '#b08a3c';
  for (let i = 0; i < 9; i++) ctx.fillRect(CX + 50 + i * 9, 250 + i * 14, 8, 12);
  wear(ctx, rng, 190, 400, 120);
  glove(ctx, rng, CX - 92, 300, 1.2);
  glove(ctx, rng, CX + 40, 300, 1.2);
  return canvas;
}

function viewTesla(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const rng = mulberry32(11);
  // A copper coil stack ending in a forked emitter, a glass capacitor and a heavy grip.
  trap(ctx, 30, 220, 40, 54, 0x8a5a30, 0.35, 0.6);
  ctx.strokeStyle = 'rgba(40,20,8,0.7)';
  ctx.lineWidth = 2;
  for (let y = 40; y < 216; y += 7) { ctx.beginPath(); ctx.moveTo(CX - 24, y); ctx.lineTo(CX + 24, y); ctx.stroke(); }
  ctx.strokeStyle = '#2a2c2e';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(CX - 18, 34); ctx.lineTo(CX - 26, 4); ctx.moveTo(CX + 18, 34); ctx.lineTo(CX + 26, 4); ctx.stroke();
  softCircle(ctx, CX, 14, 22, 'rgba(150,210,255,0.95)', 'rgba(150,210,255,0)');
  softCircle(ctx, CX, 280, 30, 'rgba(120,190,255,0.7)', 'rgba(120,190,255,0)');
  trap(ctx, 220, 400, 96, 146, 0x2e3034, 0.25, 0.6);
  ctx.fillStyle = 'rgba(140,200,255,0.55)';
  ctx.fillRect(CX - 22, 250, 44, 60);
  wear(ctx, rng, 220, 400, 120);
  glove(ctx, rng, CX - 46, 190, 1.25);
  return canvas;
}

// ------------------------------------------------------------ HUD icons

function icon(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(128, 48);
  paint(ctx);
  return canvas;
}

function poly(ctx: CanvasRenderingContext2D, pts: number[][], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function iconService(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 26], [40, 22], [92, 21], [92, 27], [56, 30], [44, 36], [10, 36]], '#7a5232');
  poly(ctx, [[40, 18], [70, 18], [72, 24], [40, 25]], '#4a4c4e');
  poly(ctx, [[70, 20], [124, 20], [124, 23], [70, 23]], '#5a5c5e');
  poly(ctx, [[52, 25], [60, 25], [58, 38], [52, 37]], '#3a3c3e');
}

function iconM4(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 20], [26, 18], [26, 30], [6, 32]], '#3a3c3f');
  poly(ctx, [[24, 17], [70, 16], [70, 26], [24, 27]], '#2e3033');
  poly(ctx, [[70, 17], [102, 17], [102, 25], [70, 25]], '#26282b');
  poly(ctx, [[102, 19.5], [124, 19.5], [124, 22.5], [102, 22.5]], '#4a4c4f');
  poly(ctx, [[46, 26], [56, 26], [60, 42], [50, 43]], '#2a2c2e');
  poly(ctx, [[34, 26], [40, 26], [38, 36], [32, 36]], '#2a2c2e');
  poly(ctx, [[42, 10], [58, 10], [58, 16], [42, 16]], '#1d1e20');
  ctx.fillStyle = '#ff3a2a';
  ctx.fillRect(43, 12, 2, 2);
}

function iconM249(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 18], [26, 17], [26, 32], [8, 34]], '#3a3c37');
  poly(ctx, [[24, 14], [76, 14], [76, 30], [24, 30]], '#33352f');
  poly(ctx, [[76, 17], [124, 18], [124, 23], [76, 25]], '#4a4c45');
  poly(ctx, [[40, 30], [62, 30], [62, 44], [40, 44]], '#4a4a32');
  poly(ctx, [[34, 30], [40, 30], [38, 40], [32, 40]], '#2a2c2a');
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(104, 24); ctx.lineTo(98, 40); ctx.moveTo(106, 24); ctx.lineTo(112, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40, 14); ctx.quadraticCurveTo(52, 4, 64, 14); ctx.stroke();
}

function iconM32(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 16], [30, 18], [30, 30], [6, 34]], '#33352f');
  poly(ctx, [[30, 12], [66, 10], [66, 36], [30, 34]], '#2d2f2a');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let x = 34; x < 64; x += 8) ctx.fillRect(x, 12, 3, 22);
  poly(ctx, [[66, 14], [122, 14], [122, 28], [66, 28]], '#3a3c35');
  ctx.fillStyle = '#060606';
  ctx.fillRect(118, 16, 4, 10);
  poly(ctx, [[86, 28], [94, 28], [92, 42], [86, 42]], '#2a2c28');
}

function iconShotgun(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 22], [30, 18], [34, 22], [32, 32], [8, 36]], '#5a3a20');
  poly(ctx, [[30, 16], [58, 16], [58, 28], [32, 28]], '#2f3132');
  poly(ctx, [[58, 17], [124, 17], [124, 21], [58, 21]], '#45474a');
  poly(ctx, [[58, 22], [110, 22], [110, 26], [58, 26]], '#2a2b2c');
  poly(ctx, [[72, 21], [96, 21], [96, 29], [72, 29]], '#6a4426');
  poly(ctx, [[40, 28], [46, 28], [44, 38], [38, 38]], '#2a2c2e');
}

function iconM82(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 22], [24, 20], [26, 32], [8, 34]], '#34372f');
  poly(ctx, [[24, 18], [64, 18], [64, 30], [24, 30]], '#2a2c26');
  poly(ctx, [[64, 21], [118, 21], [118, 25], [64, 25]], '#3e403a');
  poly(ctx, [[116, 19], [126, 19], [126, 27], [116, 27]], '#1c1d1e');
  poly(ctx, [[30, 10], [60, 10], [60, 16], [30, 16]], '#16171a');
  poly(ctx, [[86, 25], [90, 25], [84, 40], [80, 40]], '#2a2c2a');
  poly(ctx, [[92, 25], [96, 25], [102, 40], [98, 40]], '#2a2c2a');
}

function iconFlamer(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[6, 16], [30, 16], [30, 38], [6, 38]], '#5a4a30');
  poly(ctx, [[30, 22], [100, 22], [100, 30], [30, 30]], '#4a4a40');
  poly(ctx, [[100, 20], [118, 20], [118, 32], [100, 32]], '#2c2a26');
  ctx.fillStyle = '#ff8a30';
  ctx.beginPath(); ctx.arc(122, 26, 4, 0, Math.PI * 2); ctx.fill();
  poly(ctx, [[50, 30], [58, 30], [56, 42], [50, 42]], '#2a2c2e');
}

function iconRpg(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 18], [104, 18], [104, 30], [4, 30]], '#4a5236');
  poly(ctx, [[104, 16], [124, 24], [104, 32]], '#5a5e4a');
  poly(ctx, [[40, 10], [54, 10], [54, 18], [40, 18]], '#1c1d1a');
  poly(ctx, [[46, 30], [52, 30], [50, 42], [44, 42]], '#2a2c28');
  poly(ctx, [[70, 30], [76, 30], [74, 40], [68, 40]], '#2a2c28');
  ctx.fillStyle = '#e8c040';
  ctx.fillRect(20, 22, 10, 4);
}

function iconRailgun(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 20], [30, 18], [30, 32], [8, 34]], '#30343a');
  poly(ctx, [[30, 14], [70, 14], [70, 32], [30, 32]], '#2a2e34');
  poly(ctx, [[70, 15], [124, 15], [124, 19], [70, 19]], '#3a4048');
  poly(ctx, [[70, 27], [124, 27], [124, 31], [70, 31]], '#3a4048');
  ctx.fillStyle = 'rgba(120,200,255,0.9)';
  for (let x = 76; x < 122; x += 8) ctx.fillRect(x, 20, 4, 6);
  ctx.fillRect(36, 22, 28, 3);
  poly(ctx, [[44, 32], [52, 32], [50, 42], [44, 42]], '#2a2c2e');
}

function iconDoorgun(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[10, 14], [44, 14], [44, 36], [10, 36]], '#2e3230');
  for (const y of [16, 21, 26, 31]) poly(ctx, [[44, y], [122, y], [122, y + 3], [44, y + 3]], '#3a3c3a');
  poly(ctx, [[2, 20], [10, 20], [10, 30], [2, 30]], '#1a1b18');
  ctx.fillStyle = '#b08a3c';
  for (let i = 0; i < 5; i++) ctx.fillRect(20 + i * 5, 36, 4, 8);
}

function iconTesla(ctx: CanvasRenderingContext2D): void {
  poly(ctx, [[4, 20], [30, 18], [30, 34], [8, 36]], '#2e3034');
  poly(ctx, [[30, 16], [96, 16], [96, 30], [30, 30]], '#8a5a30');
  ctx.strokeStyle = 'rgba(40,20,8,0.8)';
  for (let x = 34; x < 94; x += 5) { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, 30); ctx.stroke(); }
  poly(ctx, [[96, 14], [110, 18], [110, 28], [96, 32]], '#2a2c2e');
  ctx.strokeStyle = '#a8d8ff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(110, 23); ctx.lineTo(116, 17); ctx.lineTo(120, 27); ctx.lineTo(126, 21); ctx.stroke();
  poly(ctx, [[44, 30], [52, 30], [50, 42], [44, 42]], '#2a2c2e');
}

function iconBullet(color: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.save();
  ctx.translate(24, 24);
  ctx.rotate(-0.6);
  ctx.fillStyle = cylinderGradient(ctx, -6, 6, 0xb08a3c, 0.4, 0.5);
  ctx.fillRect(-6, -2, 12, 20);
  ctx.fillStyle = cylinderGradient(ctx, -6, 6, color, 0.4, 0.5);
  ctx.beginPath();
  ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-6, -16, 0, -20); ctx.quadraticCurveTo(6, -16, 6, -2);
  ctx.fill();
  ctx.fillStyle = '#5a4a2a';
  ctx.fillRect(-7, 16, 14, 3);
  ctx.restore();
  return canvas;
}

function symbol(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(48, 48);
  ctx.strokeStyle = '#c8c8b8';
  ctx.fillStyle = '#c8c8b8';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paint(ctx);
  return canvas;
}

export function buildWeaponTextures(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, c);
  };
  add('view_service', viewService());
  add('view_m4', viewM4());
  add('view_m249', viewM249());
  add('view_m32', viewM32());
  add('view_shotgun', viewShotgun());
  add('icon_shotgun', icon(iconShotgun));
  add('view_m82', viewM82());
  add('icon_m82', icon(iconM82));
  add('view_flamer', viewFlamer());
  add('icon_flamer', icon(iconFlamer));
  add('view_rpg', viewRpg());
  add('icon_rpg', icon(iconRpg));
  add('view_railgun', viewRailgun());
  add('icon_railgun', icon(iconRailgun));
  add('view_doorgun', viewDoorgun());
  add('view_tesla', viewTesla());
  add('icon_tesla', icon(iconTesla));
  add('icon_doorgun', icon(iconDoorgun));
  add('icon_service', icon(iconService));
  add('icon_m4', icon(iconM4));
  add('icon_m249', icon(iconM249));
  add('icon_m32', icon(iconM32));
  add('icon_mod_double', iconBullet(0xe0a040));
  add('icon_mod_ap', iconBullet(0x9fb4c8));
  add('icon_mod_fire', iconBullet(0xff6a2a));
  add('icon_mod_cryo', iconBullet(0x7fd6ff));
  add('icon_gunship', symbol((c) => {
    c.beginPath(); c.ellipse(22, 26, 13, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(30, 24, 14, 3); c.fillRect(42, 19, 3, 10);
    c.beginPath(); c.moveTo(4, 17); c.lineTo(42, 17); c.stroke();
    c.beginPath(); c.moveTo(22, 17); c.lineTo(22, 21); c.stroke();
    c.beginPath(); c.moveTo(14, 33); c.lineTo(30, 33); c.stroke();
  }));
  add('icon_orbital', symbol((c) => {
    c.beginPath(); c.arc(24, 24, 12, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(24, 24, 3, 0, Math.PI * 2); c.fill();
    for (const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      c.beginPath(); c.moveTo(24 + a * 16, 24 + b * 16); c.lineTo(24 + a * 8, 24 + b * 8); c.stroke();
    }
  }));
  add('icon_nuke', symbol((c) => {
    c.fillStyle = '#d8c040';
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      c.beginPath(); c.moveTo(24, 24); c.arc(24, 24, 17, a - 0.5, a + 0.5); c.closePath(); c.fill();
    }
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(24, 24, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d8c040';
    c.beginPath(); c.arc(24, 24, 3.5, 0, Math.PI * 2); c.fill();
  }));
  add('icon_repair', symbol((c) => {
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(12, 36); c.lineTo(30, 18); c.stroke();
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(33, 15, 7, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
    c.fillStyle = '#6fbf5a';
    c.fillRect(30, 30, 12, 4); c.fillRect(34, 26, 4, 12);
  }));
  add('icon_wall', symbol((c) => {
    for (let i = 0; i < 3; i++) c.strokeRect(8 + i * 11, 12, 10, 26);
    c.fillStyle = '#c9a227';
    c.fillRect(8, 8, 33, 4);
  }));
  add('icon_reinforce', symbol((c) => {
    c.beginPath(); c.moveTo(24, 6); c.lineTo(40, 12); c.lineTo(38, 28); c.lineTo(24, 40); c.lineTo(10, 28); c.lineTo(8, 12); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(24, 14); c.lineTo(24, 32); c.moveTo(15, 23); c.lineTo(33, 23); c.stroke();
  }));
  void hex; void shadeColor;
}
