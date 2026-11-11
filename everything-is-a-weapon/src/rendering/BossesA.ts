import { INK } from '../core/constants';
import { TAU } from '../core/math';
import { ChairmanScript } from '../entities/bossScripts/ChairmanScript';
import { FlusherScript } from '../entities/bossScripts/FlusherScript';
import { FridgeScript } from '../entities/bossScripts/FridgeScript';
import { PianoScript } from '../entities/bossScripts/PianoScript';
import {
  blob, bolt, blink, brow, darken, eye, eyePair, fist, gloss, lighten, limb, lin, maw, paint, puffs, rad, raging, rrect, shadeBand, tentacle, wheel,
  type BossBody,
} from './BossKit';

/**
 * The Chairman's memos: sheets of paperwork circling him, rejected hits flutter one away,
 * and a fresh batch swoops in when the copier finishes. Drawn in two halves so they pass
 * behind and in front of him.
 */
function drawMemos(ctx: CanvasRenderingContext2D, e: Parameters<BossBody>[1], x: number, y: number, time: number, front: boolean): void {
  const script = e.script instanceof ChairmanScript ? e.script : null;
  if (!script || e.defeated) return;
  const n = script.memos;
  const arrive = Math.max(0, 1 - script.reloadedAgo / 0.6);
  for (let i = 0; i < n; i++) {
    const a = time * 1.9 + (i * TAU) / Math.max(1, n);
    const isFront = Math.sin(a) > 0;
    if (isFront !== front) continue;
    const spread = 1 + arrive * 1.8;
    const rx = (26 + 12) * spread;
    const mx = x + Math.cos(a) * rx;
    const my = y - 34 + Math.sin(a) * 14 * spread - arrive * 18;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.cos(a) * 0.35 + Math.sin(time * 3 + i) * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-6, -7, 14, 18);
    ctx.fillStyle = '#fbf8f0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.fillRect(-7, -9, 14, 18);
    ctx.strokeRect(-7, -9, 14, 18);
    ctx.fillStyle = '#d63a3a';
    ctx.fillRect(-7, -9, 14, 4);
    ctx.fillStyle = 'rgba(40, 46, 60, 0.55)';
    for (let l = 0; l < 3; l++) ctx.fillRect(-5, -3 + l * 4, 10 - (l === 2 ? 4 : 0), 1.4);
    ctx.restore();
  }
  if (!front) return;
  // a memo he just lost flutters off for a moment
  if (script.tornAgo < 0.7) {
    const t = script.tornAgo / 0.7;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.translate(x + 30 + t * 34, y - 40 - t * 26 + t * t * 60);
    ctx.rotate(t * 5);
    ctx.fillStyle = '#fbf8f0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.fillRect(-7, -9, 14, 18);
    ctx.strokeRect(-7, -9, 14, 18);
    ctx.fillStyle = '#d63a3a';
    ctx.fillRect(-7, -9, 14, 4);
    ctx.restore();
  }
}

/** Overtime: a red glow and steam off the head; in the final quarter his tie is on fire. */
function drawFury(ctx: CanvasRenderingContext2D, e: Parameters<BossBody>[1], x: number, y: number, hx: number, hy: number, time: number): void {
  const script = e.script instanceof ChairmanScript ? e.script : null;
  if (!script || e.defeated || (e.phaseIndex < 1 && !script.finale)) return;
  const final = script.finale;
  const pulse = 0.5 + 0.5 * Math.sin(time * (final ? 11 : 6));
  const glow = ctx.createRadialGradient(x, y - 36, 6, x, y - 36, 78);
  glow.addColorStop(0, `rgba(255, 60, 40, ${(final ? 0.34 : 0.2) * (0.6 + 0.4 * pulse)})`);
  glow.addColorStop(1, 'rgba(255, 40, 30, 0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 36, 78, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // steam out of both ears
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const t = (time * 1.4 + k / 3 + (side > 0 ? 0.17 : 0)) % 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(hx + side * 12 + side * t * 6, hy - 2 - t * 22, 2 + t * 4, 0, TAU);
      ctx.fill();
    }
  }
  if (final) {
    // flames licking up his tie
    for (let k = 0; k < 5; k++) {
      const t = (time * 2.4 + k * 0.21) % 1;
      const fx0 = x + Math.sin(k * 2.1 + time * 6) * 4;
      const fy0 = y - 42 - t * 22;
      ctx.fillStyle = k % 2 ? `rgba(255, 210, 63, ${0.9 * (1 - t)})` : `rgba(255, 90, 40, ${0.9 * (1 - t)})`;
      ctx.beginPath();
      ctx.moveTo(fx0 - 3.5, fy0 + 6);
      ctx.quadraticCurveTo(fx0 - 1, fy0 - 4, fx0, fy0 - 9 - t * 6);
      ctx.quadraticCurveTo(fx0 + 1, fy0 - 4, fx0 + 3.5, fy0 + 6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Out of office: loosened tie, a sweat drop or two, stars wheeling over his head. */
function drawOutOfOffice(ctx: CanvasRenderingContext2D, e: Parameters<BossBody>[1], hx: number, hy: number, time: number): void {
  const script = e.script instanceof ChairmanScript ? e.script : null;
  if (!script || script.pose !== 'dizzy' || e.defeated) return;
  for (let i = 0; i < 3; i++) {
    const a = time * 4 + (i * TAU) / 3;
    const sx = hx + Math.cos(a) * 14;
    const sy = hy - 20 + Math.sin(a) * 4;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 === 0 ? 4.4 : 1.9;
      const aa = (k * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const t = (time * 1.6 + (side > 0 ? 0.5 : 0)) % 1;
    ctx.fillStyle = 'rgba(150, 215, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(hx + side * 13, hy - 4 + t * 12, 1.8, 2.6, 0, 0, TAU);
    ctx.fill();
  }
}

function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** The Chairman: an executive on a tufted leather throne, headset on, review in his eyes. */
export const chairman: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup, hop } = p;
  const b = y + hd + 1;
  const dead = e.defeated;
  const rage = raging(e);
  const roll = Math.sin(e.walkPhase) * 0.05;
  const CHROME = tone('#cfd8e3');
  // his performance changes his silhouette: spinning, arms up for REPLY ALL, a stamp slammed down
  const script = e.script instanceof ChairmanScript ? e.script : null;
  const pose = dead ? 'idle' : script?.pose ?? 'idle';
  const armsUp = pose === 'reply' ? 1 : pose === 'pie' ? 0.55 : 0;
  const stamp = pose === 'stamp' ? (script!.stage === 'windup' ? -1 : script!.stage === 'go' ? 1 : 0) : 0;
  ctx.save();
  if (pose === 'spin' || pose === 'drift') {
    // spinning chair: squash the whole sprite across itself so his face flips past
    const speed = script!.spinRate;
    ctx.translate(x, 0);
    ctx.scale(Math.cos(time * speed), 1);
    ctx.translate(-x, 0);
  }
  drawMemos(ctx, e, x, b, time, false);
  // five-star base: back legs first, then front, casters spinning as he glides
  for (const front of [false, true]) {
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5 + 0.4 + roll;
      if ((Math.sin(a) > 0) !== front) continue;
      const wx = x + Math.cos(a) * (hw + 3);
      const wy = b - 4 + Math.sin(a) * 3;
      limb(ctx, x, b - 9, wx, wy, 3.4, CHROME);
      wheel(ctx, wx, wy + 1.5, 3.6, e.walkPhase * 2 + k, '#cfd8e3');
    }
  }
  // gas lift
  ctx.beginPath();
  ctx.rect(x - 3.2, b - 26, 6.4, 18);
  paint(ctx, lin(ctx, x - 4, 0, x + 4, 0, tone('#7d8796'), tone('#f2f6fb'), tone('#7d8796')), 2.4);
  // tufted high back with wings
  const top = b - 74 - hop * 0.4;
  blob(ctx, [
    [x - hw + 3, b - 24], [x - hw - 2, b - 46], [x - hw, b - 66], [x - hw + 9, top + 3], [x, top - 3],
    [x + hw - 9, top + 3], [x + hw, b - 66], [x + hw + 2, b - 46], [x + hw - 3, b - 24], [x, b - 21],
  ]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#16202f'), tone('#3f5776'), tone('#16202f')), 3);
  // diamond tufting: stitched lines and gold-headed buttons
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(x + i * 6.4 - 6, top + 10);
    ctx.lineTo(x + i * 6.4 + 12, top + 46);
    ctx.moveTo(x + i * 6.4 + 6, top + 10);
    ctx.lineTo(x + i * 6.4 - 12, top + 46);
  }
  ctx.stroke();
  for (const [bx, by] of [[-14, 14], [0, 8], [14, 14], [-14, 30], [0, 24], [14, 30], [-7, 40], [7, 40]] as const) {
    bolt(ctx, x + bx * 1.1, top + by, 1.7, tone('#e2b94c'));
  }
  gloss(ctx, x - hw * 0.55, top + 14, 3, 12, 0.2, 0.22);
  // armrests
  for (const side of [-1, 1]) {
    rrect(ctx, x + side * (hw - 1) - 4, b - 38, 8, 14, 3);
    paint(ctx, tone('#222c3b'), 2.4);
    gloss(ctx, x + side * (hw - 1) - 1, b - 36, 1.4, 4, 0, 0.3);
  }
  // seat cushion
  ctx.beginPath();
  ctx.ellipse(x, b - 22, hw - 2, 6.5, 0, 0, TAU);
  paint(ctx, lin(ctx, 0, b - 28, 0, b - 15, tone('#33465f'), tone('#16202f')), 2.6);
  // the suit: wide shoulders, white shirt, red tie, pocket square
  blob(ctx, [[x - 15, b - 24], [x - 18, b - 40], [x - 13, b - 52], [x - 5, b - 56], [x + 5, b - 56], [x + 13, b - 52], [x + 18, b - 40], [x + 15, b - 24]]);
  paint(ctx, lin(ctx, x - 18, 0, x + 18, 0, tone('#10151f'), tone('#33425a'), tone('#10151f')), 2.8);
  ctx.beginPath();
  ctx.moveTo(x - 5.5, b - 56);
  ctx.lineTo(x + 5.5, b - 56);
  ctx.lineTo(x, b - 38);
  ctx.closePath();
  paint(ctx, tone('#f4f1ea'), 1.8);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 5.5, b - 55);
  ctx.lineTo(x - 11, b - 38);
  ctx.moveTo(x + 5.5, b - 55);
  ctx.lineTo(x + 11, b - 38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 2.2, b - 53);
  ctx.lineTo(x + 2.2, b - 53);
  ctx.lineTo(x + 3.4, b - 40);
  ctx.lineTo(x, b - 34);
  ctx.lineTo(x - 3.4, b - 40);
  ctx.closePath();
  paint(ctx, lin(ctx, x - 3, 0, x + 3, 0, tone('#c0272b'), tone('#ff5a4e')), 1.6);
  ctx.fillStyle = tone('#ffe08a');
  ctx.fillRect(x + 8.5, b - 42, 4, 2);
  // head: slicked hair, furious brows, headset
  const hx = x + fx * 2;
  const hy = b - 66;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 10, 11, 0, 0, TAU);
  paint(ctx, rad(ctx, hx - 3, hy - 4, 1, 14, tone('#f0c79a'), tone('#c08a5a')), 2.6);
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy - 2);
  ctx.bezierCurveTo(hx - 12, hy - 15, hx + 8, hy - 18, hx + 11, hy - 4);
  ctx.bezierCurveTo(hx + 6, hy - 9, hx - 2, hy - 8, hx - 10, hy - 2);
  paint(ctx, tone('#15131c'), 2.2);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(hx + side * 10.5, hy + 1, 2.6, 0, TAU);
    paint(ctx, tone('#e0b088'), 1.8);
  }
  eyePair(ctx, hx, hy + 0.5, 4.3, 3, fx, fy, { angry: rage ? 1 : 0.8, iris: rage ? '#ff2e2e' : '#2f6aa8', lid: blink(time, e.seed), lidColor: tone('#d9a678'), dead });
  ctx.beginPath();
  ctx.moveTo(hx, hy + 2);
  ctx.lineTo(hx + 1.6, hy + 6);
  ctx.lineTo(hx - 0.6, hy + 6.4);
  ctx.strokeStyle = 'rgba(80, 40, 20, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  maw(ctx, hx + fx, hy + 7.6, 4.2, 1.2 + windup * 3.4, 6, '#ffffff', '#b5384e');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(hx, hy - 1, 11.6, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(hx - 11.6, hy + 2, 3.2, 4.4, 0, 0, TAU);
  paint(ctx, tone('#2b3548'), 2);
  limb(ctx, hx - 11.5, hy + 5, hx - 4, hy + 12, 1.2, tone('#2b3548'));
  ctx.fillStyle = tone('#ff5a4e');
  ctx.beginPath();
  ctx.arc(hx - 4, hy + 12.4, 1.8, 0, TAU);
  ctx.fill();
  // stapler arm and the accusing finger (up with the windup)
  const lift = armsUp * 34;
  limb(ctx, x - 16, b - 50, x - hw - 8, b - 34 - lift, 6.4, tone('#222c3b'));
  ctx.save();
  ctx.translate(x - hw - 14, b - 36 - lift);
  ctx.rotate(-0.2);
  rrect(ctx, -11, 2, 22, 7, 2);
  paint(ctx, lin(ctx, 0, 2, 0, 9, tone('#ff5a4e'), tone('#a01e22')), 2.2);
  rrect(ctx, -11, -3, 22, 6, 2);
  paint(ctx, lin(ctx, 0, -3, 0, 3, tone('#f2f6fb'), tone('#8a94a6')), 2.2);
  ctx.restore();
  fist(ctx, x - hw - 8, b - 33 - lift, 4.4, tone('#e8b88a'), -1);
  const px = x + hw + 9 + fx * 5 + (pose === 'pie' ? 10 : 0);
  const py = b - 50 - windup * 14 - lift * (pose === 'pie' ? 0.2 : 1) - (stamp < 0 ? 26 : 0) + (stamp > 0 ? 18 : 0);
  limb(ctx, x + 16, b - 50, px, py, 6.4, tone('#222c3b'));
  fist(ctx, px, py, 4.4, tone('#e8b88a'));
  limb(ctx, px + 2, py - 3, px + 7 + fx * 2, py - 9, 2.4, tone('#e8b88a'));
  if (stamp !== 0) {
    // the big red rubber stamp in his fist
    ctx.save();
    ctx.translate(px + 6, py - 8);
    ctx.fillStyle = '#c0143c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -6, 18, 12);
    ctx.strokeRect(-9, -6, 18, 12);
    ctx.fillStyle = '#7a0c26';
    ctx.fillRect(-4, -14, 8, 9);
    ctx.restore();
  }
  drawFury(ctx, e, x, b, hx, hy, time);
  drawOutOfOffice(ctx, e, hx, hy, time);
  drawMemos(ctx, e, x, b, time, true);
  ctx.restore();
};

/** The Flusher: a porcelain throne with a raised lid for a face and the bowl for a mouth. */
export const flusher: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const script = e.script instanceof FlusherScript ? e.script : null;
  const pose = e.defeated ? 'idle' : script?.pose ?? 'idle';
  const suck = pose === 'vortex' || (e.sucking && !e.defeated);
  const lidShut = !!script && script.lidClosed && !e.defeated;
  const rage = raging(e);
  if (pose === 'surf') {
    // riding the surge: leaning into it
    ctx.save();
    ctx.translate(x, b);
    ctx.rotate(0.12);
    ctx.translate(-x, -b);
  }
  const PORC = (a: number): CanvasGradient => lin(ctx, x - hw, 0, x + hw, 0, tone('#8aa3b8'), tone('#f6fbff'), tone('#b4c9d9'));
  // floor flange and bolts
  ctx.beginPath();
  ctx.ellipse(x, b - 2, 17, 4.6, 0, 0, TAU);
  paint(ctx, tone('#8aa3b8'), 2.4);
  bolt(ctx, x - 11, b - 3, 1.6);
  bolt(ctx, x + 11, b - 3, 1.6);
  // tank behind, with a ridge lid, a chrome handle and a scrap of loo roll
  rrect(ctx, x - hw + 1, b - 84, hw * 2 - 2, 34, 6);
  paint(ctx, PORC(0), 3);
  rrect(ctx, x - hw - 2, b - 88, hw * 2 + 4, 8, 4);
  paint(ctx, lin(ctx, 0, b - 88, 0, b - 80, tone('#ffffff'), tone('#a9c0d2')), 2.8);
  gloss(ctx, x - hw * 0.5, b - 70, 2.6, 10, 0.1, 0.5);
  const jig = suck ? Math.sin(time * 30) * 1.6 : 0;
  limb(ctx, x + hw - 2, b - 76 + jig, x + hw + 7, b - 76 + jig, 2.8, tone('#dfe6ef'));
  bolt(ctx, x + hw - 2, b - 76 + jig, 2.4, tone('#dfe6ef'));
  ctx.beginPath();
  ctx.arc(x - hw + 7, b - 92, 5.4, 0, TAU);
  paint(ctx, tone('#fffdf2'), 2.4);
  ctx.beginPath();
  ctx.arc(x - hw + 7, b - 92, 1.8, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = tone('#fffdf2');
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, b - 88);
  ctx.quadraticCurveTo(x - hw - 6, b - 82 + Math.sin(time * 3) * 2, x - hw - 4, b - 70);
  ctx.stroke();
  // the raised seat lid is the face
  blob(ctx, [[x - hw + 4, b - 36], [x - hw + 1, b - 52], [x - hw + 6, b - 66], [x, b - 70], [x + hw - 6, b - 66], [x + hw - 1, b - 52], [x + hw - 4, b - 36]]);
  paint(ctx, lin(ctx, x - hw, b - 70, x + hw, b - 36, tone('#ffffff'), tone('#c4d6e4')), 3);
  blob(ctx, [[x - hw + 9, b - 42], [x - hw + 7, b - 52], [x - hw + 11, b - 62], [x, b - 65], [x + hw - 11, b - 62], [x + hw - 7, b - 52], [x + hw - 9, b - 42]]);
  ctx.strokeStyle = 'rgba(70, 96, 120, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const ey = b - 55;
  eyePair(ctx, x + fx * 2, ey, 8, 4.4, fx, fy, { angry: rage ? 1 : 0.85, iris: rage ? '#ff2e2e' : '#1d9bb5', lid: blink(time, e.seed), lidColor: tone('#d3e2ee'), dead: e.defeated });
  brow(ctx, x - 14, ey - 9, x - 4, ey - 6.4, 2.6);
  brow(ctx, x + 14, ey - 9, x + 4, ey - 6.4, 2.6);
  // bowl: the mouth. water swirls, fangs line the rim
  blob(ctx, [[x - hw - 2, b - 30], [x - hw + 4, b - 14], [x - 12, b - 6], [x + 12, b - 6], [x + hw - 4, b - 14], [x + hw + 2, b - 30]]);
  paint(ctx, PORC(0), 3);
  ctx.beginPath();
  ctx.ellipse(x, b - 31, hw + 3, 12, 0, 0, TAU);
  paint(ctx, lin(ctx, 0, b - 43, 0, b - 19, tone('#ffffff'), tone('#b4c9d9')), 3);
  ctx.beginPath();
  ctx.ellipse(x, b - 30, hw - 6, 8, 0, 0, TAU);
  paint(ctx, rad(ctx, x, b - 30, 1, hw - 4, '#0a7f9c', '#35d6ee', '#7af0ff'), 2.4);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6;
  const swirl = suck ? time * 9 : time * 2;
  for (const [rr, off] of [[hw - 10, 0], [10, 2.2], [5, 4.4]] as const) {
    ctx.beginPath();
    ctx.ellipse(x, b - 30, rr, rr * 0.5, 0, swirl + off, swirl + off + 3.8);
    ctx.stroke();
  }
  ctx.fillStyle = tone('#ffffff');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  const open = windup * 3 + (suck ? 3 : 0);
  for (let i = 0; i < 7; i++) {
    const a = 0.2 + (i / 6) * (Math.PI - 0.4);
    const tx = x + Math.cos(a) * (hw - 4);
    const ty = b - 30 + Math.sin(a) * 8;
    ctx.beginPath();
    ctx.moveTo(tx - 2.4, ty);
    ctx.lineTo(tx, ty - 4.5 - open);
    ctx.lineTo(tx + 2.4, ty);
    ctx.fill();
    ctx.stroke();
  }
  gloss(ctx, x - hw * 0.6, b - 15, 3, 7, 0.4, 0.45);
  if (lidShut) {
    // the seat lid is down over the bowl: he shrugs hits off until something goes down it
    ctx.beginPath();
    ctx.ellipse(x, b - 31, hw + 2, 11.5, 0, 0, TAU);
    paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#c4d6e4'), tone('#ffffff'), tone('#c4d6e4')), 3);
    ctx.beginPath();
    ctx.ellipse(x, b - 31, hw - 8, 6.5, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(70, 96, 120, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (script) {
    // lid up: the bowl glows
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(80, 220, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, b - 30, hw - 4, 8, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // plunger arm and brush arm
  limb(ctx, x - hw + 2, b - 28, x - hw - 11, b - 20 + Math.sin(e.walkPhase) * 2, 4.6, tone('#b4c9d9'));
  limb(ctx, x - hw - 11, b - 20, x - hw - 18, b - 40, 2.4, tone('#c79a5a'));
  ctx.beginPath();
  ctx.ellipse(x - hw - 19, b - 43, 4.4, 5.6, 0.2, 0, TAU);
  paint(ctx, tone('#6a4a2a'), 2.2);
  const lift = windup * 10;
  limb(ctx, x + hw - 2, b - 28, x + hw + 10, b - 26 - lift, 4.6, tone('#b4c9d9'));
  limb(ctx, x + hw + 10, b - 26 - lift, x + hw + 15, b - 48 - lift, 2.6, tone('#c79a5a'));
  ctx.beginPath();
  ctx.moveTo(x + hw + 8, b - 50 - lift);
  ctx.quadraticCurveTo(x + hw + 15, b - 62 - lift, x + hw + 22, b - 50 - lift);
  ctx.closePath();
  paint(ctx, tone('#e23d3a'), 2.4);
  gloss(ctx, x + hw + 13, b - 54 - lift, 2.4, 1.4, -0.3, 0.5);
  if (pose === 'surf') ctx.restore();
};

/** The Sofa Kraken: a chesterfield that grew opinions. Cushion-tipped tentacles, stalk eyes, a seam for a mouth. */
export const kraken: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const lash = e.lashProgress;
  const fa = e.facing;
  const rage = raging(e);
  const BURG = (): CanvasGradient => lin(ctx, 0, b - 56, 0, b - 6, tone('#a04770'), tone('#5c2644'), tone('#3b1730'));
  // tentacles rear up behind the sofa and swing towards the facing when lashing
  for (let i = -2; i <= 2; i++) {
    const rest = -Math.PI / 2 + (i / 2) * 1.05;
    const wave = Math.sin(time * 3 + i * 1.7 + e.seed) * 0.24 * (1 - lash * 0.6);
    const dir = rest + wave + angleDiff(rest, fa) * lash * 0.55;
    const len = 58 + Math.sin(time * 3 + i * 1.7 + e.seed) * 6 + lash * 24;
    const sx = x + Math.cos(rest) * hw * 0.55;
    const sy = b - 34;
    const mx = x + Math.cos(dir + wave * 0.8) * len * 0.5;
    const my = sy + Math.sin(dir + wave * 0.8) * len * 0.5;
    const tx = x + Math.cos(dir) * len;
    const ty = sy + Math.sin(dir) * len;
    tentacle(ctx, sx, sy, mx, my, tx, ty, 11, 4.5, lin(ctx, sx, sy, tx, ty, tone('#8d3a63'), tone('#c86a92')), 'rgba(255, 214, 230, 0.55)', time);
    // a throw pillow for a hand
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(dir + Math.PI / 2);
    blob(ctx, [[-7, -6], [0, -7.4], [7, -6], [8, 0], [7, 6], [0, 7.4], [-7, 6], [-8, 0]]);
    paint(ctx, lin(ctx, -8, -8, 8, 8, tone('#ffd877'), tone('#d99a2b')), 2.4);
    bolt(ctx, 0, 0, 1.6, tone('#7a4b12'));
    ctx.strokeStyle = tone('#7a4b12');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -4.5);
    ctx.lineTo(5, 4.5);
    ctx.moveTo(5, -4.5);
    ctx.lineTo(-5, 4.5);
    ctx.stroke();
    ctx.restore();
  }
  // turned wooden feet
  for (const sx of [-hw + 4, hw - 4]) {
    ctx.beginPath();
    ctx.moveTo(x + sx - 3, b - 9);
    ctx.lineTo(x + sx + 3, b - 9);
    ctx.lineTo(x + sx + 2, b - 2);
    ctx.lineTo(x + sx - 2, b - 2);
    ctx.closePath();
    paint(ctx, tone('#6b4423'), 2.2);
  }
  // back: tall, tufted, with a scalloped top edge
  blob(ctx, [[x - hw + 6, b - 20], [x - hw + 4, b - 44], [x - hw * 0.6, b - 52], [x - hw * 0.25, b - 49], [x, b - 55], [x + hw * 0.25, b - 49], [x + hw * 0.6, b - 52], [x + hw - 4, b - 44], [x + hw - 6, b - 20]]);
  paint(ctx, BURG(), 3);
  ctx.strokeStyle = 'rgba(255, 190, 215, 0.2)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(x + i * 7 - 6, b - 48);
    ctx.lineTo(x + i * 7 + 8, b - 24);
    ctx.moveTo(x + i * 7 + 6, b - 48);
    ctx.lineTo(x + i * 7 - 8, b - 24);
  }
  ctx.stroke();
  for (const [bx, by] of [[-14, -43], [0, -46], [14, -43], [-7, -34], [7, -34], [-14, -26], [0, -27], [14, -26]] as const) bolt(ctx, x + bx, b + by, 1.8, tone('#3b1730'));
  // three seat cushions
  for (let i = -1; i <= 1; i++) {
    const cx = x + i * (hw * 0.62);
    rrect(ctx, cx - hw * 0.31, b - 25, hw * 0.62, 17, 5);
    paint(ctx, lin(ctx, 0, b - 25, 0, b - 8, tone('#b2527c'), tone('#6a2c4b')), 2.6);
    ctx.strokeStyle = 'rgba(255, 220, 235, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.26, b - 22);
    ctx.lineTo(cx + hw * 0.26, b - 22);
    ctx.stroke();
  }
  // rolled arms with spiral ends and brass tacks
  for (const side of [-1, 1] as const) {
    const ax = x + side * (hw - 1);
    rrect(ctx, ax - 7, b - 38, 14, 32, 7);
    paint(ctx, lin(ctx, ax - 7, 0, ax + 7, 0, tone('#8d3a63'), tone('#d27aa0'), tone('#6a2c4b')), 3);
    ctx.beginPath();
    ctx.ellipse(ax, b - 36, 7, 4, 0, 0, TAU);
    paint(ctx, tone('#cc6f98'), 2.4);
    ctx.strokeStyle = tone('#7d2f55');
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(ax, b - 36, 2.4, 0, TAU * 0.85);
    ctx.stroke();
    for (let t = 0; t < 4; t++) bolt(ctx, ax, b - 28 + t * 5.5, 1.1, tone('#e2b94c'));
  }
  // a zigzag stitched mouth along the cushion gap, and stalk eyes popping out of the back
  maw(ctx, x + fx * 3, b - 19, hw - 10, 2 + Math.max(windup, lash) * 7, 7, '#fff3df', '#c95a86');
  if (!e.defeated) {
    for (const side of [-1, 1] as const) {
      const ex = x + side * 10;
      const sway = Math.sin(time * 4 + side) * 1.4;
      limb(ctx, ex, b - 48, ex + side * 3 + sway, b - 62, 3, tone('#a04770'));
      eye(ctx, ex + side * 3 + sway, b - 66, 5.4, fx, fy, side, { angry: rage ? 1 : 0.55, iris: rage ? '#ff2e2e' : '#ffb347', lid: blink(time, e.seed + side), lidColor: tone('#8d3a63') });
    }
  }
};

/** Fridgezilla: a retro fridge-freezer, door torn open into a frost-fanged mouth. */
export const fridgezilla: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const top = b - 70;
  const bw = hw - 3;
  const rage = raging(e);
  const script = e.script instanceof FridgeScript ? e.script : null;
  const pose = e.defeated ? 'idle' : script?.pose ?? 'idle';
  if (pose === 'skid') {
    ctx.save();
    ctx.translate(x, b);
    ctx.rotate(-0.1);
    ctx.translate(-x, -b);
  }
  // chrome feet
  for (const sx of [-bw + 5, bw - 5]) {
    rrect(ctx, x + sx - 5, b - 5, 10, 5, 2);
    paint(ctx, lin(ctx, 0, b - 5, 0, b, tone('#f2f6fb'), tone('#6d7689')), 2);
  }
  // body: rounded retro shell
  blob(ctx, [[x - bw, b - 5], [x - bw - 1, top + 12], [x - bw + 6, top + 1], [x, top - 2], [x + bw - 6, top + 1], [x + bw + 1, top + 12], [x + bw, b - 5]]);
  paint(ctx, lin(ctx, x - bw, 0, x + bw, 0, tone('#7fb5cf'), tone('#eef9ff'), tone('#9cc6dc')), 3.2);
  // seam between freezer and fridge, chrome trim and handles
  ctx.fillStyle = tone('#d6e4ee');
  ctx.fillRect(x - bw + 1, top + 25, bw * 2 - 2, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x - bw + 1, top + 25, bw * 2 - 2, 3);
  rrect(ctx, x + bw - 9, top + 6, 4, 16, 2);
  paint(ctx, lin(ctx, x + bw - 9, 0, x + bw - 5, 0, tone('#ffffff'), tone('#7d8796')), 1.8);
  // freezer face: icy brow and furious eyes
  const ey = top + 14;
  eyePair(ctx, x + fx * 2, ey, 8, 4.4, fx, fy, { angry: rage ? 1 : 0.9, iris: rage ? '#ff2e2e' : '#3aa7e0', lid: blink(time, e.seed), lidColor: tone('#c8e4f2'), dead: e.defeated });
  ctx.fillStyle = tone('#f4fbff');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(x + side * 14, ey - 9);
    ctx.lineTo(x + side * 7, ey - 6.4);
    ctx.lineTo(x + side * 9, ey - 3);
    ctx.lineTo(x + side * 14, ey - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // crown of ice crystals
  for (const [ox, h, w] of [[-14, 11, 5], [-6, 17, 6], [3, 21, 6.5], [11, 15, 5.4], [17, 9, 4]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ox - w, top + 3);
    ctx.lineTo(x + ox - 1, top - h);
    ctx.lineTo(x + ox + w, top + 3);
    ctx.closePath();
    paint(ctx, lin(ctx, x + ox - w, 0, x + ox + w, 0, tone('#cdeeff'), tone('#ffffff'), tone('#8fd0ee')), 2.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + ox - 1, top - h + 3);
    ctx.lineTo(x + ox - 2.4, top + 1);
    ctx.stroke();
  }
  // lower door torn open: glowing cavity, shelves of jar-teeth, icicle fangs, spilling cold light
  const gape = 2 + windup * 6 + (pose === 'open' ? 7 : 0);
  rrect(ctx, x - bw + 5, top + 33, bw * 2 - 10, 30 + gape, 4);
  paint(ctx, rad(ctx, x, top + 50, 2, bw, '#f4ffff', '#7fe0f4', '#1b6f8c'), 3);
  ctx.save();
  rrect(ctx, x - bw + 5, top + 33, bw * 2 - 10, 30 + gape, 4);
  ctx.clip();
  ctx.fillStyle = 'rgba(26, 14, 52, 0.45)';
  ctx.fillRect(x - bw + 5, top + 33, bw * 2 - 10, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x - bw + 5, top + 48, bw * 2 - 10, 2);
  for (const [jx, jy, jc] of [[-13, 38, '#e5383b'], [-4, 40, '#ffd23f'], [6, 38, '#6fe08a'], [14, 40, '#ff9ec4']] as const) {
    rrect(ctx, x + jx - 3.2, top + jy, 6.4, 9, 2);
    paint(ctx, tone(jc), 1.6);
  }
  ctx.beginPath();
  ctx.ellipse(x - 2, top + 57 + gape * 0.5, 9, 3.4, 0, 0, TAU);
  paint(ctx, tone('#9fd4e8'), 1.8);
  ctx.beginPath();
  ctx.moveTo(x + 6, top + 57 + gape * 0.5);
  ctx.lineTo(x + 11, top + 54 + gape * 0.5);
  ctx.lineTo(x + 11, top + 60 + gape * 0.5);
  ctx.closePath();
  paint(ctx, tone('#9fd4e8'), 1.4);
  ctx.restore();
  ctx.fillStyle = tone('#ffffff');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const ix = x - bw + 9 + i * ((bw * 2 - 18) / 6);
    const l = 6 + (i % 2) * 4;
    ctx.beginPath();
    ctx.moveTo(ix - 2.2, top + 33);
    ctx.lineTo(ix, top + 33 + l);
    ctx.lineTo(ix + 2.2, top + 33);
    ctx.fill();
    ctx.stroke();
    const l2 = 4 + ((i + 1) % 2) * 3;
    ctx.beginPath();
    ctx.moveTo(ix - 2, top + 63 + gape);
    ctx.lineTo(ix, top + 63 + gape - l2);
    ctx.lineTo(ix + 2, top + 63 + gape);
    ctx.fill();
    ctx.stroke();
  }
  // magnets on the freezer, a dent, frost creeping in from the corners
  ctx.fillStyle = tone('#e5383b');
  ctx.fillRect(x - bw + 4, top + 5, 5, 6);
  ctx.fillStyle = tone('#ffd23f');
  ctx.beginPath();
  ctx.arc(x - bw + 8, top + 18, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const [fx0, fy0, s] of [[-bw + 2, 4, 5], [bw - 2, 6, 4]] as const) {
    ctx.beginPath();
    ctx.arc(x + fx0, top + fy0, s, 0, TAU);
    ctx.fill();
  }
  gloss(ctx, x - bw * 0.55, top + 16, 2.2, 10, 0.1, 0.5);
  // cold mist pouring out and frost-gloved fists
  puffs(ctx, x - 6, b - 4, time, e.seed, '210, 240, 255', 4, 20);
  fist(ctx, x - bw - 8, b - 32 - windup * 8, 5.4, tone('#9fd4e8'), -1);
  limb(ctx, x - bw + 1, top + 30, x - bw - 8, b - 32 - windup * 8, 5.4, tone('#7fb5cf'));
  limb(ctx, x + bw - 1, top + 30, x + bw + 8, b - 30 + Math.sin(e.walkPhase) * 2, 5.4, tone('#7fb5cf'));
  fist(ctx, x + bw + 8, b - 30 + Math.sin(e.walkPhase) * 2, 5.4, tone('#9fd4e8'));
  if (script && script.plates > 0 && script.thaw <= 0 && !e.defeated) {
    // frost plates over his front: each one is two good hits
    const n = script.plates;
    for (let i = 0; i < n; i++) {
      const px = x - bw + 8 + (i + 0.5) * ((bw * 2 - 16) / n);
      const py = top + 24 + (i % 2) * 6;
      ctx.fillStyle = 'rgba(210, 242, 255, 0.78)';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 11, py + 22);
      ctx.lineTo(px - 8, py - 6);
      ctx.lineTo(px, py - 12);
      ctx.lineTo(px + 8, py - 6);
      ctx.lineTo(px + 11, py + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,190,225,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 6);
      ctx.lineTo(px + 1, py + 8);
      ctx.stroke();
    }
  } else if (script && script.thaw > 0 && !e.defeated) {
    // thawed: dripping
    for (let k = 0; k < 4; k++) {
      const t = (time * 1.3 + k * 0.27) % 1;
      ctx.fillStyle = `rgba(150, 215, 255, ${0.9 * (1 - t)})`;
      ctx.beginPath();
      ctx.ellipse(x - bw + 12 + k * ((bw * 2 - 24) / 3), top + 30 + t * 40, 2, 3.2, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (pose === 'skid') ctx.restore();
};

/** The Piano Spider: a grand with eight brass-shod legs, a keyboard grin and an open lid. */
export const piano: BossBody = (ctx, e, x, y, time, p) => {
  const pianoScript = e.script instanceof PianoScript ? e.script : null;
  const dropOffset = pianoScript && !e.defeated ? pianoScript.dropHeight : 0;
  const hopPose = pianoScript && !e.defeated ? pianoScript.pose : 'idle';
  ctx.save();
  if (dropOffset > 0) ctx.translate(0, -dropOffset);
  if (hopPose === 'crouch') {
    ctx.translate(x, y);
    ctx.scale(1.06, 0.9);
    ctx.translate(-x, -y);
  }
  if (hopPose === 'play') ctx.translate(0, Math.sin(time * 14) * 1.2);
  const { hw, hd, tone, fx, fy, windup, hop } = p;
  const b = y + hd + 1;
  const LAC = tone('#17141f');
  const BRASS = tone('#d9ad4f');
  const rage = raging(e);
  // eight jointed legs: hip on the rim, knee up and out, a brass foot planted
  for (const back of [true, false]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.4;
      if ((Math.sin(a) < 0) !== back) continue;
      const step = Math.sin(e.walkPhase * 2 + k * (Math.PI / 4));
      const hx = x + Math.cos(a) * hw * 0.78;
      const hy = b - 15 + Math.sin(a) * 5;
      const kx = x + Math.cos(a) * (hw + 12);
      const ky = b - 20 + Math.sin(a) * 3 - Math.max(0, step) * 4;
      const fxx = x + Math.cos(a) * (hw + 20);
      const fyy = b - 2 + Math.sin(a) * 2;
      limb(ctx, hx, hy, kx, ky, 4.4, LAC, 'rgba(255,255,255,0.4)');
      limb(ctx, kx, ky, fxx, fyy, 3.4, LAC, 'rgba(255,255,255,0.4)');
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(fxx, fyy, 2.8, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
  // curved lacquered case
  blob(ctx, [[x - hw, b - 20], [x - hw - 1, b - 36], [x - hw * 0.4, b - 46], [x + hw * 0.5, b - 44], [x + hw + 5, b - 32], [x + hw + 2, b - 20], [x + hw * 0.3, b - 13], [x - hw * 0.6, b - 14]]);
  paint(ctx, lin(ctx, x - hw, b - 46, x + hw, b - 12, tone('#3d3a4d'), LAC, tone('#0b0a10')), 3.2);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - hw + 3, b - 18);
  ctx.bezierCurveTo(x - hw + 2, b - 36, x - hw * 0.4, b - 43, x + hw * 0.5, b - 41);
  ctx.stroke();
  gloss(ctx, x - hw * 0.45, b - 38, 9, 2.4, -0.25, 0.5);
  // the open lid, propped on a stick, with the harp showing
  const lid = 12 + hop * 0.4 + Math.sin(time * 2) * 0.6 + windup * 5;
  ctx.beginPath();
  ctx.moveTo(x - hw + 4, b - 44);
  ctx.quadraticCurveTo(x + 2, b - 40 - lid * 0.2, x + hw + 4, b - 40);
  ctx.lineTo(x + hw + 8, b - 56 - lid);
  ctx.quadraticCurveTo(x + 2, b - 60 - lid, x - hw + 2, b - 62 - lid);
  ctx.closePath();
  paint(ctx, lin(ctx, x - hw, b - 66, x + hw, b - 40, tone('#4b4760'), LAC, tone('#0b0a10')), 3);
  ctx.beginPath();
  ctx.moveTo(x - hw + 7, b - 43);
  ctx.bezierCurveTo(x - hw + 8, b - 60 - lid * 0.7, x + hw - 4, b - 56 - lid * 0.7, x + hw + 1, b - 41);
  ctx.closePath();
  ctx.fillStyle = tone('#7a4a20');
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 233, 160, 0.7)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const sx = x - hw + 10 + i * 4.8;
    ctx.moveTo(sx, b - 43);
    ctx.lineTo(sx + 1, b - 52 - lid * 0.55);
  }
  ctx.stroke();
  limb(ctx, x + 6, b - 42, x + 12, b - 50 - lid * 0.8, 1.8, BRASS);
  // fallboard with the eyes, and the keyboard grin
  rrect(ctx, x - hw + 3, b - 36, hw * 2 - 6, 12, 3);
  paint(ctx, lin(ctx, 0, b - 36, 0, b - 24, tone('#2a2736'), LAC), 2.4);
  eyePair(ctx, x + fx * 2, b - 30.4, 8.6, 4.6, fx, fy, { angry: rage ? 1 : 0.7, iris: rage ? '#ff2e2e' : '#d9ad4f', lid: blink(time, e.seed), lidColor: LAC, dead: e.defeated });
  rrect(ctx, x - hw + 2, b - 24, hw * 2 - 4, 10 + windup * 3, 2);
  paint(ctx, lin(ctx, 0, b - 24, 0, b - 14, tone('#ffffff'), tone('#d8d2c4')), 2.4);
  ctx.strokeStyle = 'rgba(26, 14, 52, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 9; i++) {
    ctx.moveTo(x - hw + 2 + i * ((hw * 2 - 4) / 9), b - 24);
    ctx.lineTo(x - hw + 2 + i * ((hw * 2 - 4) / 9), b - 14 + windup * 3);
  }
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const i of [1, 2, 4, 5, 6, 8]) ctx.fillRect(x - hw + 2 + i * ((hw * 2 - 4) / 9) - 1.6, b - 24, 3.2, 6);
  // pedal lyre
  limb(ctx, x - 5, b - 14, x - 5, b - 4, 1.8, BRASS);
  limb(ctx, x + 5, b - 14, x + 5, b - 4, 1.8, BRASS);
  // furious eighth notes bouncing off the lid
  if (!e.defeated) {
    for (let i = 0; i < 2; i++) {
      const bounce = Math.abs(Math.sin(time * 5 + i * 1.6)) * 4;
      const nx = x + hw - 6 - i * 16;
      const ny = b - 64 - lid - i * 6 - bounce;
      ctx.strokeStyle = tone(i ? '#ffd23f' : '#ff5a4e');
      ctx.fillStyle = tone(i ? '#ffd23f' : '#ff5a4e');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(nx, ny, 3.2, 2.4, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(nx + 2.8, ny);
      ctx.lineTo(nx + 2.8, ny - 10);
      ctx.lineTo(nx + 6.5, ny - 7);
      ctx.stroke();
    }
  }
  ctx.restore();
};

void shadeBand;
void darken;
void lighten;
