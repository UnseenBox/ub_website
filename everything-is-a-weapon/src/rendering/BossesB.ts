import { INK } from '../core/constants';
import { TAU } from '../core/math';
import {
  blob, bolt, blink, brow, eye, eyePair, fist, gloss, limb, lin, maw, paint, puffs, rad, raging, rrect, tentacle, wheel,
  type BossBody,
} from './BossKit';

function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** The Mower Maniac: a ride-on with a grille full of teeth, headlight eyes and a blade out front. */
export const mower: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const charging = e.ai === 'lunge';
  const spin = e.walkPhase * (charging ? 4 : 2);
  const rage = raging(e);
  // grass bag and the rear wheels go behind the body
  blob(ctx, [[x - hw - 4, b - 32], [x - hw - 12, b - 40], [x - hw - 6, b - 50], [x - hw + 4, b - 46], [x - hw + 6, b - 34]]);
  paint(ctx, lin(ctx, x - hw - 12, 0, x - hw + 6, 0, tone('#3f8a4e'), tone('#245a30')), 2.6);
  ctx.strokeStyle = tone('#8fdc8f');
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(x - hw - 9 + i * 3.4, b - 46);
    ctx.lineTo(x - hw - 8 + i * 3.4 + Math.sin(time * 5 + i) * 1.2, b - 53);
  }
  ctx.stroke();
  for (const side of [-1, 1]) wheel(ctx, x + side * (hw - 2), b - 10, 10, spin * side, '#d6dde8');
  // exhaust stacks puffing
  for (const side of [-1, 1]) {
    limb(ctx, x + side * (hw - 10), b - 34, x + side * (hw - 10), b - 56, 3.4, tone('#9aa4b4'));
    ctx.fillStyle = tone('#2a2330');
    ctx.fillRect(x + side * (hw - 10) - 2.6, b - 58, 5.2, 3);
    if (!e.defeated) puffs(ctx, x + side * (hw - 10), b - 58, time, e.seed + side, '80, 80, 92', 3, 22);
  }
  // body: wide red tub with a raised hood
  blob(ctx, [[x - hw + 2, b - 12], [x - hw - 1, b - 28], [x - hw * 0.55, b - 40], [x - hw * 0.25, b - 50], [x + hw * 0.25, b - 50], [x + hw * 0.55, b - 40], [x + hw + 1, b - 28], [x + hw - 2, b - 12]]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#8f1d16'), tone('#ff5a45'), tone('#a5241a')), 3.2);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(x - 3.4, b - 50, 2.4, 36);
  ctx.fillRect(x + 1, b - 50, 2.4, 36);
  gloss(ctx, x - hw * 0.5, b - 38, 3, 9, 0.5, 0.5);
  // seat and a steering wheel behind the hood
  rrect(ctx, x - 9, b - 60, 18, 12, 4);
  paint(ctx, tone('#2a2330'), 2.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, b - 52, 8, 3.4, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = tone('#d6dde8');
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // headlight eyes and a grille full of teeth
  const ey = b - 36;
  for (const side of [-1, 1] as const) {
    const ex = x + side * 11 + fx * 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 7.4, 0, TAU);
    paint(ctx, tone('#c9d2de'), 2.6);
    eye(ctx, ex, ey, 5.2, fx, fy, side, { angry: rage ? 1 : 0.75, iris: rage ? '#ff2e2e' : '#ffd23f', lid: blink(time, e.seed + side), lidColor: tone('#d8281c'), dead: e.defeated });
  }
  rrect(ctx, x - hw + 6, b - 25, hw * 2 - 12, 11 + windup * 4, 3);
  paint(ctx, tone('#17132a'), 2.6);
  ctx.save();
  rrect(ctx, x - hw + 6, b - 25, hw * 2 - 12, 11 + windup * 4, 3);
  ctx.clip();
  ctx.fillStyle = tone('#e8eef5');
  for (let i = 0; i < 8; i++) {
    const gx = x - hw + 9 + i * ((hw * 2 - 18) / 7);
    ctx.beginPath();
    ctx.moveTo(gx - 2.6, b - 25);
    ctx.lineTo(gx, b - 25 + 6);
    ctx.lineTo(gx + 2.6, b - 25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(gx - 2.4, b - 14 + windup * 4);
    ctx.lineTo(gx, b - 14 + windup * 4 - 5);
    ctx.lineTo(gx + 2.4, b - 14 + windup * 4);
    ctx.fill();
  }
  ctx.restore();
  // the blade peeking from the front deck
  ctx.beginPath();
  ctx.ellipse(x, b - 6, hw * 0.78, 4.6, 0, 0, TAU);
  paint(ctx, tone('#4a4458'), 2.4);
  ctx.strokeStyle = charging ? 'rgba(255,255,255,0.8)' : tone('#e8eef5');
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = spin * 2 + (i * Math.PI) / 2;
    ctx.moveTo(x + Math.cos(a) * hw * 0.74, b - 6 + Math.sin(a) * 3.8);
    ctx.lineTo(x - Math.cos(a) * hw * 0.74, b - 6 - Math.sin(a) * 3.8);
  }
  ctx.stroke();
  for (const side of [-1, 1]) wheel(ctx, x + side * (hw * 0.6), b - 5, 5.6, spin * 1.3 * side);
  if (charging && !e.defeated) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(x - fx * (hw + 6), b - 14 - i * 8);
      ctx.lineTo(x - fx * (hw + 20 + i * 4), b - 14 - i * 8);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
};

/** MOM: curlers, glasses on a chain, quilted housecoat and the slipper. It rises with every telegraph. */
export const mom: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const anger = e.phaseIndex;
  const rage = raging(e);
  const yell = e.sucking ? 8 : 3 + windup * 8 + anger * 1.5;
  const raise = 0.5 + windup * 0.9 + e.hurlProgress * 0.9 + (e.ai === 'slam' ? 0.7 : 0);
  // furry slippers
  for (const side of [-1, 1] as const) {
    const tap = side === 1 ? Math.abs(Math.sin(e.walkPhase * 2)) * 3 : 0;
    ctx.beginPath();
    ctx.ellipse(x + side * 9, b - 3 - tap, 8.4, 5, 0, 0, TAU);
    paint(ctx, rad(ctx, x + side * 9 - 2, b - 6 - tap, 1, 10, tone('#ffd0e2'), tone('#e5799f')), 2.4);
    for (let t = 0; t < 4; t++) {
      ctx.beginPath();
      ctx.arc(x + side * 9 - 5 + t * 3.4, b - 7 - tap, 1.9, 0, TAU);
      ctx.fillStyle = tone('#fff0f6');
      ctx.fill();
    }
  }
  limb(ctx, x - 8, b - 12, x - 9, b - 5, 4, tone('#f1c9a4'));
  limb(ctx, x + 8, b - 12, x + 9, b - 5, 4, tone('#f1c9a4'));
  // quilted housecoat: A-line, floral, with a belt and a fluffy collar
  blob(ctx, [[x - 12, b - 52], [x - 20, b - 32], [x - hw - 3, b - 10], [x, b - 6], [x + hw + 3, b - 10], [x + 20, b - 32], [x + 12, b - 52], [x, b - 56]]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#7a2f58'), tone('#c25a8c'), tone('#6a2548')), 3);
  ctx.strokeStyle = 'rgba(255, 220, 235, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(x + i * 6, b - 50);
    ctx.lineTo(x + i * 8.5, b - 8);
  }
  for (let j = 0; j < 5; j++) {
    ctx.moveTo(x - 24, b - 44 + j * 8);
    ctx.lineTo(x + 24, b - 44 + j * 8);
  }
  ctx.stroke();
  const FLOWERS: ReadonlyArray<readonly [number, number, string]> = [[-14, -22, '#ffd23f'], [11, -16, '#ffffff'], [-5, -12, '#7fe0f0'], [16, -30, '#ffd23f'], [-16, -36, '#ffffff'], [4, -34, '#ffb0cf']];
  for (const [fxo, fyo, fc] of FLOWERS) {
    ctx.fillStyle = tone(fc);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(x + fxo + Math.cos((k * TAU) / 5) * 2, b + fyo + Math.sin((k * TAU) / 5) * 2, 1.5, 0, TAU);
      ctx.fill();
    }
    bolt(ctx, x + fxo, b + fyo, 1.1, '#c97a1c');
  }
  rrect(ctx, x - 17, b - 36, 34, 5, 2);
  paint(ctx, tone('#f4d77a'), 2.2);
  ctx.beginPath();
  ctx.moveTo(x - 3, b - 36);
  ctx.lineTo(x - 7, b - 24);
  ctx.moveTo(x + 3, b - 36);
  ctx.lineTo(x + 7, b - 24);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  blob(ctx, [[x - 14, b - 54], [x - 9, b - 59], [x, b - 57], [x + 9, b - 59], [x + 14, b - 54], [x + 7, b - 50], [x - 7, b - 50]]);
  paint(ctx, tone('#fff5fa'), 2.4);
  // arms: a fist on the hip, the other up with the slipper
  limb(ctx, x - 13, b - 50, x - 25, b - 36, 6.4, tone('#a03e70'));
  limb(ctx, x - 25, b - 36, x - 15, b - 30, 5.6, tone('#a03e70'));
  fist(ctx, x - 14, b - 30, 4.4, tone('#f1c9a4'));
  const sx = x + hw + 6;
  const sy = b - 62 - raise * 11;
  limb(ctx, x + 13, b - 50, x + 24, b - 56 - raise * 4, 6.4, tone('#a03e70'));
  limb(ctx, x + 24, b - 56 - raise * 4, sx, sy + 3, 5.6, tone('#a03e70'));
  ctx.save();
  ctx.translate(sx, sy - 3);
  ctx.rotate(-0.5 - raise * 0.5);
  blob(ctx, [[-4, -13], [4, -13], [7, -3], [6, 9], [0, 12], [-6, 9], [-7, -3]]);
  paint(ctx, rad(ctx, -2, -4, 1, 16, tone('#ffd0e2'), tone('#e5799f')), 2.6);
  ctx.beginPath();
  ctx.ellipse(0, -5, 4.4, 3, 0, 0, TAU);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = tone('#fff0f6');
  for (let t = 0; t < 3; t++) {
    ctx.beginPath();
    ctx.arc(-3.5 + t * 3.5, -10.5, 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  fist(ctx, sx, sy + 3, 4.2, tone('#f1c9a4'));
  // the head: cloud of hair with curlers, round glasses, glare
  const hx = x + fx * 2;
  const hy = b - 66;
  blob(ctx, [[hx - 15, hy + 2], [hx - 17, hy - 9], [hx - 9, hy - 18], [hx, hy - 20], [hx + 9, hy - 18], [hx + 17, hy - 9], [hx + 15, hy + 2], [hx + 9, hy - 2], [hx - 9, hy - 2]]);
  paint(ctx, rad(ctx, hx - 4, hy - 12, 1, 24, tone('#c9c3dc'), tone('#8f88aa')), 3);
  for (const [cx2, cy2, rot] of [[-12, -13, -0.9], [-4, -18, -0.3], [5, -18, 0.3], [13, -12, 0.9], [0, -11, 0]] as const) {
    ctx.save();
    ctx.translate(hx + cx2, hy + cy2);
    ctx.rotate(rot);
    rrect(ctx, -3.4, -5, 6.8, 10, 3);
    paint(ctx, lin(ctx, -3, 0, 3, 0, tone('#ffb0cf'), tone('#e5558c')), 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-1.4, -4, 1.2, 8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(hx, hy + 1, 11.5, 12, 0, 0, TAU);
  paint(ctx, rad(ctx, hx - 3, hy - 4, 1, 16, tone(anger ? '#ffc3a0' : '#f7d2b0'), tone(anger ? '#e0745a' : '#d9a37c')), 2.8);
  const gy = hy - 1.5;
  for (const side of [-1, 1] as const) {
    eye(ctx, hx + side * 5.2, gy, 3.4, fx, fy, side, { angry: Math.max(0.5 + anger * 0.15, rage ? 1 : 0), iris: rage ? '#ff2e2e' : '#4c8f6a', lid: blink(time, e.seed + side), lidColor: tone('#e6b690'), dead: e.defeated });
    ctx.beginPath();
    ctx.arc(hx + side * 5.2, gy, 5.8, 0, TAU);
    ctx.strokeStyle = tone('#ff5a8e');
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.strokeStyle = tone('#ff5a8e');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hx - 1, gy);
  ctx.lineTo(hx + 1, gy);
  ctx.stroke();
  brow(ctx, hx - 10, gy - 8, hx - 2, gy - 5.4 - anger, 2.2);
  brow(ctx, hx + 10, gy - 8, hx + 2, gy - 5.4 - anger, 2.2);
  ctx.beginPath();
  ctx.moveTo(hx, gy + 2);
  ctx.lineTo(hx + 2, gy + 7);
  ctx.lineTo(hx - 1, gy + 7.4);
  ctx.strokeStyle = 'rgba(120, 50, 30, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  maw(ctx, hx + fx, hy + 8.6, 4.6, yell * 0.4, 0, '#ffffff', '#c94a6a');
  if (anger && !e.defeated) puffs(ctx, hx + 14, hy - 2, time, e.seed, '255, 180, 170', 2, 14);
  void windup;
};

/** The Vacuumasaurus: a tracked green dino with a hose for a trunk and a dust-bag mouth that gulps the room. */
export const vacuumasaurus: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const suck = e.sucking && !e.defeated;
  const jaw = suck ? 10 : 2 + windup * 5;
  const rage = raging(e);
  // tail with its own plug, sparking
  const tw = Math.sin(time * 3 + e.seed) * 3;
  tentacle(ctx, x - hw * 0.5, b - 14, x - hw - 14, b - 4 + tw, x - hw - 24, b - 20 + tw, 11, 3, lin(ctx, x - hw, 0, x - hw - 24, 0, tone('#4a8a3a'), tone('#2c5a22')), 'rgba(0,0,0,0.25)', time);
  rrect(ctx, x - hw - 31, b - 24 + tw, 8, 9, 2);
  paint(ctx, tone('#2a2330'), 2);
  ctx.fillStyle = '#d8d2c4';
  ctx.fillRect(x - hw - 24, b - 22 + tw, 4, 1.8);
  ctx.fillRect(x - hw - 24, b - 18 + tw, 4, 1.8);
  if (!e.defeated && Math.sin(time * 17 + e.seed) > 0.4) {
    ctx.strokeStyle = '#fff6a8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - hw - 33, b - 20 + tw);
    ctx.lineTo(x - hw - 37, b - 24 + tw);
    ctx.lineTo(x - hw - 35, b - 17 + tw);
    ctx.stroke();
  }
  // tank tracks
  for (const side of [-1, 1] as const) {
    rrect(ctx, x + side * hw * 0.46 - 14, b - 14, 28, 14, 7);
    paint(ctx, tone('#26302a'), 2.8);
    ctx.fillStyle = tone('#5c6a60');
    for (let t = 0; t < 7; t++) {
      const tx = x + side * hw * 0.46 - 11 + ((t * 4 + e.walkPhase * 5) % 24);
      ctx.fillRect(tx, b - 13, 1.6, 2.2);
      ctx.fillRect(tx, b - 3, 1.6, 2.2);
    }
    wheel(ctx, x + side * hw * 0.46 - 8, b - 7, 4.2, e.walkPhase * 3, '#8f9aa6');
    wheel(ctx, x + side * hw * 0.46 + 8, b - 7, 4.2, e.walkPhase * 3, '#8f9aa6');
  }
  // body: green torso, pale belly with vent slats, spiky dust-filter back plates
  for (const [ox, h] of [[-14, 12], [-4, 17], [8, 16], [18, 11]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + ox - 6, b - 44);
    ctx.lineTo(x + ox, b - 44 - h);
    ctx.lineTo(x + ox + 6, b - 44);
    ctx.closePath();
    paint(ctx, lin(ctx, 0, b - 44 - h, 0, b - 44, tone('#e8d27a'), tone('#b08a2a')), 2.4);
  }
  blob(ctx, [[x - hw + 2, b - 14], [x - hw - 2, b - 30], [x - hw * 0.6, b - 46], [x, b - 50], [x + hw * 0.6, b - 46], [x + hw + 2, b - 30], [x + hw - 2, b - 14]]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#274a1e'), tone('#5f9f4a'), tone('#2c5a22')), 3.2);
  blob(ctx, [[x - 13, b - 16], [x - 15, b - 28], [x, b - 33], [x + 15, b - 28], [x + 13, b - 16]]);
  paint(ctx, tone('#c9d98a'), 2.2);
  ctx.strokeStyle = 'rgba(40, 60, 20, 0.5)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(x - 11, b - 19 - i * 4);
    ctx.lineTo(x + 11, b - 19 - i * 4);
  }
  ctx.stroke();
  // head: big and frontal, eyes under a heavy brow, a mouth that opens wide when it sucks
  const hy = b - 40;
  blob(ctx, [[x - 19, hy + 6], [x - 22, hy - 7], [x - 12, hy - 17], [x, hy - 19], [x + 12, hy - 17], [x + 22, hy - 7], [x + 19, hy + 6], [x, hy + 10]]);
  paint(ctx, rad(ctx, x - 6, hy - 10, 1, 30, tone('#78bd5e'), tone('#3b7a2c')), 3);
  eyePair(ctx, x + fx * 2, hy - 7, 8, 5, fx, fy, { angry: rage ? 1 : 0.85, iris: rage ? '#ff2e2e' : '#ffd23f', lid: blink(time, e.seed), lidColor: tone('#3b7a2c'), dead: e.defeated });
  brow(ctx, x - 16, hy - 16, x - 3, hy - 11, 3.4);
  brow(ctx, x + 16, hy - 16, x + 3, hy - 11, 3.4);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 3, hy + 0.5, 1.5, 1.1, 0, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  maw(ctx, x + fx * 2, hy + 4, 14, jaw, 7, '#fffbe8', '#c94a6a');
  // the hose trunk coming off the crown, nozzle on the right
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8.4;
  ctx.lineCap = 'round';
  const nz = suck ? 1 : 0;
  ctx.beginPath();
  ctx.moveTo(x + 6, hy - 19);
  ctx.bezierCurveTo(x + 14, hy - 38, x + hw + 18, hy - 30 + nz * 4, x + hw + 14, hy - 8 + nz * 6);
  ctx.stroke();
  ctx.strokeStyle = tone('#8d99a8');
  ctx.lineWidth = 5.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40, 50, 60, 0.6)';
  ctx.lineWidth = 5.2;
  ctx.setLineDash([1.3, 2.4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  const nx = x + hw + 14;
  const ny = hy - 8 + nz * 6;
  ctx.beginPath();
  ctx.moveTo(nx - 5, ny);
  ctx.lineTo(nx + 5, ny);
  ctx.lineTo(nx + 8, ny + 9);
  ctx.lineTo(nx - 8, ny + 9);
  ctx.closePath();
  paint(ctx, tone('#e5383b'), 2.4);
  ctx.fillStyle = '#17132a';
  ctx.fillRect(nx - 6, ny + 7, 12, 2.4);
  if (suck) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const t = (time * 1.6 + i / 4) % 1;
      ctx.beginPath();
      ctx.moveTo(nx + (i - 1.5) * 8, ny + 26 - t * 18);
      ctx.lineTo(nx + (i - 1.5) * 5, ny + 14 - t * 18);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  // stubby arms
  for (const side of [-1, 1]) {
    limb(ctx, x + side * (hw - 6), b - 28, x + side * (hw - 1), b - 20, 5, tone('#4a8a3a'));
    fist(ctx, x + side * (hw - 1), b - 19, 3.6, tone('#78bd5e'), side);
  }
};

/** The Laundry Hydra: a blue basket, three striped sock serpents with toe-cap heads, a towel spilling over. */
export const hydra: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const lash = e.lashProgress;
  const rage = raging(e);
  const SOCKS: ReadonlyArray<readonly [string, string, string]> = [['#e8743a', '#fbf6e9', '#b9461a'], ['#3fb7b0', '#17132a', '#1f7e78'], ['#d9668a', '#ffd23f', '#9e3558']];
  const order = [0, 2, 1];
  for (const i of order) {
    const [sock, trim, dark] = SOCKS[i]!;
    const base = -Math.PI / 2 + (i - 1) * 0.75;
    const wave = Math.sin(time * 2.6 + i * 2.1 + e.seed) * 0.28 * (1 - lash * 0.5);
    const dir = base + wave + angleDiff(base, e.facing) * lash * 0.5;
    const len = 44 + Math.sin(time * 2.6 + i * 2.1) * 5 + lash * 18;
    const sx = x + (i - 1) * 10;
    const sy = b - 28;
    const tx = x + (i - 1) * 10 + Math.cos(dir) * len;
    const ty = sy + Math.sin(dir) * len;
    const mx = sx + Math.cos(dir + wave) * len * 0.55;
    const my = sy + Math.sin(dir + wave) * len * 0.55;
    tentacle(ctx, sx, sy, mx, my, tx, ty, 11, 9, lin(ctx, sx, sy, tx, ty, tone(sock), tone(dark)), '', time);
    // stripes along the sock
    ctx.strokeStyle = tone(trim);
    ctx.lineWidth = 2.2;
    for (let k = 1; k <= 3; k++) {
      const t = k * 0.22;
      const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * tx;
      const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ty;
      const tx0 = 2 * (1 - t) * (mx - sx) + 2 * t * (tx - mx);
      const ty0 = 2 * (1 - t) * (my - sy) + 2 * t * (ty - my);
      const tl = Math.hypot(tx0, ty0) || 1;
      ctx.beginPath();
      ctx.moveTo(px - (ty0 / tl) * 5, py + (tx0 / tl) * 5);
      ctx.lineTo(px + (ty0 / tl) * 5, py - (tx0 / tl) * 5);
      ctx.stroke();
    }
    // toe-cap head: rounded, eyes, fanged grin
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(dir + Math.PI / 2 - 0.2 * Math.sin(time * 4 + i));
    blob(ctx, [[-8, 4], [-9, -6], [-4, -13], [4, -13], [9, -6], [8, 4], [0, 8]]);
    paint(ctx, lin(ctx, -9, 0, 9, 0, tone(dark), tone(sock), tone(dark)), 2.8);
    ctx.fillStyle = tone(trim);
    ctx.fillRect(-8, 3, 16, 3);
    ctx.restore();
    const hx = tx;
    const hy = ty - 3;
    eyePair(ctx, hx, hy - 4, 3.6, 2.6, fx, fy, { angry: rage ? 1 : 0.7, iris: rage ? '#ff2e2e' : '#17132a', lid: blink(time, e.seed + i * 0.3), lidColor: tone(sock), dead: e.defeated });
    maw(ctx, hx, hy + 2, 4.2, 1.6 + windup * 3 + lash * 3, 4, '#ffffff', '#d9506a');
  }
  // a towel and a sleeve spilling over the rim
  ctx.beginPath();
  ctx.moveTo(x - hw + 4, b - 30);
  ctx.quadraticCurveTo(x - hw - 8, b - 20, x - hw - 2, b - 8);
  ctx.lineTo(x - hw + 8, b - 10);
  ctx.quadraticCurveTo(x - hw + 4, b - 20, x - hw + 12, b - 30);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, b - 30, 0, b - 8, tone('#f4f1ea'), tone('#bdb6a8')), 2.4);
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - hw - 5, b - 15);
  ctx.lineTo(x - hw + 6, b - 17);
  ctx.stroke();
  // the basket: tapered tub, weave holes, rim, handle cut-outs, caster-less feet
  blob(ctx, [[x - hw - 3, b - 32], [x - hw + 2, b - 14], [x - hw + 5, b - 3], [x + hw - 5, b - 3], [x + hw - 2, b - 14], [x + hw + 3, b - 32]]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#2d4f9a'), tone('#6aa0f0'), tone('#2a4890')), 3.2);
  ctx.fillStyle = 'rgba(10, 20, 50, 0.55)';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      const hx2 = x - hw + 8 + c * ((hw * 2 - 16) / 7) + (r % 2) * 3;
      rrect(ctx, hx2 - 2.4, b - 22 + r * 6, 4.8, 3.2, 1.2);
      ctx.fill();
    }
  }
  rrect(ctx, x - hw - 5, b - 36, hw * 2 + 10, 7, 3.2);
  paint(ctx, lin(ctx, 0, b - 36, 0, b - 29, tone('#9fc4ff'), tone('#3d68b8')), 2.8);
  for (const side of [-1, 1]) {
    rrect(ctx, x + side * (hw - 3) - 5, b - 35, 10, 4, 2);
    paint(ctx, tone('#1a2c5c'), 1.4);
  }
  gloss(ctx, x - hw * 0.55, b - 20, 2.4, 8, 0.15, 0.4);
  // a face on the basket front would crowd the heads: it frowns on the rim label instead
  ctx.fillStyle = tone('#fbf6e9');
  ctx.fillRect(x - 6, b - 13, 12, 6);
  ctx.fillStyle = INK;
  ctx.font = '700 4.4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASH', x, b - 8.4);
};

/** Fan-tastic: a caged pedestal fan with a furious hub, blur blades and a frayed cord. */
export const fan: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const cy = b - 50;
  const R = 25;
  const sway = Math.sin(e.walkPhase * 0.8) * 3;
  const rage = raging(e);
  // weighted base, pole and the frayed cord with its plug
  ctx.beginPath();
  ctx.ellipse(x, b - 4, 19, 6, 0, 0, TAU);
  paint(ctx, lin(ctx, x - 19, 0, x + 19, 0, tone('#4a5668'), tone('#9aa8bb'), tone('#4a5668')), 3);
  rrect(ctx, x - 3.4, cy + 14, 6.8, b - 4 - cy - 14, 2);
  paint(ctx, lin(ctx, x - 4, 0, x + 4, 0, tone('#6d7a8c'), tone('#e8eef5'), tone('#6d7a8c')), 2.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 6, b - 6);
  ctx.bezierCurveTo(x + 24, b - 2, x + 28, b - 18, x + 38, b - 10 + Math.sin(time * 5) * 1.5);
  ctx.stroke();
  ctx.strokeStyle = tone('#d8d2c4');
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineCap = 'butt';
  rrect(ctx, x + 36, b - 16 + Math.sin(time * 5) * 1.5, 8, 9, 2);
  paint(ctx, tone('#2a2330'), 2);
  if (!e.defeated && Math.sin(time * 13 + e.seed) > 0.3) {
    ctx.strokeStyle = '#fff6a8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x + 46, b - 12);
    ctx.lineTo(x + 51, b - 16);
    ctx.lineTo(x + 49, b - 9);
    ctx.stroke();
  }
  // motor housing (tilts with the oscillation) and pull chains
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(sway * 0.01);
  ctx.translate(-x, -cy);
  blob(ctx, [[x - 11, cy + 6], [x - 13, cy + 18], [x, cy + 22], [x + 13, cy + 18], [x + 11, cy + 6]]);
  paint(ctx, lin(ctx, x - 13, 0, x + 13, 0, tone('#4a5668'), tone('#a9b6c8'), tone('#4a5668')), 2.8);
  for (const side of [-1, 1]) {
    ctx.strokeStyle = tone('#d8d2c4');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + side * 7, cy + 19);
    ctx.lineTo(x + side * 8 + Math.sin(time * 3 + side) * 1.4, cy + 29);
    ctx.stroke();
    bolt(ctx, x + side * 8 + Math.sin(time * 3 + side) * 1.4, cy + 30, 1.6, tone(side < 0 ? '#e5383b' : '#ffd23f'));
  }
  // three curved blades smearing round (a blur ring behind them)
  const spin = time * 14 + e.walkPhase;
  ctx.beginPath();
  ctx.arc(x, cy, R - 3, 0, TAU);
  ctx.fillStyle = 'rgba(180, 215, 245, 0.35)';
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.bezierCurveTo(10, -14, 26, -13, R - 3, -4);
    ctx.bezierCurveTo(R - 3, 7, 12, 9, 4, 3);
    ctx.closePath();
    paint(ctx, lin(ctx, 0, -12, 0, 8, tone('#e6f3ff'), tone('#7fb0e0')), 2.4);
    ctx.restore();
  }
  // the guard: ring and spokes
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.arc(x, cy, R, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = tone('#cfd8e3');
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(26,14,52,0.7)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k * TAU) / 10;
    ctx.moveTo(x + Math.cos(a) * 9, cy + Math.sin(a) * 9);
    ctx.lineTo(x + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  ctx.stroke();
  for (const rr of [14, 19.5]) {
    ctx.beginPath();
    ctx.arc(x, cy, rr, 0, TAU);
    ctx.stroke();
  }
  // the hub is the face
  ctx.beginPath();
  ctx.arc(x, cy, 10.4, 0, TAU);
  paint(ctx, rad(ctx, x - 3, cy - 4, 1, 14, tone('#f2f6fb'), tone('#8f9bb0')), 3);
  eyePair(ctx, x + fx, cy - 1.6, 4, 3.2, fx, fy, { angry: rage ? 1 : 0.85, iris: rage ? '#ff2e2e' : '#e5383b', lid: blink(time, e.seed), lidColor: tone('#c7d1de'), dead: e.defeated });
  maw(ctx, x + fx, cy + 5.4, 4.2, 1.2 + windup * 3, 4, '#ffffff', '#d9506a');
  ctx.restore();
  // wind: streaks pouring off to the facing side
  if (!e.defeated) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const t = (time * 1.8 + i * 0.27) % 1;
      const sy = cy - 16 + i * 10;
      ctx.beginPath();
      ctx.moveTo(x + fx * (R + 4 + t * 20), sy);
      ctx.lineTo(x + fx * (R + 12 + t * 20), sy);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  void hw;
};
