import { INK } from '../core/constants';
import { TAU } from '../core/math';
import {
  blob, bolt, blink, brow, eye, eyePair, fist, gloss, lighten, limb, lin, maw, paint, puffs, rad, raging, rrect, tentacle, wheel,
  type BossBody,
} from './BossKit';

function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Popcorn Apocalypse: a striped tub monster with a kernel heap for a head. What it holds, it throws. */
export const popcorn: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const raise = e.hurlProgress;
  const rage = raging(e);
  const alive = !e.defeated;
  const rimY = b - 48;
  // base the tub sits in
  rrect(ctx, x - hw * 0.66, b - 8, hw * 1.32, 8, 3);
  paint(ctx, lin(ctx, 0, b - 8, 0, b, tone('#8f1d16'), tone('#5c130d')), 2.4);
  // tub: trapezoid, striped red and cream under a butter-gold rim
  const tub = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - hw + 1, rimY + 4);
    ctx.lineTo(x - hw * 0.66, b - 8);
    ctx.lineTo(x + hw * 0.66, b - 8);
    ctx.lineTo(x + hw - 1, rimY + 4);
    ctx.closePath();
  };
  tub();
  paint(ctx, lin(ctx, 0, rimY, 0, b, tone('#e8b13c'), tone('#a86f14')), 2.6);
  ctx.save();
  tub();
  ctx.clip();
  let band = 0;
  for (let sx = x - hw; sx < x + hw; sx += 9, band++) {
    ctx.fillStyle = band % 2 ? tone('#fbf3e2') : tone('#d43a3a');
    ctx.fillRect(sx, rimY, 9, b - rimY);
  }
  ctx.fillStyle = 'rgba(26, 14, 52, 0.22)';
  ctx.fillRect(x - hw, b - 16, hw * 2, 8);
  ctx.restore();
  tub();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // butter-gold rim
  rrect(ctx, x - hw, rimY - 3, hw * 2, 8, 4);
  paint(ctx, lin(ctx, 0, rimY - 3, 0, rimY + 5, tone('#ffe08a'), tone('#d99a2b')), 2.6);
  // butter drips down the front, swaying
  const dripSway = Math.sin(time * 2.4 + e.seed) * 1.4;
  for (const [dox, dl] of [[-hw * 0.4, 9], [hw * 0.28, 13]] as const) {
    ctx.fillStyle = tone('#ffd23f');
    ctx.beginPath();
    ctx.ellipse(x + dox + dripSway, rimY + 5 + dl / 2, 2.2, dl / 2, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + dox + dripSway, rimY + 5 + dl, 2.2, 0, TAU);
    ctx.fill();
  }
  gloss(ctx, x - hw * 0.55, b - 28, 2.4, 12, 0.12, 0.4);
  // kernel heap head: popped, piled, lightly bouncing
  const KERNELS: ReadonlyArray<readonly [number, number, number]> = [
    [-15, -54, 6], [-6, -59, 7], [4, -56, 6.5], [13, -59, 7],
    [-10, -67, 5.5], [1, -65, 6], [10, -68, 5.5], [-1, -73, 4.5],
  ];
  KERNELS.forEach(([kx, ky, kr], ki) => {
    const bob = alive ? Math.sin(time * 3 + ki * 1.3 + e.seed) * 1.4 : 0;
    ctx.beginPath();
    ctx.arc(x + kx, b + ky + bob, kr, 0, TAU);
    paint(ctx, rad(ctx, x + kx - kr * 0.3, b + ky + bob - kr * 0.35, 0.5, kr * 1.2, tone('#ffffff'), tone('#f0dcae'), tone('#c8a05e')), 2.2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x + kx - kr * 0.3, b + ky + bob - kr * 0.35, kr * 0.22, 0, TAU);
    ctx.fill();
  });
  // furious eyes nestled in the heap
  if (alive) eyePair(ctx, x + fx * 2, b - 60, 6, 3.6, fx, fy, { angry: rage ? 1 : 0.9, iris: rage ? '#ff2e2e' : '#7a4a20', lid: blink(time, e.seed), lidColor: tone('#f0dcae'), dead: false });
  // the tub mouth: kernel teeth, opening with the windup
  maw(ctx, x + fx, b - 30, 9, 2 + windup * 8, 5, '#fffbe8', '#c94a6a');
  // arms: red sleeves, cream kernel fists
  limb(ctx, x - hw + 5, b - 38, x - hw - 7, b - 30, 5.4, tone('#b22e2e'));
  rrect(ctx, x - hw - 12, b - 33, 10, 6, 3);
  paint(ctx, tone('#fbf3e2'), 2.2);
  const kernelFist = (fx0: number, fy0: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(fx0, fy0, r, 0, TAU);
    paint(ctx, rad(ctx, fx0 - r * 0.3, fy0 - r * 0.35, 0.5, r * 1.2, tone('#ffffff'), tone('#f0dcae')), 2.2);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(fx0 - r * 0.4 + k * r * 0.4, fy0 - r * 0.5, r * 0.2, 0, TAU);
      ctx.fillStyle = tone('#fffbe8');
      ctx.fill();
    }
  };
  kernelFist(x - hw - 9, b - 28, 4.6);
  // right arm raises a kernel bomb on the throw telegraph
  const hx2 = x + hw - 4;
  const hy2 = b - 58 - raise * 16;
  limb(ctx, x + hw - 5, b - 38, hx2, b - 46 - raise * 8, 5.4, tone('#b22e2e'));
  limb(ctx, hx2, b - 46 - raise * 8, hx2 + 2, hy2 + 4, 4.6, tone('#b22e2e'));
  rrect(ctx, hx2 - 3, b - 49 - raise * 8, 10, 6, 3);
  paint(ctx, tone('#fbf3e2'), 2.2);
  kernelFist(hx2 + 2, hy2, 6);
  ctx.strokeStyle = tone('#6b4d1c');
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(hx2 + 2, hy2 - 6);
  ctx.quadraticCurveTo(hx2 + 6, hy2 - 10, hx2 + 9, hy2 - 8);
  ctx.stroke();
  if (alive && raise > 0.05) puffs(ctx, hx2 + 9, hy2 - 8, time, e.seed, '255, 210, 63', 2, 10);
  // hot butter steam off the heap
  if (alive) puffs(ctx, x, b - 76, time, e.seed, '255, 240, 200', 3, 16);
};

/** Cable Kraken: a live wire nest with plug tentacles and a socket face. */
export const cables: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const lash = e.lashProgress;
  const rage = raging(e);
  const COLORS: ReadonlyArray<readonly [string, string]> = [['#e5383b', '#ff8a7a'], ['#2f4fb5', '#7aa0ff'], ['#c9a24f', '#ffe08a']];
  // plug tentacles lashing towards the facing
  for (let i = -1; i <= 1; i++) {
    const [wire, glow] = COLORS[i + 1]!;
    const rest = -Math.PI / 2 + i * 0.8;
    const wave = Math.sin(time * 4 + i * 2.4 + e.seed) * 0.2 * (1 - lash * 0.5);
    const dir = rest + wave + angleDiff(rest, e.facing) * lash * 0.5;
    const len = 36 + Math.sin(time * 4 + i * 2.4) * 3 + lash * 20;
    const sx = x + (i * 4);
    const sy = b - 16;
    const mx = sx + Math.cos(dir + wave) * len * 0.55;
    const my = sy + Math.sin(dir + wave) * len * 0.55;
    const tx = sx + Math.cos(dir) * len;
    const ty = sy + Math.sin(dir) * len;
    tentacle(ctx, sx, sy, mx, my, tx, ty, 9, 4, lin(ctx, sx, sy, tx, ty, tone(wire), tone(glow)), '', time);
    // plug head with prongs
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(dir);
    rrect(ctx, -4, -5.5, 10, 11, 2);
    paint(ctx, tone('#fbf6e9'), 2);
    ctx.fillStyle = tone('#8a8a96');
    ctx.fillRect(6, -3.6, 4.4, 2.6);
    ctx.fillRect(6, 1, 4.4, 2.6);
    ctx.restore();
    // spark tips flickering
    const flick = (Math.sin(time * 23 + i * 7 + e.seed * 3) * 0.5 + 0.5 + (i + 1) * 0.13) % 1;
    if (flick > 0.45 && !e.defeated) {
      ctx.fillStyle = flick > 0.75 ? '#fff27a' : '#4ad6e8';
      ctx.beginPath();
      ctx.arc(tx + Math.cos(dir) * 13, ty + Math.sin(dir) * 13, 2 + flick * 2.2, 0, TAU);
      ctx.fill();
    }
  }
  // the nest: looping live wire with a highlight loop
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, b - 18, hw, 15, 0.15, 0, TAU);
  paint(ctx, lin(ctx, x - hw, b - 33, x + hw, b - 3, tone('#23232f'), tone('#4a4a5c')), 3);
  ctx.strokeStyle = tone('#6a6a7c');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x - 6, b - 22, hw * 0.7, 10, -0.2, 0.4, 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 8, b - 14, hw * 0.6, 9, 0.3, 3.4, 5.6);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // hazard ticks on the nest
  for (let k = 0; k < 5; k++) {
    const a = 0.5 + k * 0.5;
    ctx.strokeStyle = k % 2 ? tone('#ffd23f') : INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * hw * 0.92, b - 18 + Math.sin(a) * 14);
    ctx.lineTo(x + Math.cos(a + 0.22) * hw * 0.92, b - 18 + Math.sin(a + 0.22) * 14);
    ctx.stroke();
  }
  // socket faceplate: slot eyes and a breaker mouth
  rrect(ctx, x - 12, b - 34, 24, 22, 3);
  paint(ctx, lin(ctx, 0, b - 34, 0, b - 12, tone('#ffffff'), tone('#cfcfda')), 2.6);
  bolt(ctx, x - 9, b - 31, 1.4, tone('#8a8a96'));
  bolt(ctx, x + 9, b - 31, 1.4, tone('#8a8a96'));
  if (!e.defeated) eyePair(ctx, x + fx * 1.5, b - 26, 4.6, 3, fx, fy, { angry: rage ? 1 : 0.8, iris: rage ? '#ff2e2e' : '#ffd23f', lid: blink(time, e.seed), lidColor: tone('#cfcfda'), dead: false });
  const tripped = e.shockTimer > 0 || lash > 0.3;
  maw(ctx, x + fx, b - 15.5, 5, (tripped ? 5 : 1.6) + windup * 2, 3, '#ffffff', '#d9506a');
};

/** Pressure Cooker: a boiler with a gauge, a rocking weight, and no chill. */
export const cooker: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const boiling = e.phaseIndex > 0 && !e.defeated;
  const slam = e.ai === 'slam' && !e.defeated;
  const rage = raging(e);
  // feet and the pot belly
  for (const side of [-1, 1] as const) {
    rrect(ctx, x + side * 10 - 4, b - 4, 8, 4.4, 1.6);
    paint(ctx, tone('#3a352c'), 2);
  }
  blob(ctx, [[x - hw, b - 4], [x - hw + 5, b - 44], [x - hw + 12, b - 50], [x + hw - 12, b - 50], [x + hw - 5, b - 44], [x + hw, b - 4]]);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#8d8676'), tone('#e8e2d2'), tone('#a09a8a')), 3);
  gloss(ctx, x - hw * 0.5, b - 28, 2.6, 12, 0.1, 0.5);
  // MAX fill line and side handles
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - hw + 7, b - 30);
  ctx.lineTo(x - hw + 16, b - 30);
  ctx.stroke();
  ctx.fillStyle = tone('#e5383b');
  ctx.font = '700 4.6px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAX', x - hw + 7, b - 32);
  for (const side of [-1, 1] as const) limb(ctx, x + side * hw, b - 26, x + side * (hw + 10), b - 30, 4.4, tone('#5c564a'));
  // lid with a rocking weight
  ctx.beginPath();
  ctx.ellipse(x, b - 48, hw - 2, 7.5, 0, 0, TAU);
  paint(ctx, lin(ctx, 0, b - 55, 0, b - 40, tone('#b8b0a0'), tone('#6e675a')), 2.8);
  const rock = boiling ? Math.sin(time * 14 + e.seed) * 0.4 : Math.sin(time * 3) * 0.08;
  ctx.save();
  ctx.translate(x, b - 57);
  ctx.rotate(rock);
  rrect(ctx, -4.4, -9, 8.8, 10, 2);
  paint(ctx, lin(ctx, -4, 0, 4, 0, tone('#8a8478'), tone('#3f3a32')), 2);
  ctx.restore();
  // gauge with a nervous needle
  const gx = x + hw - 13;
  const gy = b - 32;
  ctx.beginPath();
  ctx.arc(gx, gy, 7.4, 0, TAU);
  paint(ctx, rad(ctx, gx - 2, gy - 2, 0.5, 8, tone('#ffffff'), tone('#cfc9ba')), 2.2);
  const needle = Math.sin(time * (boiling ? 9 : 2) + e.seed) * 0.7 - 0.4;
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.sin(needle) * 5, gy - Math.cos(needle) * 5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  bolt(ctx, gx, gy, 1.2, INK);
  // worried eyes and valve brows
  if (!e.defeated) {
    eyePair(ctx, x + fx * 2, b - 24, 7, 4.2, fx, fy, { angry: rage ? 1 : 0.35, lid: Math.max(0.3, blink(time, e.seed)), iris: rage ? '#ff2e2e' : '#3a6ea8', lidColor: tone('#cfc9ba'), dead: false });
    brow(ctx, x - 13, b - 36, x - 4, b - 33, 2.4);
    brow(ctx, x + 13, b - 36, x + 4, b - 33, 2.4);
    maw(ctx, x + fx * 3, b - 12.5, 3.6, 1.6 + windup * 3 + (slam ? 3 : 0), 0, '#ffffff', '#8a4a5a');
  }
  // steam valves: always leaking a little, gushing on the slam
  const gush = slam ? 3 : 1;
  if (!e.defeated) puffs(ctx, x - hw - 4, b - 34, time, e.seed, '228, 247, 251', 2 + gush, 18 * gush);
  if (!e.defeated) puffs(ctx, x + hw + 4, b - 34, time, e.seed + 0.5, '228, 247, 251', 2 + gush, 18 * gush);
  if (boiling) {
    ctx.strokeStyle = 'rgba(255, 120, 80, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - hw + 4, b - 8);
    ctx.lineTo(x + hw - 4, b - 8);
    ctx.stroke();
  }
};

/** Midnight Express: a side-view engine with cars, turned to face its travel. */
export const train: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const dir = fx >= 0 ? 1 : -1;
  const charging = (e.ai === 'lunge' || e.ai === 'windup') && !e.defeated;
  const rage = raging(e);
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(dir, 1);
  ctx.translate(-x, 0);
  const spin = e.walkPhase * (charging ? 5 : 2.5);
  // cars behind: a fridge car, then a lamp car
  const cars: ReadonlyArray<{ c: string; dark: string }> = [{ c: '#5c4a6e', dark: '#3a2c48' }, { c: '#3f5a4c', dark: '#274035' }];
  cars.forEach(({ c, dark }, ci) => {
    const cx = x - (ci + 1) * 46;
    rrect(ctx, cx - 19, b - 36, 38, 24, 3);
    paint(ctx, lin(ctx, 0, b - 36, 0, b - 12, tone(c), tone(dark)), 2.6);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '700 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ci === 0 ? 'MAIL' : 'FRAGILE', cx, b - 16);
    if (ci === 0) {
      rrect(ctx, cx - 8, b - 52, 16, 16, 2);
      paint(ctx, lin(ctx, 0, b - 52, 0, b - 36, tone('#c3cedb'), tone('#7d8898')), 2);
      ctx.fillStyle = tone('#4a5568');
      ctx.fillRect(cx + 4, b - 48, 2, 8);
    } else {
      limb(ctx, cx, b - 36, cx, b - 50, 2.4, tone('#6e522e'));
      ctx.beginPath();
      ctx.ellipse(cx, b - 53, 7, 5, 0, 0, TAU);
      paint(ctx, rad(ctx, cx - 2, b - 55, 0.5, 8, tone('#fff3c0'), tone('#ffd23f')), 2);
      if (!e.defeated) {
        ctx.fillStyle = 'rgba(255, 242, 122, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, b - 53, 11, 0, TAU);
        ctx.fill();
      }
    }
    for (const wx of [-10, 10]) wheel(ctx, cx + wx, b - 8, 6, spin, '#8f9aa6');
    // coupling chain
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + 19, b - 16);
    ctx.quadraticCurveTo(cx + 23, b - 12, cx + 27, b - 16);
    ctx.stroke();
  });
  // engine: boiler with brass bands, cab, chimney, cowcatcher, headlight
  ctx.beginPath();
  ctx.ellipse(x + 6, b - 28, 27, 13.5, 0, 0, TAU);
  paint(ctx, lin(ctx, 0, b - 42, 0, b - 14, tone('#46587e'), tone('#2e3a55'), tone('#141b2c')), 3.2);
  for (const bx of [-6, 8]) {
    ctx.strokeStyle = tone('#d9ad4f');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 6, b - 28, 27, 13.5, 0, -0.5 + bx * 0.02, 0.5 + bx * 0.02);
    ctx.stroke();
  }
  gloss(ctx, x - 8, b - 34, 8, 2.6, -0.2, 0.45);
  rrect(ctx, x - 24, b - 52, 26, 26, 3);
  paint(ctx, lin(ctx, 0, b - 52, 0, b - 26, tone('#232c44'), tone('#141b2c')), 3);
  rrect(ctx, x - 20, b - 48, 17, 11, 2);
  paint(ctx, rad(ctx, x - 14, b - 46, 0.5, 12, tone('#c8f2ff'), tone('#4a9ab5')), 2.2);
  if (!e.defeated) eyePair(ctx, x - 11.5 + fx * 0, b - 42.5, 4.4, 3, 1, 0, { angry: rage ? 1 : 0.9, iris: rage ? '#ff2e2e' : '#ffd23f', lid: blink(time, e.seed), lidColor: tone('#232c44'), dead: false });
  rrect(ctx, x + 20, b - 56, 9, 18, 2);
  paint(ctx, tone('#141b2c'), 2.4);
  if (!e.defeated) puffs(ctx, x + 24, b - 58, time, e.seed, '130, 130, 142', charging ? 5 : 3, charging ? 34 : 24);
  // cowcatcher with slats
  ctx.beginPath();
  ctx.moveTo(x + hw - 2, b - 6);
  ctx.lineTo(x + hw + 16, b - 6);
  ctx.lineTo(x + hw - 2, b - 22);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, b - 22, 0, b - 6, tone('#e05245'), tone('#8f1d16')), 2.4);
  ctx.strokeStyle = tone('#5c130d');
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + hw + 1 + k * 4, b - 8);
    ctx.lineTo(x + hw - 1 + k * 2, b - 19);
    ctx.stroke();
  }
  // headlight: lit housing and a beam when charging
  ctx.beginPath();
  ctx.arc(x + hw - 4, b - 30, 5.4, 0, TAU);
  paint(ctx, rad(ctx, x + hw - 6, b - 32, 0.5, 7, tone('#fffbe8'), tone('#e8c96a')), 2.2);
  if (charging) {
    ctx.fillStyle = 'rgba(255, 246, 201, 0.28)';
    ctx.beginPath();
    ctx.moveTo(x + hw, b - 33);
    ctx.lineTo(x + hw + 44, b - 44);
    ctx.lineTo(x + hw + 44, b - 20);
    ctx.closePath();
    ctx.fill();
  }
  // drivers with coupling rods
  for (const wx of [-14, 8, 28]) wheel(ctx, x + wx, b - 8, 8, spin, '#8f9aa6');
  ctx.strokeStyle = tone('#cfd8e3');
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 14 + Math.cos(spin) * 6, b - 8 + Math.sin(spin) * 6);
  ctx.lineTo(x + 28 + Math.cos(spin) * 6, b - 8 + Math.sin(spin) * 6);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
  void fy;
  void windup;
};

/** King of Junk: a wardrobe tower with lamp arms, a TV head and a bottle-cap crown. */
export const junk: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const top = b - 74;
  const rage = raging(e);
  // wardrobe tower: wood grain, split doors, brass knobs, one drawer hanging open
  rrect(ctx, x - hw + 4, top + 18, hw * 2 - 8, 54, 3);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#8a6fa8'), tone('#6b5a86'), tone('#453a58')), 3);
  ctx.strokeStyle = 'rgba(34, 27, 54, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 18);
  ctx.lineTo(x, top + 72);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.1;
  for (const gx of [-hw + 10, -hw + 22, hw - 22, hw - 10]) {
    ctx.beginPath();
    ctx.moveTo(x + gx, top + 24);
    ctx.lineTo(x + gx, top + 66);
    ctx.stroke();
  }
  for (const dy of [26, 40, 54]) {
    bolt(ctx, x - 5, top + dy, 1.8, tone('#e2b94c'));
    bolt(ctx, x + 5, top + dy, 1.8, tone('#e2b94c'));
  }
  // the open drawer with a sock dangling out
  rrect(ctx, x + 6, top + 58, 17, 11, 2);
  paint(ctx, tone('#2c2340'), 2.2);
  blob(ctx, [[x + 10, top + 66], [x + 8, top + 76], [x + 12, top + 82], [x + 17, top + 80], [x + 16, top + 68]]);
  paint(ctx, lin(ctx, 0, top + 66, 0, top + 82, tone('#fbf6e9'), tone('#bdb6a8')), 1.8);
  ctx.fillStyle = tone('#e5383b');
  ctx.fillRect(x + 10, top + 70, 6, 2.4);
  // lamp arms, the left one lit
  for (const side of [-1, 1] as const) {
    limb(ctx, x + side * (hw - 4), b - 46, x + side * (hw + 8), b - 54, 5, tone('#453a58'));
    ctx.beginPath();
    ctx.moveTo(x + side * (hw + 8) - 7, b - 64);
    ctx.lineTo(x + side * (hw + 8) + 7, b - 64);
    ctx.lineTo(x + side * (hw + 8) + 4, b - 50);
    ctx.lineTo(x + side * (hw + 8) - 4, b - 50);
    ctx.closePath();
    const lit = side < 0 && !e.defeated;
    paint(ctx, lit ? rad(ctx, x + side * (hw + 8), b - 57, 1, 12, tone('#fffbe8'), tone('#e8c96a')) : tone('#ecdcab'), 2.2);
    if (lit) {
      ctx.fillStyle = 'rgba(255, 242, 122, 0.3)';
      ctx.beginPath();
      ctx.arc(x + side * (hw + 8), b - 57, 13, 0, TAU);
      ctx.fill();
    }
  }
  // TV head: static snow, glowing eyes, bottle-cap crown
  rrect(ctx, x - 18, top - 6, 36, 26, 3);
  paint(ctx, tone('#2a2330'), 3);
  for (let k = 0; k < 12; k++) {
    const flick = (Math.sin(time * 12 + k * 31 + e.seed * 7) * 0.5 + 0.5 + k * 0.07) % 1;
    if (flick > 0.5) {
      ctx.fillStyle = 'rgba(251, 246, 233, 0.8)';
      ctx.fillRect(x - 15 + ((k * 53) % 28), top + ((k * 37) % 18), 2, 2);
    }
  }
  if (!e.defeated) eyePair(ctx, x + fx * 2, top + 7, 6.4, 4.4, fx, fy, { angry: rage ? 1 : 0.85, iris: rage ? '#ff2e2e' : '#4ad6e8', lid: blink(time, e.seed), lidColor: tone('#2a2330'), dead: false });
  for (const [kx, kc] of [[-11, '#c23b2e'], [0, '#ffd23f'], [11, '#c23b2e']] as const) {
    ctx.beginPath();
    ctx.arc(x + kx, top - 10, 4.6, 0, TAU);
    paint(ctx, rad(ctx, x + kx - 1.4, top - 11.5, 0.4, 5.4, lighten(kc, 0.4), kc), 1.8);
    bolt(ctx, x + kx, top - 10, 1.4, tone('#7a4b12'));
  }
  ctx.beginPath();
  ctx.arc(x, top - 10, 15.5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = tone('#8a6fa8');
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // cable scarf and a drawer mouth that opens with the windup
  ctx.strokeStyle = tone('#1f1f2a');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - hw + 2, top + 36);
  ctx.quadraticCurveTo(x, top + 44 + Math.sin(time * 2 + e.seed) * 2, x + hw - 2, top + 36);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (!e.defeated) maw(ctx, x + fx, top + 48, 9, 2 + windup * 8, 4, '#fffbe8', '#8a4a6a');
};

/** The House That Hates You: roof, chimney, window eyes, a door for a mouth. */
export const house: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const wallTop = b - 48;
  const roofTop = b - 76;
  const gape = 3 + windup * 12 + (e.ai === 'slam' && !e.defeated ? 8 : 0);
  const rage = raging(e);
  // foundation and walls with siding
  rrect(ctx, x - hw - 2, b - 5, hw * 2 + 4, 5, 1.6);
  paint(ctx, tone('#5c5a6e'), 2);
  rrect(ctx, x - hw, wallTop, hw * 2, 48, 2);
  paint(ctx, lin(ctx, 0, wallTop, 0, b, tone('#c07a5e'), tone('#a85848'), tone('#7d3f30')), 3);
  ctx.strokeStyle = 'rgba(60, 25, 20, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let sy = wallTop + 8; sy < b - 4; sy += 7) {
    ctx.moveTo(x - hw + 2, sy);
    ctx.lineTo(x + hw - 2, sy);
  }
  ctx.stroke();
  gloss(ctx, x - hw * 0.5, wallTop + 14, 2.4, 12, 0.1, 0.4);
  // roof: shingled gable with a ridge cap
  ctx.beginPath();
  ctx.moveTo(x - hw - 7, wallTop + 1);
  ctx.lineTo(x, roofTop);
  ctx.lineTo(x + hw + 7, wallTop + 1);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, roofTop, 0, wallTop, tone('#7d4438'), tone('#5c2e28'), tone('#3a1c16')), 3);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 1; k <= 3; k++) {
    const ry = roofTop + ((wallTop - roofTop) * k) / 4;
    const spread = (hw + 7) * (k / 4);
    ctx.moveTo(x - spread, ry);
    ctx.lineTo(x + spread, ry);
  }
  ctx.stroke();
  ctx.strokeStyle = tone('#3a1c16');
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4, roofTop + 1);
  ctx.lineTo(x + 4, roofTop + 1);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // chimney with smoke
  rrect(ctx, x + hw * 0.4, roofTop + 5, 11, 17, 2);
  paint(ctx, lin(ctx, x + hw * 0.4, 0, x + hw * 0.4 + 11, 0, tone('#8a5a50'), tone('#5c3a32')), 2.2);
  rrect(ctx, x + hw * 0.4 - 1.5, roofTop + 2, 14, 4, 1.6);
  paint(ctx, tone('#3a231e'), 1.8);
  if (!e.defeated) puffs(ctx, x + hw * 0.4 + 5.5, roofTop, time, e.seed, '130, 130, 142', 2, 22);
  // attic porthole, glowing
  ctx.beginPath();
  ctx.arc(x, roofTop + 13, 5.4, 0, TAU);
  paint(ctx, rad(ctx, x - 1.5, roofTop + 11, 0.5, 6.4, tone('#fff3c0'), tone('#c9a24f')), 2);
  // window eyes with curtains and wall brows
  if (!e.defeated) {
    for (const side of [-1, 1] as const) {
      const wx = x + side * (hw * 0.55);
      rrect(ctx, wx - 10, wallTop + 8, 20, 15, 2);
      paint(ctx, tone('#fbf6e9'), 2.2);
      blob(ctx, [[wx - 10, wallTop + 8], [wx - 6, wallTop + 15], [wx - 10, wallTop + 23]]);
      paint(ctx, tone('#8a3b5c'), 1.6);
      blob(ctx, [[wx + 10, wallTop + 8], [wx + 6, wallTop + 15], [wx + 10, wallTop + 23]]);
      paint(ctx, tone('#8a3b5c'), 1.6);
      eye(ctx, wx + fx * 2, wallTop + 15.5, 4.4, fx, fy, side, { angry: rage ? 1 : 0.9, iris: rage ? '#ff2e2e' : '#e5383b', lid: blink(time, e.seed + side), lidColor: tone('#fbf6e9'), dead: false });
    }
    brow(ctx, x - hw + 4, wallTop + 4, x - 12, wallTop + 8, 2.6);
    brow(ctx, x + hw - 4, wallTop + 4, x + 12, wallTop + 8, 2.6);
  }
  // the door mouth: plank teeth, opening with the windup
  rrect(ctx, x - 12, b - 28, 24, 10 + gape, 2);
  paint(ctx, tone('#2c1a16'), 2.6);
  ctx.fillStyle = tone('#ecdcab');
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(x - 10 + k * 5.6, b - 28, 3.4, 4.4);
    if (gape > 6) ctx.fillRect(x - 10 + k * 5.6, b - 22 + gape, 3.4, 3.4);
  }
  bolt(ctx, x + 8, b - 20 + gape * 0.4, 1.5, tone('#c9a24f'));
  // doormat
  rrect(ctx, x - 15, b - 4.5, 30, 5, 1.6);
  paint(ctx, tone('#5c6b58'), 1.6);
  ctx.fillStyle = tone('#39463a');
  ctx.font = '700 3.6px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GO AWAY', x, b - 1);
};

/** Time-Thief: an alarm clock with twin bells, spinning hands and crackable glass. */
export const clock: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const r = hw;
  const cy = b - r * 0.78;
  const cracked = e.phaseIndex > 0;
  const rage = raging(e);
  // legs and winder knobs
  for (const side of [-1, 1] as const) {
    limb(ctx, x + side * 10, cy + r * 0.55, x + side * 14, b - 1, 3.6, tone('#8a7444'));
    ctx.beginPath();
    ctx.ellipse(x + side * 14, b - 1.5, 4.6, 2.6, 0, 0, TAU);
    paint(ctx, tone('#6e522e'), 2);
  }
  // twin bells with a hammer going spare
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(x + side * (r * 0.62), cy - r * 0.86, 7.4, Math.PI, TAU);
    paint(ctx, lin(ctx, 0, cy - r * 0.86 - 7, 0, cy - r * 0.86 + 2, tone('#ffe08a'), tone('#c9a24f'), tone('#8a6a24')), 2.4);
    bolt(ctx, x + side * (r * 0.62), cy - r * 0.86 - 7, 1.4, tone('#8a6a24'));
  }
  const hammer = e.defeated ? 0 : Math.sin(time * 30 + e.seed) * 0.5;
  limb(ctx, x, cy - r * 0.86 - 4, x + hammer * 14, cy - r * 0.86 - 13, 2.2, tone('#8a8a96'));
  ctx.beginPath();
  ctx.arc(x + hammer * 14, cy - r * 0.86 - 14, 2.4, 0, TAU);
  paint(ctx, tone('#4a4458'), 1.8);
  // face with a brass bezel
  ctx.beginPath();
  ctx.arc(x, cy, r + 2.4, 0, TAU);
  paint(ctx, lin(ctx, x - r, cy - r, x + r, cy + r, tone('#e8c96a'), tone('#8a6a24')), 2.6);
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, TAU);
  paint(ctx, rad(ctx, x - r * 0.3, cy - r * 0.35, 1, r * 1.2, tone('#ffffff'), tone('#f4ecdc'), tone('#d8cfbc')), 3.2);
  // ticks, heavier at the quarters
  for (let k = 0; k < 12; k++) {
    const a = (k * TAU) / 12;
    const big = k % 3 === 0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = big ? 2.6 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.lineTo(x + Math.cos(a) * (r - (big ? 8 : 5.4)), cy + Math.sin(a) * (r - (big ? 8 : 5.4)));
    ctx.stroke();
  }
  // hour, minute and racing second hands
  const ha = time * 0.8 + e.seed;
  const ma = -time * 3.2;
  const sa = time * 7;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(ha) * r * 0.42, cy + Math.sin(ha) * r * 0.42);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(ma) * r * 0.66, cy + Math.sin(ma) * r * 0.66);
  ctx.stroke();
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x + Math.cos(sa) * r * 0.78, cy + Math.sin(sa) * r * 0.78);
  ctx.stroke();
  ctx.lineCap = 'butt';
  bolt(ctx, x, cy, 2.2, tone('#e5383b'));
  // eyes riding low on the face, glass cracked past half health
  if (!e.defeated) eyePair(ctx, x + fx * 2, cy + 10, 6, 4.6, fx, fy, { angry: Math.max(0.75 + windup * 0.25, rage ? 1 : 0), iris: rage ? '#ff2e2e' : '#2f6aa8', lid: blink(time, e.seed), lidColor: tone('#f4ecdc'), dead: false });
  gloss(ctx, x - r * 0.4, cy - r * 0.42, r * 0.2, r * 0.1, -0.5, 0.35);
  if (cracked) {
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, cy - r * 0.8);
    ctx.lineTo(x + r * 0.2, cy - r * 0.3);
    ctx.lineTo(x + r * 0.5, cy);
    ctx.lineTo(x + r * 0.1, cy + r * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, cy - r * 0.5);
    ctx.lineTo(x - r * 0.4, cy - r * 0.1);
    ctx.stroke();
  }
};

/** Toybox Titan: an open chest of peeking toys with a crank and a lid that means it. */
export const toybox: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const bounce = Math.abs(Math.sin(e.walkPhase)) * 2;
  const slam = (e.ai === 'slam' && !e.defeated ? 5 : 0);
  const rage = raging(e);
  // stubby bun feet
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(x + side * (hw - 6), b - 2, 4.4, 0, TAU);
    paint(ctx, tone('#6e3416'), 2.2);
  }
  // chest with trim, corner bolts and side handles
  rrect(ctx, x - hw, b - 28, hw * 2, 28, 3);
  paint(ctx, lin(ctx, 0, b - 28, 0, b, tone('#f07f3c'), tone('#d4652e'), tone('#8f3f1c')), 3);
  ctx.strokeStyle = tone('#ffd23f');
  ctx.lineWidth = 2;
  ctx.strokeRect(x - hw + 5, b - 24, hw * 2 - 10, 20);
  for (const cx of [-hw + 5, hw - 5]) {
    bolt(ctx, x + cx, b - 24, 1.6, tone('#7a4b12'));
    bolt(ctx, x + cx, b - 4, 1.6, tone('#7a4b12'));
  }
  gloss(ctx, x - hw * 0.5, b - 20, 2.2, 8, 0.1, 0.4);
  for (const side of [-1, 1] as const) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + side * hw, b - 12);
    ctx.lineTo(x + side * (hw + 5), b - 12);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // open lid, bouncing with the walk
  ctx.save();
  ctx.translate(x - hw + 3, b - 28);
  ctx.rotate(-0.5 - bounce * 0.02 - windup * 0.12);
  rrect(ctx, 0, -15, hw * 2 - 6, 14, 3);
  paint(ctx, lin(ctx, 0, -15, 0, -1, tone('#c65a28'), tone('#a84a20')), 2.6);
  ctx.strokeStyle = tone('#ffd23f');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(4, -11);
  ctx.lineTo(hw * 2 - 10, -11);
  ctx.stroke();
  ctx.restore();
  // peeking toys: a ball, a duck, a B block
  ctx.beginPath();
  ctx.arc(x - hw * 0.55, b - 34 - bounce, 7.4, 0, TAU);
  paint(ctx, rad(ctx, x - hw * 0.55 - 2, b - 37 - bounce, 0.5, 8.4, tone('#ff8a7a'), tone('#c0272b')), 2.2);
  ctx.strokeStyle = tone('#fbf6e9');
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x - hw * 0.55, b - 34 - bounce, 4.6, 0.3, 2.4);
  ctx.stroke();
  const dx = x + hw * 0.08;
  const dy = b - 36 - bounce * 1.4;
  blob(ctx, [[dx - 6, dy + 2], [dx - 7, dy - 4], [dx - 2, dy - 8], [dx + 4, dy - 7], [dx + 7, dy - 3], [dx + 5, dy + 3], [dx, dy + 5]]);
  paint(ctx, rad(ctx, dx - 2, dy - 5, 0.5, 9, tone('#ffe08a'), tone('#e0a92c')), 2.2);
  ctx.beginPath();
  ctx.moveTo(dx + 5, dy - 3);
  ctx.lineTo(dx + 10, dy - 5);
  ctx.lineTo(dx + 5, dy + 1);
  ctx.closePath();
  paint(ctx, tone('#e8743a'), 1.6);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(dx + 1, dy - 3.4, 1.2, 0, TAU);
  ctx.fill();
  const bx = x + hw * 0.44;
  const by = b - 42 - bounce * 0.7;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.sin(time * 2 + e.seed) * 0.1);
  rrect(ctx, -6, -6, 12, 12, 2);
  paint(ctx, lin(ctx, -6, -6, 6, 6, tone('#5a7fe0'), tone('#2f4fb5')), 2.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('B', 0, 3.4);
  ctx.restore();
  // crank turning steadily towards the next toy
  const crank = time * 2.2 + e.seed;
  limb(ctx, x + hw, b - 14, x + hw + 8, b - 14, 2.6, tone('#8a8a96'));
  const hx2 = x + hw + 8 + Math.cos(crank) * 6;
  const hy2 = b - 14 + Math.sin(crank) * 6;
  limb(ctx, x + hw + 8, b - 14, hx2, hy2, 2, tone('#8a8a96'));
  ctx.beginPath();
  ctx.arc(hx2, hy2, 2.8, 0, TAU);
  paint(ctx, tone('#4a4458'), 2);
  // lock-eyes and a keyhole mouth that opens for the lid slam
  if (!e.defeated) {
    eyePair(ctx, x + fx * 3, b - 16, 6.8, 4.2, fx, fy, { angry: rage ? 1 : 0.7, iris: rage ? '#ff2e2e' : '#7a4a20', lid: blink(time, e.seed), lidColor: tone('#d4652e'), dead: false });
    const gape = 2.4 + windup * 4 + slam;
    ctx.fillStyle = '#17132a';
    ctx.beginPath();
    ctx.arc(x + fx * 3, b - 6, 3.2, 0, TAU);
    ctx.fillRect(x + fx * 3 - 1.5, b - 6, 3, gape);
    ctx.fill();
  }
};

/** Dishwasher Demon: a front-loader with a storm behind glass. */
export const dishwasher: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy, windup } = p;
  const b = y + hd + 1;
  const rage = raging(e);
  // feet and the steel body with a dark control band
  for (const side of [-1, 1] as const) {
    rrect(ctx, x + side * 10 - 3.5, b - 4, 7, 4.4, 1.4);
    paint(ctx, tone('#2c3440'), 2);
  }
  rrect(ctx, x - hw, b - 58, hw * 2, 58, 4);
  paint(ctx, lin(ctx, x - hw, 0, x + hw, 0, tone('#5d7e93'), tone('#9dc2d6'), tone('#4d6a7d')), 3.2);
  rrect(ctx, x - hw, b - 58, hw * 2, 13, 4);
  paint(ctx, lin(ctx, 0, b - 58, 0, b - 45, tone('#5d7e93'), tone('#33424e')), 2.4);
  gloss(ctx, x - hw * 0.55, b - 34, 2.6, 16, 0.08, 0.5);
  for (const side of [-1, 1] as const) bolt(ctx, x + side * (hw - 4), b - 51.5, 1.5, tone('#d8dee8'));
  // dial and worried panel eyes
  const dial = time * 1.5 + e.seed;
  ctx.beginPath();
  ctx.arc(x - hw + 11, b - 51.5, 5.4, 0, TAU);
  paint(ctx, rad(ctx, x - hw + 9, b - 53.5, 0.4, 6.2, tone('#ffffff'), tone('#cfc9ba')), 2);
  ctx.strokeStyle = tone('#e5383b');
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - hw + 11, b - 51.5);
  ctx.lineTo(x - hw + 11 + Math.cos(dial) * 3.8, b - 51.5 + Math.sin(dial) * 3.8);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (!e.defeated) {
    eyePair(ctx, x + hw * 0.28 + fx * 2, b - 51.5, 5, 3.4, fx, fy, { angry: rage ? 1 : 0.3, lid: Math.max(0.35, blink(time, e.seed)), iris: rage ? '#ff2e2e' : '#3a6ea8', lidColor: tone('#9dc2d6'), dead: false });
    brow(ctx, x + hw * 0.28 - 10, b - 59, x + hw * 0.28 - 2, b - 56.4, 2.2);
    brow(ctx, x + hw * 0.28 + 10, b - 59, x + hw * 0.28 + 2, b - 56.4, 2.2);
  }
  // porthole: dark glass, spinning spray arcs, tumbling plates
  ctx.beginPath();
  ctx.arc(x, b - 26, 16, 0, TAU);
  paint(ctx, rad(ctx, x - 4, b - 30, 1, 18, tone('#2a3f52'), tone('#101821')), 3.2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, b - 26, 13.4, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = 'rgba(159, 216, 232, 0.9)';
  ctx.lineWidth = 2.2;
  for (let k = 0; k < 2; k++) {
    const a0 = time * 4 + k * Math.PI + e.seed;
    ctx.beginPath();
    ctx.arc(x, b - 26, 6 + k * 4, a0, a0 + 2.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(251, 246, 233, 0.85)';
  for (let k = 0; k < 2; k++) {
    const a = -time * 3 + k * Math.PI * 0.9 + e.seed;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 8, b - 26 + Math.sin(a) * 8, 4.2, 2.6, a, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, b - 26, 16, Math.PI * 1.1, Math.PI * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // the vent drips and a whimpering mouth
  if (!e.defeated) puffs(ctx, x, b - 3, time, e.seed, '159, 216, 232', 3, 8);
  if (!e.defeated) maw(ctx, x + fx * 3, b - 7.5, 4.6, 1.6 + windup * 3, 3, '#ffffff', '#7fb0e0');
};

/** King of Cardboard in three coronations: tank, chopper, robot. */
export const cardboard: BossBody = (ctx, e, x, y, time, p) => {
  const { hw, hd, tone, fx, fy } = p;
  const b = y + hd + 1;
  const form = ((e.form % 3) + 3) % 3;
  const rage = raging(e);
  const KRAFT = (x0: number): CanvasGradient => lin(ctx, x0 - hw, 0, x0 + hw, 0, tone('#8a6538'), tone('#d9b77c'), tone('#9c7446'));
  if (form === 0) {
    // TANK: low hull, turret, an aiming barrel, treads
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.ellipse(x + side * hw * 0.55, b - 7, hw * 0.5, 9.5, 0, 0, TAU);
      paint(ctx, tone('#2a2530'), 2.8);
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(x + side * hw * 0.55 + k * 9 + Math.sin(e.walkPhase * 2) * 2, b - 7, 3, 0, TAU);
        paint(ctx, tone('#7a5f36'), 1.6);
      }
    }
    ctx.beginPath();
    ctx.ellipse(x, b - 22, hw, 13.5, 0, 0, TAU);
    paint(ctx, lin(ctx, 0, b - 36, 0, b - 8, tone('#e0bd85'), tone('#c9a070'), tone('#8a6538')), 3);
    ctx.strokeStyle = tone('#e5383b');
    ctx.lineWidth = 2;
    ctx.font = '700 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = tone('#e5383b');
    ctx.fillText('★', x + hw * 0.4, b - 16);
    ctx.strokeStyle = 'rgba(110, 82, 46, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - hw + 4, b - 28);
    ctx.lineTo(x + hw - 4, b - 28);
    ctx.stroke();
    const aim = Math.atan2(fy, fx);
    ctx.beginPath();
    ctx.arc(x - fx * 2, b - 32, 11.5, 0, TAU);
    paint(ctx, KRAFT(x), 3);
    bolt(ctx, x - fx * 2 - 6, b - 36, 1.5, tone('#6e522e'));
    bolt(ctx, x - fx * 2 + 6, b - 36, 1.5, tone('#6e522e'));
    ctx.save();
    ctx.translate(x - fx * 2, b - 32);
    ctx.rotate(aim);
    rrect(ctx, 0, -3.6, hw + 13, 7.2, 2.4);
    paint(ctx, lin(ctx, 0, -3.6, 0, 3.6, tone('#8a6538'), tone('#5c431f')), 2.4);
    rrect(ctx, hw + 8, -4.6, 6, 9.2, 2);
    paint(ctx, tone('#3a2f1c'), 2);
    ctx.restore();
    if (!e.defeated) eyePair(ctx, x - fx * 2, b - 33, 5, 3.4, fx, fy, { angry: rage ? 1 : 0.85, iris: rage ? '#ff2e2e' : '#2a1f10', lid: blink(time, e.seed), lidColor: tone('#c9a070'), dead: false });
    gloss(ctx, x - hw * 0.4, b - 28, 5, 2, -0.2, 0.4);
  } else if (form === 1) {
    // CHOPPER: hovering cabin, tail boom, spinning rotor, skids
    const hover = Math.sin(time * 3.4 + e.seed) * 3;
    const cy = b - 34 + hover;
    for (const side of [-1, 1] as const) {
      limb(ctx, x + side * 8, b - 16, x + side * 12, b - 2, 2.6, tone('#6e522e'));
      limb(ctx, x + side * 12, b - 2, x + side * 18, b - 2, 2.6, tone('#6e522e'));
    }
    limb(ctx, x - hw + 2, cy + 2, x - hw - 16, cy - 8, 4.4, tone('#9c7446'));
    rrect(ctx, x - hw - 22, cy - 13, 9, 10, 2);
    paint(ctx, KRAFT(x), 2);
    ctx.strokeStyle = 'rgba(34, 27, 54, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - hw - 17.5, cy - 8);
    ctx.lineTo(x - hw - 17.5, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, cy, hw * 0.72, 13.5, 0, 0, TAU);
    paint(ctx, lin(ctx, 0, cy - 14, 0, cy + 14, tone('#e0bd85'), tone('#c9a070'), tone('#8a6538')), 3);
    ctx.fillStyle = 'rgba(110, 82, 46, 0.55)';
    for (let k = 0; k < 3; k++) ctx.fillRect(x - hw * 0.72 + 4, cy - 8 + k * 6, hw * 1.44 - 8, 1.6);
    const spin = time * 16 + e.seed;
    ctx.fillStyle = 'rgba(34, 27, 54, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, cy - 17, hw + 8, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(x, cy - 17);
    ctx.rotate(Math.sin(spin * 0.2) * 0.06);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - (x + hw + 6), 0);
    ctx.lineTo(hw + 6, 0);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
    bolt(ctx, x, cy - 17, 2.4, tone('#6e522e'));
    gloss(ctx, x - hw * 0.3, cy - 6, 6, 2.2, -0.2, 0.4);
    if (!e.defeated) {
      rrect(ctx, x - 3, cy - 5, 18, 10, 2);
      paint(ctx, rad(ctx, x + 2, cy - 3, 0.5, 11, tone('#c8f2ff'), tone('#4a9ab5')), 2.2);
      eyePair(ctx, x + 6, cy, 4.6, 3, fx, fy, { angry: rage ? 1 : 0.8, iris: rage ? '#ff2e2e' : '#16323e', lid: blink(time, e.seed + 0.4), lidColor: tone('#c9a070'), dead: false });
    }
  } else {
    // ROBOT: stompy legs, crate torso, glowing visor, a cannon arm
    const raise = e.hurlProgress;
    for (const side of [-1, 1] as const) {
      const step = Math.sin(e.walkPhase + (side > 0 ? Math.PI : 0)) * 3;
      limb(ctx, x + side * 7, b - 26, x + side * 9, b - 12 + step * 0.4, 6, tone('#9c7446'));
      rrect(ctx, x + side * 9 - 6, b - 8 + step * 0.4, 12, 6, 2);
      paint(ctx, lin(ctx, 0, b - 8, 0, b - 2, tone('#8a6538'), tone('#5c431f')), 2.2);
    }
    rrect(ctx, x - 14, b - 42, 28, 26, 3);
    paint(ctx, KRAFT(x), 3);
    rrect(ctx, x - 14, b - 27, 28, 6, 2);
    paint(ctx, tone('#6e522e'), 2);
    bolt(ctx, x - 9, b - 37, 1.6, tone('#6e522e'));
    bolt(ctx, x + 9, b - 37, 1.6, tone('#6e522e'));
    ctx.fillStyle = tone('#e5383b');
    ctx.font = '700 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('01', x, b - 13);
    rrect(ctx, x - 12, b - 59, 24, 16, 3);
    paint(ctx, tone('#2a2530'), 2.8);
    if (!e.defeated) {
      ctx.fillStyle = 'rgba(255, 90, 78, 0.3)';
      ctx.fillRect(x - 12, b - 59, 24, 16);
      const glow = Math.min(1, (rage ? 0.95 : 0.7) + Math.sin(time * 5 + e.seed) * 0.3);
      ctx.fillStyle = `rgba(255, 90, 78, ${glow})`;
      ctx.beginPath();
      ctx.arc(x - 4 + fx * 2, b - 51, 2.8, 0, TAU);
      ctx.arc(x + 4 + fx * 2, b - 51, 2.8, 0, TAU);
      ctx.fill();
    }
    limb(ctx, x - 14, b - 34, x - 20, b - 26, 5.4, tone('#9c7446'));
    fist(ctx, x - 21, b - 25, 4, tone('#c9a070'), -1);
    const cx = x + 15 + fx * 4;
    const cyy = b - 36 - raise * 12;
    limb(ctx, x + 14, b - 34, cx, cyy, 5.4, tone('#9c7446'));
    rrect(ctx, cx - 2, cyy - 5, 18, 10, 2.4);
    paint(ctx, lin(ctx, 0, cyy - 5, 0, cyy + 5, tone('#6e6a72'), tone('#3a3640')), 2.4);
    ctx.beginPath();
    ctx.arc(cx + 16, cyy, 5, 0, TAU);
    paint(ctx, tone('#241f28'), 2.2);
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(cx + 16, cyy, 2, 0, TAU);
    ctx.fill();
  }
}


