// Procedural zombie body-part painter. Every look is painted into one shared
// atlas so all zombies batch into a single texture. Parts are drawn facing the
// camera (enemies walk toward the player) and articulated by rendering/ZombieRig.

import {
  AtlasBuilder, Rng, bloodStain, cylinderGradient, hex, mulberry32, rand, scratches, shadeColor, speckle, softCircle,
} from './CanvasUtil';

export const ZOMBIE_ATLAS = 'zombie_atlas';

export interface PartSpec { w: number; h: number; ox: number; oy: number; }

export const PART: Record<'head' | 'torso' | 'bloatTorso' | 'upperArm' | 'foreArm' | 'hand' | 'thigh' | 'shin', PartSpec> = {
  head: { w: 64, h: 82, ox: 0.5, oy: 0.93 },
  torso: { w: 112, h: 168, ox: 0.5, oy: 0.97 },
  bloatTorso: { w: 180, h: 192, ox: 0.5, oy: 0.97 },
  upperArm: { w: 32, h: 92, ox: 0.5, oy: 0.06 },
  foreArm: { w: 28, h: 88, ox: 0.5, oy: 0.06 },
  hand: { w: 40, h: 48, ox: 0.5, oy: 0.12 },
  thigh: { w: 44, h: 110, ox: 0.5, oy: 0.05 },
  shin: { w: 42, h: 116, ox: 0.5, oy: 0.04 },
};

/** Joint lengths in reference pixels, measured on the painted parts. */
export const LEN = { torso: 156, bloatTorso: 178, upperArm: 78, foreArm: 74, thigh: 100, shin: 98, head: 72 };

type HeadStyle = 'normal' | 'scream' | 'helmet' | 'bloat';
type TorsoStyle = 'shirt' | 'jacket' | 'flannel' | 'hoodie' | 'tank' | 'armor' | 'bloat';
type SleeveStyle = 'long' | 'short' | 'bare' | 'armor';

interface Look {
  key: string;
  skin: number;
  cloth: number;
  pants: number;
  shoe: number;
  hair: number;
  head: HeadStyle;
  torso: TorsoStyle;
  sleeve: SleeveStyle;
  sneakers?: boolean;
}

const LOOKS: Look[] = [
  { key: 'shambler_0', skin: 0x767c6a, cloth: 0x6c675a, pants: 0x2e3542, shoe: 0x2a2420, hair: 0x2a221c, head: 'normal', torso: 'shirt', sleeve: 'short' },
  { key: 'shambler_1', skin: 0x7e7d6b, cloth: 0x34322e, pants: 0x4a4436, shoe: 0x221d19, hair: 0x4a4038, head: 'normal', torso: 'jacket', sleeve: 'long' },
  { key: 'shambler_2', skin: 0x6f7764, cloth: 0x58302a, pants: 0x2e3340, shoe: 0x2b2622, hair: 0x15110e, head: 'normal', torso: 'flannel', sleeve: 'long' },
  { key: 'runner_0', skin: 0x857f70, cloth: 0x454e56, pants: 0x29292c, shoe: 0x8d8a80, hair: 0x1a1512, head: 'scream', torso: 'hoodie', sleeve: 'long', sneakers: true },
  { key: 'runner_1', skin: 0x7b7565, cloth: 0x5f594b, pants: 0x4a3c33, shoe: 0x77746c, hair: 0x3b2d22, head: 'scream', torso: 'tank', sleeve: 'bare', sneakers: true },
  { key: 'plated_0', skin: 0x737868, cloth: 0x1d2024, pants: 0x22262d, shoe: 0x141416, hair: 0x111111, head: 'helmet', torso: 'armor', sleeve: 'armor' },
  { key: 'plated_1', skin: 0x7c7e6d, cloth: 0x272c31, pants: 0x2a2e26, shoe: 0x141416, hair: 0x111111, head: 'helmet', torso: 'armor', sleeve: 'armor' },
  { key: 'carrier_0', skin: 0x7c7a5c, cloth: 0x6f6a58, pants: 0x3a3a33, shoe: 0x2a2420, hair: 0x2a221c, head: 'bloat', torso: 'bloat', sleeve: 'bare' },
  { key: 'crawler_0', skin: 0x6b7062, cloth: 0x4b4a40, pants: 0x2f2f2c, shoe: 0x22201d, hair: 0x1a1512, head: 'scream', torso: 'shirt', sleeve: 'bare' },
];

const OUTLINE = 'rgba(16,12,10,0.78)';

function path(ctx: CanvasRenderingContext2D, pts: number[][], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else ctx.lineTo(p[0], p[1]);
  }
  if (close) ctx.closePath();
}

function vShade(ctx: CanvasRenderingContext2D, y0: number, y1: number, topA: number, botA: number, w: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(255,255,240,${topA})`);
  g.addColorStop(0.4, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${botA})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
}

// ---------------------------------------------------------------- head

function paintHead(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const cx = w / 2;
  const bloat = L.head === 'bloat';
  const cy = bloat ? h * 0.5 : h * 0.44;
  const rx = bloat ? 21 : 24, ry = bloat ? 25 : 30;
  const skin = L.skin;

  // neck
  ctx.fillStyle = cylinderGradient(ctx, cx - 12, cx + 12, shadeColor(skin, -0.18));
  ctx.fillRect(cx - 11, cy + ry * 0.55, 22, h - (cy + ry * 0.55));
  ctx.strokeStyle = 'rgba(30,20,20,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy + ry * 0.7); ctx.lineTo(cx - 3, h);
  ctx.moveTo(cx + 5, cy + ry * 0.7); ctx.lineTo(cx + 3, h);
  ctx.stroke();

  // skull silhouette: dome, cheekbones, narrow jaw
  const headPath = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.bezierCurveTo(cx + rx * 1.1, cy - ry, cx + rx * 1.05, cy - 2, cx + rx * 0.98, cy + 4);
    ctx.bezierCurveTo(cx + rx * 0.9, cy + ry * 0.55, cx + rx * 0.45, cy + ry * 0.98, cx, cy + ry);
    ctx.bezierCurveTo(cx - rx * 0.45, cy + ry * 0.98, cx - rx * 0.9, cy + ry * 0.55, cx - rx * 0.98, cy + 4);
    ctx.bezierCurveTo(cx - rx * 1.05, cy - 2, cx - rx * 1.1, cy - ry, cx, cy - ry);
    ctx.closePath();
  };
  ctx.save();
  headPath();
  ctx.clip();
  const g = ctx.createRadialGradient(cx - 7, cy - 10, 3, cx, cy, ry * 1.25);
  g.addColorStop(0, hex(shadeColor(skin, 0.06)));
  g.addColorStop(0.5, hex(shadeColor(skin, -0.12)));
  g.addColorStop(1, hex(shadeColor(skin, -0.62)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // mottling, veins
  speckle(ctx, rng, cx - rx, cy - ry, rx * 2, ry * 2, 70, '#3b4a3a', 2.4, 0.05, 0.2);
  speckle(ctx, rng, cx - rx, cy - ry, rx * 2, ry * 2, 30, '#5a2e3a', 1.6, 0.05, 0.25);
  ctx.strokeStyle = 'rgba(70,40,70,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const sx = cx + (i < 2 ? -1 : 1) * rand(rng, rx * 0.5, rx * 0.85);
    ctx.beginPath();
    ctx.moveTo(sx, cy - rand(rng, 4, 16));
    ctx.quadraticCurveTo(sx + rand(rng, -5, 5), cy - rand(rng, -4, 6), sx + rand(rng, -6, 6), cy + rand(rng, 0, 10));
    ctx.stroke();
  }
  // cheek hollows
  softCircle(ctx, cx - rx * 0.62, cy + 9, 9, 'rgba(20,24,18,0.45)', 'rgba(20,24,18,0)');
  softCircle(ctx, cx + rx * 0.62, cy + 9, 9, 'rgba(20,24,18,0.5)', 'rgba(20,24,18,0)');
  if (bloat) {
    for (let i = 0; i < 6; i++) pustule(ctx, rng, cx + rand(rng, -rx * 0.8, rx * 0.8), cy + rand(rng, -ry * 0.4, ry * 0.7), rand(rng, 2, 4));
  }
  // brow shadow + sockets
  softCircle(ctx, cx, cy - 8, rx * 0.9, 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0)');
  for (const s of [-1, 1]) {
    const ex = cx + s * 9.5, ey = cy - 3;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(1, 0.78);
    softCircle(ctx, 0, 0, 11, 'rgba(8,5,5,1)', 'rgba(25,18,14,0)');
    softCircle(ctx, 0, 0, 6.5, 'rgba(4,2,2,0.95)', 'rgba(8,5,5,0)');
    ctx.restore();
    // clouded eye, slightly mismatched
    const off = s * rand(rng, -1.2, 1.2);
    softCircle(ctx, ex + off, ey + 0.8, 2.1, 'rgba(196,192,150,0.9)', 'rgba(150,148,120,0)');
    ctx.fillStyle = 'rgba(40,30,20,0.6)';
    ctx.beginPath();
    ctx.arc(ex + off + s * 0.4, ey + 0.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // rotted nose cavity
  ctx.fillStyle = 'rgba(18,10,8,0.85)';
  path(ctx, [[cx - 3.5, cy + 4], [cx + 3.5, cy + 4], [cx + 1.5, cy + 10], [cx - 1.5, cy + 10]]);
  ctx.fill();
  // slack, dislocated jaw: dark irregular gash with broken teeth
  const scream = L.head === 'scream';
  const my = cy + (scream ? 16 : 16.5);
  const mw = scream ? 9.5 : 8.5, mh = scream ? 10 : 6.5;
  const skew = rand(rng, -2, 2);
  ctx.fillStyle = '#0c0505';
  ctx.beginPath();
  ctx.moveTo(cx - mw, my - mh * 0.3);
  ctx.quadraticCurveTo(cx - mw * 0.4, my - mh * 0.75, cx + skew, my - mh * 0.55);
  ctx.quadraticCurveTo(cx + mw * 0.6, my - mh * 0.7, cx + mw, my - mh * 0.2);
  ctx.quadraticCurveTo(cx + mw * 0.7, my + mh, cx + skew * 0.5, my + mh * 1.05);
  ctx.quadraticCurveTo(cx - mw * 0.8, my + mh * 0.9, cx - mw, my - mh * 0.3);
  ctx.fill();
  ctx.fillStyle = '#8e8466';
  for (let i = 0; i < 6; i++) {
    if (rng() < 0.35) continue;
    const tx = cx - mw * 0.7 + (i / 5) * mw * 1.4;
    ctx.globalAlpha = rand(rng, 0.6, 0.95);
    ctx.fillRect(tx - 0.8, my - mh * 0.55, 1.6, rand(rng, 1.5, 3.4));
    if (rng() < 0.5) ctx.fillRect(tx - 0.8, my + mh * 0.75, 1.6, -rand(rng, 1.2, 2.6));
  }
  ctx.globalAlpha = 1;
  // gaunt lip shadow and torn cheek
  softCircle(ctx, cx, my + mh, mw * 1.1, 'rgba(20,10,8,0.35)', 'rgba(20,10,8,0)');
  if (rng() < 0.6) {
    const side = rng() < 0.5 ? -1 : 1;
    ctx.fillStyle = 'rgba(60,10,8,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx + side * (mw + 3), my - 1, 3.5, 2.2, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // dried blood from mouth, wound on scalp
  bloodStain(ctx, rng, cx + rand(rng, -3, 3), my + 4, 6, 3, 0.7);
  bloodStain(ctx, rng, cx + rand(rng, -rx * 0.6, rx * 0.6), cy - ry * 0.55, rand(rng, 4, 7), 2, 0.55);
  // hair
  if (L.head !== 'helmet') {
    ctx.strokeStyle = hex(L.hair, 0.85);
    ctx.lineCap = 'round';
    for (let i = 0; i < (bloat ? 8 : 46); i++) {
      const a = rand(rng, Math.PI * 1.08, Math.PI * 1.92);
      const r0 = ry * rand(rng, 0.6, 1.02);
      const x0 = cx + Math.cos(a) * rx * (r0 / ry), y0 = cy + Math.sin(a) * r0 * 0.98;
      if (rng() < 0.18) continue; // bald patches
      ctx.lineWidth = rand(rng, 0.8, 2);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + rand(rng, -4, 4), y0 + rand(rng, 3, 8), x0 + rand(rng, -5, 5), y0 + rand(rng, 6, 15));
      ctx.stroke();
    }
  }
  // grime and a dark lower-face falloff
  const fall = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  fall.addColorStop(0, 'rgba(0,0,0,0)');
  fall.addColorStop(1, 'rgba(10,8,6,0.35)');
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, rng, cx - rx, cy - ry, rx * 2, ry * 2, 90, '#120e0a', 1.4, 0.08, 0.3);
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  headPath();
  ctx.stroke();

  if (L.head === 'helmet') paintHelmet(ctx, cx, cy, rx, ry, rng);
}

function paintHelmet(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rng: Rng): void {
  // shell
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.22, cy + 3);
  ctx.bezierCurveTo(cx - rx * 1.3, cy - ry * 1.35, cx + rx * 1.3, cy - ry * 1.35, cx + rx * 1.22, cy + 3);
  ctx.lineTo(cx + rx * 1.1, cy + 9);
  ctx.lineTo(cx - rx * 1.1, cy + 9);
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - 8, cy - ry * 0.7, 2, cx, cy - ry * 0.3, rx * 1.5);
  g.addColorStop(0, '#5a6170');
  g.addColorStop(0.35, '#2a2f38');
  g.addColorStop(1, '#0d0f12');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.clip();
  scratches(ctx, rng, cx - rx, cy - ry * 1.2, rx * 2, ry, 18, '#9aa0a8', 6, 0.25);
  ctx.restore();
  // visor: smoked polycarbonate, cracked
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.05, cy - 12);
  ctx.quadraticCurveTo(cx, cy - 16, cx + rx * 1.05, cy - 12);
  ctx.lineTo(cx + rx * 0.98, cy + 11);
  ctx.quadraticCurveTo(cx, cy + 14, cx - rx * 0.98, cy + 11);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30,40,48,0.55)';
  ctx.fill();
  ctx.clip();
  const sh = ctx.createLinearGradient(cx - rx, cy - 12, cx + rx * 0.2, cy + 8);
  sh.addColorStop(0, 'rgba(200,215,225,0.35)');
  sh.addColorStop(0.5, 'rgba(200,215,225,0.04)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(cx - rx * 1.2, cy - 16, rx * 2.4, 32);
  // cracks radiating from impact
  const ix = cx + rand(rng, -6, 6), iy = cy - 2;
  ctx.strokeStyle = 'rgba(225,232,236,0.75)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2;
    let x = ix, y = iy;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += Math.cos(a + rand(rng, -0.4, 0.4)) * rand(rng, 3, 8);
      y += Math.sin(a + rand(rng, -0.4, 0.4)) * rand(rng, 3, 8);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(5,5,5,0.85)';
  ctx.beginPath();
  ctx.arc(ix, iy, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,10,12,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.05, cy - 12);
  ctx.quadraticCurveTo(cx, cy - 16, cx + rx * 1.05, cy - 12);
  ctx.stroke();
}

function pustule(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, r: number): void {
  softCircle(ctx, x, y, r * 1.8, 'rgba(120,60,50,0.45)', 'rgba(120,60,50,0)');
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.2, x, y, r);
  g.addColorStop(0, 'rgba(240,230,170,0.95)');
  g.addColorStop(0.6, 'rgba(190,170,90,0.9)');
  g.addColorStop(1, 'rgba(110,90,50,0.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (rng() < 0.4) {
    ctx.fillStyle = 'rgba(40,20,10,0.8)';
    ctx.beginPath();
    ctx.arc(x + r * 0.2, y + r * 0.1, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- torso

function paintTorso(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const cx = w / 2;
  if (L.torso === 'bloat') return paintBloatTorso(ctx, w, h, rng, L);
  const sw = L.torso === 'armor' ? 52 : 47, ww = L.torso === 'armor' ? 40 : 35;
  const top = 6, bot = h - 4;
  const outlinePts = [
    [cx - 13, top], [cx - sw + 10, top + 8], [cx - sw - 2, top + 10, cx - sw, top + 26], [cx - sw + 5, top + 62],
    [cx - ww, bot - 32], [cx - ww - 2, bot], [cx + ww + 2, bot], [cx + ww, bot - 32], [cx + sw - 5, top + 62],
    [cx + sw, top + 26], [cx + sw + 2, top + 10, cx + sw - 10, top + 8], [cx + 13, top],
  ];
  // skin underneath for tank tops (bare shoulders)
  ctx.save();
  path(ctx, outlinePts);
  ctx.clip();
  ctx.fillStyle = cylinderGradient(ctx, cx - sw, cx + sw, L.skin, 0.15, 0.5);
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, rng, 0, 0, w, h, 120, '#2c3a2c', 2.2, 0.05, 0.2);

  const cloth = L.cloth;
  ctx.fillStyle = cylinderGradient(ctx, cx - sw, cx + sw, cloth, 0.14, 0.75);
  if (L.torso === 'tank') {
    path(ctx, [[cx - 26, top + 2], [cx - 18, top + 2], [cx - 10, top + 34], [cx + 10, top + 34], [cx + 18, top + 2], [cx + 26, top + 2],
      [cx + 30, top + 60], [cx + ww + 2, bot], [cx - ww - 2, bot], [cx - 30, top + 60]]);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, w, h);
    // collar opening
    ctx.fillStyle = cylinderGradient(ctx, cx - 14, cx + 14, shadeColor(L.skin, -0.1));
    path(ctx, [[cx - 13, top - 1], [cx + 13, top - 1], [cx + 3, top + (L.torso === 'armor' ? 12 : 30)], [cx - 3, top + (L.torso === 'armor' ? 12 : 30)]]);
    ctx.fill();
  }

  if (L.torso === 'flannel') {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#1b0f0c';
    for (let x = 4; x < w; x += 15) ctx.fillRect(x, 0, 4, h);
    for (let y = 4; y < h; y += 15) ctx.fillRect(0, y, w, 4);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#e8d8b0';
    for (let x = 11; x < w; x += 15) ctx.fillRect(x, 0, 1.4, h);
    ctx.globalAlpha = 1;
  }
  if (L.torso === 'jacket') {
    ctx.fillStyle = 'rgba(160,150,130,0.55)';
    ctx.fillRect(cx - 7, top + 20, 14, bot - top - 20);
    ctx.strokeStyle = 'rgba(10,10,10,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, top + 10); ctx.lineTo(cx - 8, bot);
    ctx.moveTo(cx + 8, top + 10); ctx.lineTo(cx + 8, bot);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    path(ctx, [[cx - 14, top], [cx - 30, top + 6], [cx - 9, top + 40]]); ctx.fill();
    path(ctx, [[cx + 14, top], [cx + 30, top + 6], [cx + 9, top + 40]]); ctx.fill();
  }
  if (L.torso === 'hoodie') {
    ctx.fillStyle = cylinderGradient(ctx, cx - 30, cx + 30, shadeColor(cloth, -0.1), 0.2, 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, top + 6, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, top + 5, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    path(ctx, [[cx - 26, bot - 58], [cx + 26, bot - 58], [cx + 32, bot - 22], [cx - 32, bot - 22]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,205,190,0.6)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - 6, top + 14); ctx.lineTo(cx - 7, top + 44);
    ctx.moveTo(cx + 6, top + 14); ctx.lineTo(cx + 8, top + 40);
    ctx.stroke();
  }
  if (L.torso === 'shirt') {
    ctx.fillStyle = 'rgba(30,26,20,0.7)';
    for (let y = top + 36; y < bot - 30; y += 20) {
      ctx.beginPath();
      ctx.arc(cx + 1, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (L.torso === 'armor') {
    // chest plate + webbing
    ctx.fillStyle = cylinderGradient(ctx, cx - 40, cx + 40, 0x2c3138, 0.22, 0.6);
    path(ctx, [[cx - 38, top + 14], [cx + 38, top + 14], [cx + 36, top + 92], [cx + 28, top + 104], [cx - 28, top + 104], [cx - 36, top + 92]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(14,16,18,0.9)';
    for (let y = top + 70; y < top + 100; y += 9) ctx.fillRect(cx - 34, y, 68, 4.5);
    ctx.fillStyle = 'rgba(200,200,190,0.55)';
    ctx.fillRect(cx - 20, top + 30, 40, 9);
    ctx.fillStyle = 'rgba(20,20,20,0.85)';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('RIOT', cx, top + 37.5);
    scratches(ctx, rng, cx - 40, top + 10, 80, 100, 30, '#b5b8bb', 7, 0.3);
    // dent / bullet strikes on the plate
    for (let i = 0; i < 4; i++) {
      const px = cx + rand(rng, -30, 30), py = top + rand(rng, 20, 90);
      softCircle(ctx, px, py, 3, 'rgba(180,180,170,0.6)', 'rgba(180,180,170,0)');
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.arc(px, py, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // tears showing rotten skin and ribs (not on armour)
  if (L.torso !== 'armor') {
    const holes = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < holes; i++) {
      const hx = cx + rand(rng, -sw * 0.6, sw * 0.6), hy = rand(rng, top + 40, bot - 40);
      const hr = rand(rng, 7, 14);
      const pts: number[][] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        pts.push([hx + Math.cos(a) * hr * rand(rng, 0.5, 1.2), hy + Math.sin(a) * hr * rand(rng, 0.4, 0.9)]);
      }
      path(ctx, pts);
      ctx.fillStyle = hex(shadeColor(L.skin, -0.25));
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(40,20,18,0.6)';
      ctx.lineWidth = 1.4;
      for (let r = -2; r <= 2; r++) {
        ctx.beginPath();
        ctx.moveTo(hx - hr, hy + r * 5);
        ctx.quadraticCurveTo(hx, hy + r * 5 - 3, hx + hr, hy + r * 5);
        ctx.stroke();
      }
      bloodStain(ctx, rng, hx, hy, hr * 0.7, 0, 0.6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(20,14,10,0.55)';
      ctx.lineWidth = 1;
      path(ctx, pts);
      ctx.stroke();
    }
  }
  // grime + blood
  speckle(ctx, rng, 0, 0, w, h, 160, '#1e1a14', 2.6, 0.05, 0.22);
  scratches(ctx, rng, 0, 0, w, h, 40, '#15110d', 10, 0.25, true);
  bloodStain(ctx, rng, cx + rand(rng, -10, 10), top + 24, rand(rng, 12, 18), 4, 0.75);
  if (rng() < 0.7) bloodStain(ctx, rng, cx + rand(rng, -30, 30), rand(rng, 60, 120), rand(rng, 8, 14), 3, 0.6);
  vShade(ctx, 0, h, 0.05, 0.55, w);
  // filth patches
  for (let i = 0; i < 6; i++) softCircle(ctx, cx + rand(rng, -sw, sw), rand(rng, top + 20, bot), rand(rng, 8, 20), 'rgba(30,24,16,0.35)', 'rgba(30,24,16,0)');
  // belt
  if (L.torso !== 'armor' && L.torso !== 'tank') {
    ctx.fillStyle = '#1a1612';
    ctx.fillRect(0, bot - 13, w, 9);
    ctx.fillStyle = '#6d6450';
    ctx.fillRect(cx - 5, bot - 13, 10, 9);
  }
  // ragged hem
  ctx.globalCompositeOperation = 'destination-out';
  for (let x = cx - ww - 4; x < cx + ww + 4; x += rand(rng, 4, 9)) {
    if (rng() < 0.5) continue;
    path(ctx, [[x, bot + 1], [x + rand(rng, 2, 5), bot - rand(rng, 3, 10)], [x + rand(rng, 5, 9), bot + 1]]);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  path(ctx, outlinePts);
  ctx.stroke();
}

function paintBloatTorso(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const cx = w / 2, top = 8, bot = h - 5;
  const pts = [
    [cx - 14, top], [cx - 44, top + 8], [cx - 60, top + 16, cx - 62, top + 34], [cx - 84, top + 90, cx - 80, top + 130],
    [cx - 74, bot - 18, cx - 46, bot], [cx + 46, bot], [cx + 74, bot - 18, cx + 80, top + 130], [cx + 84, top + 90, cx + 62, top + 34],
    [cx + 60, top + 16, cx + 44, top + 8], [cx + 14, top],
  ];
  ctx.save();
  path(ctx, pts);
  ctx.clip();
  const g = ctx.createRadialGradient(cx - 22, top + 80, 10, cx, top + 100, 110);
  g.addColorStop(0, hex(shadeColor(L.skin, 0.12)));
  g.addColorStop(0.45, hex(shadeColor(L.skin, -0.08)));
  g.addColorStop(1, hex(shadeColor(L.skin, -0.72)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // stretch marks and veins
  ctx.strokeStyle = 'rgba(120,70,80,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const x = cx + rand(rng, -70, 70), y = rand(rng, top + 50, bot - 20);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + rand(rng, -6, 6), y + 8, x + rand(rng, -10, 10), y + rand(rng, 12, 22));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(50,40,90,0.55)';
  for (let i = 0; i < 18; i++) {
    let x = cx + rand(rng, -60, 60), y = rand(rng, top + 30, bot - 30);
    ctx.lineWidth = rand(rng, 0.8, 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += rand(rng, -10, 10); y += rand(rng, -9, 9);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // belly button
  softCircle(ctx, cx + 4, top + 128, 5, 'rgba(40,24,16,0.85)', 'rgba(40,24,16,0)');
  // open sores with something moving inside (dark lumps)
  for (let i = 0; i < 2; i++) {
    const sx = cx + rand(rng, -45, 45), sy = rand(rng, top + 70, bot - 40), sr = rand(rng, 7, 11);
    softCircle(ctx, sx, sy, sr * 1.6, 'rgba(110,40,30,0.55)', 'rgba(110,40,30,0)');
    ctx.fillStyle = '#2a0d08';
    ctx.beginPath();
    ctx.ellipse(sx, sy, sr, sr * 0.7, rand(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(${rand(rng, 120, 170)},${rand(rng, 110, 140)},80,0.9)`;
      ctx.beginPath();
      ctx.arc(sx + rand(rng, -sr * 0.5, sr * 0.5), sy + rand(rng, -sr * 0.3, sr * 0.3), rand(rng, 1.5, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 9; i++) pustule(ctx, rng, cx + rand(rng, -62, 62), rand(rng, top + 40, bot - 30), rand(rng, 1.5, 3.2));
  // torn shirt remnant around chest
  ctx.fillStyle = cylinderGradient(ctx, cx - 70, cx + 70, L.cloth, 0.15, 0.6);
  path(ctx, [[cx - 70, top + 4], [cx + 70, top + 4], [cx + 66, top + 46], [cx + 40, top + 40], [cx + 20, top + 58], [cx - 6, top + 44], [cx - 30, top + 62], [cx - 66, top + 48]]);
  ctx.fill();
  speckle(ctx, rng, 0, 0, w, h, 200, '#3a3018', 3, 0.05, 0.2);
  bloodStain(ctx, rng, cx - 10, top + 30, 16, 4, 0.7);
  vShade(ctx, 0, h, 0.06, 0.4, w);
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  path(ctx, pts);
  ctx.stroke();
}

// ---------------------------------------------------------------- limbs

function taper(ctx: CanvasRenderingContext2D, cx: number, y0: number, y1: number, w0: number, w1: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - w0 / 2, y0 + w0 * 0.25);
  ctx.quadraticCurveTo(cx - w0 / 2, y0, cx, y0);
  ctx.quadraticCurveTo(cx + w0 / 2, y0, cx + w0 / 2, y0 + w0 * 0.25);
  ctx.lineTo(cx + w1 / 2, y1 - w1 * 0.3);
  ctx.quadraticCurveTo(cx + w1 / 2, y1, cx, y1);
  ctx.quadraticCurveTo(cx - w1 / 2, y1, cx - w1 / 2, y1 - w1 * 0.3);
  ctx.closePath();
}

function fillLimb(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, base: number, y0: number, y1: number, w0: number, w1: number, grime = 50): void {
  const cx = w / 2;
  ctx.save();
  taper(ctx, cx, y0, y1, w0, w1);
  ctx.clip();
  ctx.fillStyle = cylinderGradient(ctx, cx - w0 / 2, cx + w0 / 2, base, 0.14, 0.72);
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, rng, 0, 0, w, h, grime, '#1a1712', 2, 0.05, 0.25);
  ctx.restore();
}

function strokeLimb(ctx: CanvasRenderingContext2D, w: number, y0: number, y1: number, w0: number, w1: number): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  taper(ctx, w / 2, y0, y1, w0, w1);
  ctx.stroke();
}

function paintUpperArm(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const y0 = 3, y1 = h - 4;
  const thick = L.torso === 'bloat' ? 0.8 : 1;
  const w0 = 29 * thick, w1 = 19 * thick;
  const base = L.sleeve === 'bare' ? L.skin : L.sleeve === 'armor' ? 0x23272d : L.cloth;
  fillLimb(ctx, rng, w, h, base, y0, y1, w0, w1);
  ctx.save();
  taper(ctx, w / 2, y0, y1, w0, w1);
  ctx.clip();
  if (L.sleeve === 'short') {
    ctx.fillStyle = cylinderGradient(ctx, w / 2 - 12, w / 2 + 12, L.skin, 0.15, 0.55);
    ctx.fillRect(0, h * 0.45, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h * 0.45, w, 3);
  }
  if (L.torso === 'flannel') {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#1b0f0c';
    for (let y = 6; y < h; y += 15) ctx.fillRect(0, y, w, 4);
    ctx.globalAlpha = 1;
  }
  if (L.sleeve === 'armor') {
    ctx.fillStyle = cylinderGradient(ctx, 0, w, 0x3a4048, 0.3, 0.6);
    ctx.beginPath();
    ctx.ellipse(w / 2, 14, 16, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.stroke();
  }
  if (rng() < 0.6) bloodStain(ctx, rng, w / 2 + rand(rng, -5, 5), rand(rng, 20, h - 20), rand(rng, 4, 8), 2, 0.6);
  ctx.restore();
  strokeLimb(ctx, w, y0, y1, w0, w1);
}

function paintForeArm(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const y0 = 3, y1 = h - 3;
  const w0 = 20, w1 = 13;
  fillLimb(ctx, rng, w, h, L.skin, y0, y1, w0, w1, 40);
  ctx.save();
  taper(ctx, w / 2, y0, y1, w0, w1);
  ctx.clip();
  if (L.sleeve === 'long' || L.sleeve === 'armor') {
    const c = L.sleeve === 'armor' ? 0x23272d : L.cloth;
    ctx.fillStyle = cylinderGradient(ctx, 0, w, c, 0.15, 0.6);
    const cuff = h * rand(rng, 0.38, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 3) ctx.lineTo(x, cuff + rand(rng, -5, 5));
    ctx.closePath();
    ctx.fill();
  }
  // tendons and a bite wound
  ctx.strokeStyle = 'rgba(40,40,30,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 3, h * 0.5); ctx.lineTo(w / 2 - 2, h - 6);
  ctx.moveTo(w / 2 + 3, h * 0.5); ctx.lineTo(w / 2 + 2, h - 6);
  ctx.stroke();
  if (rng() < 0.6) bloodStain(ctx, rng, w / 2, rand(rng, h * 0.5, h * 0.8), rand(rng, 4, 7), 2, 0.75);
  ctx.restore();
  strokeLimb(ctx, w, y0, y1, w0, w1);
}

function paintHand(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const cx = w / 2;
  const skin = shadeColor(L.skin, -0.18);
  // fingers: long, bony, curled claws
  ctx.lineCap = 'round';
  const fingers = [
    { x: -9, len: 26, a: -0.25 }, { x: -3, len: 30, a: -0.08 }, { x: 3, len: 30, a: 0.06 }, { x: 9, len: 25, a: 0.22 },
  ];
  for (const f of fingers) {
    const x0 = cx + f.x, y0 = 17;
    const curl = rand(rng, 0.1, 0.5);
    const x1 = x0 + Math.sin(f.a) * f.len * 0.6, y1 = y0 + f.len * 0.55;
    const x2 = x1 + Math.sin(f.a + curl) * f.len * 0.45, y2 = y1 + f.len * 0.4;
    ctx.strokeStyle = hex(shadeColor(skin, -0.5));
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = hex(shadeColor(skin, -0.05));
    ctx.lineWidth = 3.3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = '#2a241c';
    ctx.beginPath(); ctx.arc(x2, y2 + 0.5, 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(60,40,40,0.6)';
    ctx.beginPath(); ctx.arc(x1, y1, 1.3, 0, Math.PI * 2); ctx.fill();
  }
  // thumb
  ctx.strokeStyle = hex(shadeColor(skin, -0.45));
  ctx.lineWidth = 5.2;
  ctx.beginPath(); ctx.moveTo(cx - 10, 10); ctx.lineTo(cx - 16, 20); ctx.lineTo(cx - 15, 28); ctx.stroke();
  ctx.strokeStyle = hex(skin);
  ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.moveTo(cx - 10, 10); ctx.lineTo(cx - 16, 20); ctx.lineTo(cx - 15, 28); ctx.stroke();
  // palm / back of hand
  ctx.fillStyle = cylinderGradient(ctx, cx - 12, cx + 12, skin, 0.2, 0.55);
  ctx.beginPath();
  ctx.ellipse(cx, 12, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  speckle(ctx, rng, cx - 12, 2, 24, 20, 20, '#3a2020', 1.4, 0.1, 0.35);
  if (rng() < 0.7) bloodStain(ctx, rng, cx + rand(rng, -5, 5), 12, 5, 2, 0.7);
  void h;
}

function paintThigh(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const y0 = 2, y1 = h - 3;
  const w0 = L.torso === 'bloat' ? 40 : 38, w1 = 29;
  fillLimb(ctx, rng, w, h, L.pants, y0, y1, w0, w1, 70);
  ctx.save();
  taper(ctx, w / 2, y0, y1, w0, w1);
  ctx.clip();
  scratches(ctx, rng, 0, 0, w, h, 14, '#0e0d0c', 14, 0.3, true);
  if (L.torso === 'armor') {
    ctx.fillStyle = cylinderGradient(ctx, w / 2 - 14, w / 2 + 14, 0x30353c, 0.3, 0.6);
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 12, 15, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (rng() < 0.65) {
    // torn knee
    const ky = h - rand(rng, 12, 26);
    ctx.fillStyle = hex(shadeColor(L.skin, -0.15));
    ctx.beginPath();
    ctx.ellipse(w / 2 + rand(rng, -4, 4), ky, rand(rng, 6, 10), rand(rng, 4, 7), 0, 0, Math.PI * 2);
    ctx.fill();
    bloodStain(ctx, rng, w / 2, ky, 6, 2, 0.6);
  }
  speckle(ctx, rng, 0, 0, w, h, 40, '#5a4a30', 2.5, 0.05, 0.2);
  vShade(ctx, 0, h, 0.06, 0.25, w);
  ctx.restore();
  strokeLimb(ctx, w, y0, y1, w0, w1);
}

function paintShin(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, L: Look): void {
  const y0 = 2, y1 = h - 20;
  const w0 = 29, w1 = 24;
  fillLimb(ctx, rng, w, h, L.pants, y0, y1, w0, w1, 60);
  ctx.save();
  taper(ctx, w / 2, y0, y1, w0, w1);
  ctx.clip();
  // mud rising from the hem
  const g = ctx.createLinearGradient(0, h * 0.4, 0, y1);
  g.addColorStop(0, 'rgba(60,48,30,0)');
  g.addColorStop(1, 'rgba(60,48,30,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  scratches(ctx, rng, 0, 0, w, h, 14, '#0e0d0c', 14, 0.3, true);
  ctx.restore();
  strokeLimb(ctx, w, y0, y1, w0, w1);
  // shoe (front view)
  const sy = h - 13;
  ctx.fillStyle = cylinderGradient(ctx, w / 2 - 17, w / 2 + 17, L.shoe, L.sneakers ? 0.25 : 0.12, 0.6);
  ctx.beginPath();
  ctx.ellipse(w / 2, sy, 16.5, 10.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (L.sneakers) {
    ctx.fillStyle = 'rgba(30,26,22,0.5)';
    ctx.fillRect(w / 2 - 16, sy + 4, 32, 3);
  }
  speckle(ctx, rng, w / 2 - 16, sy - 10, 32, 20, 30, '#4a3a22', 2, 0.1, 0.4);
}

// ---------------------------------------------------------------- build

export function buildZombieAtlas(): { canvas: HTMLCanvasElement; frames: AtlasBuilder['frames'] } {
  const atlas = new AtlasBuilder(1024, 1024);
  let seed = 1337;
  for (const L of LOOKS) {
    const rng = mulberry32(seed++ * 7919);
    const torsoSpec = L.torso === 'bloat' ? PART.bloatTorso : PART.torso;
    atlas.add(`${L.key}_torso`, torsoSpec.w, torsoSpec.h, (c, w, h) => paintTorso(c, w, h, rng, L));
    atlas.add(`${L.key}_head`, PART.head.w, PART.head.h, (c, w, h) => paintHead(c, w, h, rng, L));
    atlas.add(`${L.key}_upperArm`, PART.upperArm.w, PART.upperArm.h, (c, w, h) => paintUpperArm(c, w, h, rng, L));
    atlas.add(`${L.key}_foreArm`, PART.foreArm.w, PART.foreArm.h, (c, w, h) => paintForeArm(c, w, h, rng, L));
    atlas.add(`${L.key}_hand`, PART.hand.w, PART.hand.h, (c, w, h) => paintHand(c, w, h, rng, L));
    atlas.add(`${L.key}_thigh`, PART.thigh.w, PART.thigh.h, (c, w, h) => paintThigh(c, w, h, rng, L));
    atlas.add(`${L.key}_shin`, PART.shin.w, PART.shin.h, (c, w, h) => paintShin(c, w, h, rng, L));
  }
  atlas.add('shadow', 128, 34, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    softCircle(c, 0, 0, w / 2, 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0)');
    c.restore();
  });
  return { canvas: atlas.canvas, frames: atlas.frames };
}
