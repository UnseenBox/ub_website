// Procedural battlefield painter: overcast sky, mountains, treeline, ruined
// skyline, perspective ground, props, sandbag parapet, shutters and overlays.

import Phaser from 'phaser';
import { VIEW, WINDOW } from '../game/config';
import {
  Rng, bloodStain, cylinderGradient, hex, makeCanvas, mix, mulberry32, rand, scratches, shadeColor, softCircle, speckle,
} from './CanvasUtil';

export const FOG_COLOR = 0x8a8e88;

function valueNoise1D(rng: Rng, n: number): (x: number) => number {
  const v = Array.from({ length: n + 1 }, () => rng());
  v[n] = v[0];
  return (x: number) => {
    const xf = ((x % n) + n) % n;
    const i = Math.floor(xf), f = xf - i;
    const t = f * f * (3 - 2 * f);
    return v[i] * (1 - t) + v[i + 1] * t;
  };
}

function fbm(rng: Rng, octaves: number, period: number): (x: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) => ({ n: valueNoise1D(rng, 64), f: Math.pow(2, i) / period, a: Math.pow(0.5, i) }));
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (x: number) => layers.reduce((s, l) => s + l.n(x * l.f) * l.a, 0) / norm;
}

function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// ------------------------------------------------------------ backdrop

function paintBackdrop(): HTMLCanvasElement {
  const W = VIEW.width, H = VIEW.horizonY + 24;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(42);
  const hy = VIEW.horizonY;
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#1f2327');
  sky.addColorStop(0.45, '#3f454a');
  sky.addColorStop(0.85, '#7c807b');
  sky.addColorStop(1, '#93958c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // faint sickly glow where the sun hides behind the overcast
  softCircle(ctx, W * 0.72, hy * 0.42, 260, 'rgba(170,160,120,0.22)', 'rgba(170,160,120,0)');

  // far mountains
  const ridge = (base: number, amp: number, period: number, color: string, seed: number, jag: number) => {
    const n = fbm(mulberry32(seed), 5, period);
    const r2 = mulberry32(seed + 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 2) {
      const y = base - amp * Math.pow(n(x), 1.6) - (r2() - 0.5) * jag;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  ridge(hy - 6, 120, 420, '#757c7e', 7, 1.2);
  // snow-less rock striations on the far range
  ctx.save();
  ctx.globalAlpha = 0.12;
  scratches(ctx, rng, 0, hy - 120, W, 110, 220, '#3a4044', 14, 0.5, true);
  ctx.restore();
  // haze over far range
  let haze = ctx.createLinearGradient(0, hy - 120, 0, hy);
  haze.addColorStop(0, 'rgba(138,142,136,0)');
  haze.addColorStop(1, 'rgba(138,142,136,0.75)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hy - 130, W, 130);
  ridge(hy - 2, 70, 260, '#5b6261', 19, 1.5);
  haze = ctx.createLinearGradient(0, hy - 60, 0, hy);
  haze.addColorStop(0, 'rgba(138,142,136,0)');
  haze.addColorStop(1, 'rgba(138,142,136,0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hy - 70, W, 70);

  // ruined town skyline (left) and radio mast (right)
  ctx.fillStyle = '#4a504f';
  let x = 70;
  while (x < 420) {
    const bw = rand(rng, 14, 40), bh = rand(rng, 10, 46);
    ctx.beginPath();
    ctx.moveTo(x, hy);
    ctx.lineTo(x, hy - bh);
    // broken roofline
    for (let k = 1; k <= 4; k++) ctx.lineTo(x + (bw * k) / 4, hy - bh + rand(rng, -3, bh * 0.5));
    ctx.lineTo(x + bw, hy);
    ctx.closePath();
    ctx.fill();
    // empty windows
    ctx.fillStyle = 'rgba(30,34,34,0.6)';
    for (let wy = hy - bh + 6; wy < hy - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) if (rng() < 0.5) ctx.fillRect(wx, wy, 2, 2.5);
    ctx.fillStyle = '#4a504f';
    x += bw + rand(rng, 2, 18);
  }
  ctx.strokeStyle = '#3f4545';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(1010, hy); ctx.lineTo(1018, hy - 92); ctx.lineTo(1026, hy);
  for (let k = 0; k < 8; k++) {
    const yy = hy - k * 11;
    ctx.moveTo(1010 + k, yy); ctx.lineTo(1026 - k, yy - 11);
  }
  ctx.stroke();

  // treeline of dead pines along the horizon
  const tl = fbm(mulberry32(77), 4, 160);
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? '#3f4643' : '#2c322f';
    for (let tx = -10; tx < W + 10; tx += pass === 0 ? 3.2 : 4.5) {
      const density = tl(tx + pass * 300);
      if (density < (pass === 0 ? 0.35 : 0.45)) continue;
      const th = rand(rng, 6, 20) * (0.6 + density) * (pass === 0 ? 0.8 : 1);
      const tw = th * rand(rng, 0.22, 0.35);
      const base = hy + (pass === 0 ? 0 : 3);
      ctx.beginPath();
      ctx.moveTo(tx - tw, base);
      for (let k = 0; k < 4; k++) {
        const yy = base - (th * (k + 1)) / 4;
        ctx.lineTo(tx - tw * (1 - (k + 1) / 4.5), yy + th * 0.1);
        ctx.lineTo(tx - tw * (1 - (k + 1) / 4) * 0.4, yy + th * 0.12);
      }
      ctx.lineTo(tx, base - th);
      for (let k = 3; k >= 0; k--) {
        const yy = base - (th * (k + 1)) / 4;
        ctx.lineTo(tx + tw * (1 - (k + 1) / 4) * 0.4, yy + th * 0.12);
        ctx.lineTo(tx + tw * (1 - (k + 1) / 4.5), yy + th * 0.1);
      }
      ctx.lineTo(tx + tw, base);
      ctx.closePath();
      ctx.fill();
    }
  }
  // ground fog band sitting on the horizon
  const band = ctx.createLinearGradient(0, hy - 26, 0, H);
  band.addColorStop(0, 'rgba(138,142,136,0)');
  band.addColorStop(0.55, 'rgba(138,142,136,0.6)');
  band.addColorStop(1, 'rgba(138,142,136,0.9)');
  ctx.fillStyle = band;
  ctx.fillRect(0, hy - 26, W, 50);
  return canvas;
}

function paintClouds(): HTMLCanvasElement {
  const W = 1280, H = 190;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(99);
  const blob = (x: number, y: number, r: number, c: string) => {
    for (const ox of [-W, 0, W]) softCircle(ctx, x + ox, y, r, c, 'rgba(0,0,0,0)');
  };
  for (let i = 0; i < 260; i++) {
    const y = rand(rng, 10, H - 30);
    const r = rand(rng, 30, 90) * (0.6 + y / H);
    const dark = rng() < 0.55;
    blob(rand(rng, 0, W), y, r, dark ? `rgba(24,27,30,${rand(rng, 0.08, 0.22)})` : `rgba(150,152,146,${rand(rng, 0.04, 0.12)})`);
  }
  // stretched streaks
  ctx.save();
  ctx.scale(1, 0.35);
  for (let i = 0; i < 80; i++) blob(rand(rng, 0, W), rand(rng, 40, H / 0.35 - 40), rand(rng, 40, 120), `rgba(20,22,25,${rand(rng, 0.05, 0.14)})`);
  ctx.restore();
  return canvas;
}

// ------------------------------------------------------------ ground

function groundZ(y: number): number {
  return (VIEW.camHeight * VIEW.focal) / Math.max(0.5, y - VIEW.horizonY);
}

function paintGround(): HTMLCanvasElement {
  const W = VIEW.width, top = VIEW.horizonY, H = VIEW.height - top;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(5);
  const near = 0x3a3428, mid = 0x4d4a3c;
  for (let y = 0; y < H; y++) {
    const z = groundZ(y + top);
    const f = Math.min(1, Math.pow(z / 90, 0.7));
    const base = f > 0.5 ? mix(mid, FOG_COLOR, (f - 0.5) * 2) : mix(near, mid, f * 2);
    ctx.fillStyle = hex(base);
    ctx.fillRect(0, y, W, 1);
  }
  const noiseRow = fbm(mulberry32(8), 5, 200);
  // large-scale mottling (patches of mud vs dead grass), perspective squashed
  for (let i = 0; i < 500; i++) {
    const y = Math.pow(rng(), 0.7) * H;
    const z = groundZ(y + top);
    const ppm = VIEW.focal / z;
    const rx = rand(rng, 1.5, 6) * ppm, ry = rx * (VIEW.camHeight / z) * 1.2 + 0.5;
    const x = rng() * W;
    const tone = noiseRow(x * 0.5 + y * 3);
    ctx.fillStyle = tone > 0.5 ? `rgba(70,66,44,${0.18 * Math.min(1, 30 / z)})` : `rgba(28,24,18,${0.2 * Math.min(1, 30 / z)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // road toward the bunker
  const roadHalf = 3.4;
  ctx.beginPath();
  for (let y = 0; y <= H; y += 2) {
    const ppm = VIEW.focal / groundZ(y + top);
    const xx = VIEW.centerX - 0.6 * ppm - roadHalf * ppm;
    if (y === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
  }
  for (let y = H; y >= 0; y -= 2) {
    const ppm = VIEW.focal / groundZ(y + top);
    ctx.lineTo(VIEW.centerX - 0.6 * ppm + roadHalf * ppm, y);
  }
  ctx.closePath();
  ctx.save();
  ctx.clip();
  for (let y = 0; y < H; y++) {
    const z = groundZ(y + top);
    const f = Math.min(1, Math.pow(z / 90, 0.7));
    ctx.fillStyle = hex(mix(0x2d2d2b, FOG_COLOR, f * 0.9));
    ctx.fillRect(0, y, W, 1);
  }
  // cracks
  ctx.strokeStyle = 'rgba(12,12,10,0.6)';
  for (let i = 0; i < 90; i++) {
    const y = Math.pow(rng(), 0.6) * H;
    const ppm = VIEW.focal / groundZ(y + top);
    let x = VIEW.centerX - 0.6 * ppm + rand(rng, -roadHalf, roadHalf) * ppm;
    let yy = y;
    ctx.lineWidth = Math.max(0.5, ppm * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, yy);
    for (let k = 0; k < 5; k++) {
      x += rand(rng, -0.4, 0.4) * ppm;
      yy += rand(rng, -0.05, 0.05) * ppm;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // faded broken centre line
  for (let zz = 6; zz < 120; zz += 4.5) {
    if (rng() < 0.3) continue;
    const y0 = top + (VIEW.camHeight * VIEW.focal) / zz - top;
    const y1 = top + (VIEW.camHeight * VIEW.focal) / (zz + 2) - top;
    const ppm = VIEW.focal / zz;
    const cxl = VIEW.centerX - 0.6 * ppm;
    ctx.fillStyle = `rgba(170,150,90,${0.35 * Math.min(1, 25 / zz)})`;
    ctx.beginPath();
    ctx.moveTo(cxl - 0.08 * ppm, y0);
    ctx.lineTo(cxl + 0.08 * ppm, y0);
    ctx.lineTo(cxl + 0.08 * (VIEW.focal / (zz + 2)), y1);
    ctx.lineTo(cxl - 0.08 * (VIEW.focal / (zz + 2)), y1);
    ctx.fill();
  }
  ctx.restore();

  // scatter: grass tufts, stones, debris, puddles, craters
  for (let i = 0; i < 2600; i++) {
    const y = Math.pow(rng(), 0.55) * H;
    const z = groundZ(y + top);
    const ppm = VIEW.focal / z;
    const x = rng() * W;
    const fogA = Math.min(1, 40 / z);
    const r = rng();
    if (r < 0.62) {
      // dead grass tuft
      ctx.strokeStyle = rng() < 0.5 ? `rgba(92,86,58,${0.55 * fogA})` : `rgba(40,42,30,${0.6 * fogA})`;
      ctx.lineWidth = Math.max(0.4, ppm * 0.018);
      const hgt = rand(rng, 0.12, 0.35) * ppm;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const bx = x + rand(rng, -0.08, 0.08) * ppm;
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + rand(rng, -0.12, 0.12) * ppm, y - hgt * rand(rng, 0.6, 1));
      }
      ctx.stroke();
    } else if (r < 0.85) {
      const rr = rand(rng, 0.03, 0.1) * Math.min(ppm, 90);
      const v = rand(rng, 48, 82);
      ctx.fillStyle = `rgba(${v | 0},${(v * 0.95) | 0},${(v * 0.84) | 0},${0.7 * fogA})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(10,10,8,${0.35 * fogA})`;
      ctx.beginPath();
      ctx.ellipse(x + rr * 0.2, y + rr * 0.3, rr, rr * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (r < 0.95) {
      ctx.fillStyle = `rgba(30,26,22,${0.6 * fogA})`;
      const dw = rand(rng, 0.1, 0.5) * ppm;
      ctx.fillRect(x, y - dw * 0.1, dw, Math.max(0.5, dw * 0.12));
    } else if (r < 0.975) {
      // puddle reflecting the grey sky
      const rr = rand(rng, 0.25, 0.8) * Math.min(ppm, 60);
      const ry = rr * (VIEW.camHeight / z) * 0.9 + 0.4;
      ctx.fillStyle = `rgba(78,84,84,${0.35 * fogA})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(20,18,14,${0.5 * fogA})`;
      ctx.lineWidth = Math.max(0.5, ppm * 0.03);
      ctx.stroke();
    } else {
      // shell crater
      const rr = rand(rng, 0.6, 1.6) * Math.min(ppm, 70);
      const ry = rr * (VIEW.camHeight / z) * 1.1 + 0.6;
      ctx.fillStyle = `rgba(18,15,12,${0.55 * fogA})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(80,72,54,${0.35 * fogA})`;
      ctx.lineWidth = Math.max(0.6, ppm * 0.08);
      ctx.beginPath();
      ctx.ellipse(x, y - ry * 0.15, rr * 1.08, ry * 1.1, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
  }
  // old blood trails near the bunker
  for (let i = 0; i < 6; i++) bloodStain(ctx, rng, rand(rng, 200, 1080), rand(rng, 200, 280), rand(rng, 8, 18), 0, 0.22);
  // fog falloff near horizon
  const fog = ctx.createLinearGradient(0, 0, 0, 60);
  fog.addColorStop(0, 'rgba(138,142,136,0.95)');
  fog.addColorStop(1, 'rgba(138,142,136,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, 60);
  return canvas;
}

function paintFogTile(): HTMLCanvasElement {
  // Horizontally seamless fbm noise written straight into pixels (fast, no gradients).
  const W = 512, H = 96;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(31);
  const octaves = [
    { cells: 8, rows: 3, amp: 0.55 },
    { cells: 16, rows: 5, amp: 0.3 },
    { cells: 32, rows: 9, amp: 0.15 },
  ].map((o) => ({ ...o, grid: Array.from({ length: (o.rows + 1) * o.cells }, () => rng()) }));
  const sample = (o: (typeof octaves)[number], x: number, y: number): number => {
    const gx = (x / W) * o.cells, gy = (y / H) * o.rows;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (cx: number, cy: number) => o.grid[Math.min(o.rows, cy) * o.cells + (((cx % o.cells) + o.cells) % o.cells)];
    const a0 = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
    const a1 = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
    return a0 * (1 - sy) + a1 * sy;
  };
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = Math.sin((y / H) * Math.PI); // soft top/bottom edges
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (const o of octaves) n += sample(o, x, y) * o.amp;
      const a = Math.max(0, n - 0.32) * 1.6 * v * v;
      const i = (y * W + x) * 4;
      img.data[i] = 150; img.data[i + 1] = 154; img.data[i + 2] = 148;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ------------------------------------------------------------ props

function paintDeadTree(seed: number): HTMLCanvasElement {
  const W = 260, H = 330;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(seed);
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = depth === 0 ? '#262320' : '#2d2a26';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + rand(rng, -len * 0.15, len * 0.15), (y + y2) / 2, x2, y2);
    ctx.stroke();
    if (depth >= 5 || len < 8) return;
    const n = depth === 0 ? 3 : 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      branch(x2, y2, a + rand(rng, -0.75, 0.75), len * rand(rng, 0.55, 0.78), w * 0.62, depth + 1);
    }
  };
  // trunk with bark shading
  ctx.fillStyle = cylinderGradient(ctx, W / 2 - 14, W / 2 + 14, 0x35302b, 0.15, 0.6);
  ctx.beginPath();
  ctx.moveTo(W / 2 - 16, H);
  ctx.quadraticCurveTo(W / 2 - 8, H - 80, W / 2 - 6, H - 150);
  ctx.lineTo(W / 2 + 6, H - 150);
  ctx.quadraticCurveTo(W / 2 + 9, H - 80, W / 2 + 17, H);
  ctx.closePath();
  ctx.fill();
  branch(W / 2, H - 140, -Math.PI / 2 + rand(rng, -0.2, 0.2), 70, 11, 0);
  branch(W / 2, H - 110, -Math.PI / 2 - 0.9, 50, 6, 2);
  branch(W / 2, H - 95, -Math.PI / 2 + 0.8, 45, 5, 2);
  return canvas;
}

function paintPole(): HTMLCanvasElement {
  const W = 120, H = 360;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = cylinderGradient(ctx, W / 2 - 7, W / 2 + 7, 0x3b3128, 0.15, 0.6);
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.rotate(0.05);
  ctx.fillRect(-6, -H + 8, 12, H - 8);
  ctx.fillStyle = '#2f2820';
  ctx.fillRect(-48, -H + 30, 96, 7);
  ctx.fillStyle = '#6e7270';
  for (const x of [-42, -22, 22, 42]) ctx.fillRect(x - 2, -H + 22, 4, 8);
  ctx.restore();
  return canvas;
}

function paintCar(): HTMLCanvasElement {
  const W = 300, H = 150;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(12);
  // burned-out sedan, three-quarter front view
  const body = [[18, 120], [24, 86], [64, 72], [94, 40], [198, 36], [238, 66], [284, 78], [288, 118], [276, 130], [30, 132]];
  ctx.beginPath();
  ctx.moveTo(body[0][0], body[0][1]);
  for (const p of body) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 30, 0, 135);
  g.addColorStop(0, '#4b3a2c');
  g.addColorStop(0.5, '#2e2621');
  g.addColorStop(1, '#141210');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, rng, 0, 0, W, H, 600, '#7a4a26', 3, 0.1, 0.4);
  speckle(ctx, rng, 0, 0, W, H, 300, '#0c0a08', 4, 0.1, 0.5);
  ctx.restore();
  // shattered windows
  ctx.fillStyle = '#0e0f10';
  ctx.beginPath();
  ctx.moveTo(100, 46); ctx.lineTo(192, 42); ctx.lineTo(228, 68); ctx.lineTo(74, 74);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,170,170,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(rand(rng, 90, 200), rand(rng, 46, 70));
    ctx.lineTo(rand(rng, 90, 220), rand(rng, 46, 72));
    ctx.stroke();
  }
  // headlights (dead), grille
  ctx.fillStyle = '#1b1a18';
  ctx.fillRect(40, 92, 70, 16);
  ctx.fillStyle = '#5a5850';
  ctx.beginPath(); ctx.ellipse(40, 96, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(116, 96, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  // flat tyres
  ctx.fillStyle = '#0c0c0b';
  for (const x of [52, 236]) {
    ctx.beginPath();
    ctx.ellipse(x, 132, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function paintHedgehog(): HTMLCanvasElement {
  const W = 150, H = 120;
  const { canvas, ctx } = makeCanvas(W, H);
  const beam = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    ctx.strokeStyle = '#1e1d1b';
    ctx.lineWidth = w + 3;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,110,80,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1 - 2, y1 - 2); ctx.lineTo(x2 - 2, y2 - 2); ctx.stroke();
  };
  beam(20, 116, 128, 8, 11);
  beam(130, 116, 22, 10, 11);
  beam(76, 118, 74, 4, 10);
  return canvas;
}

function paintBarrier(): HTMLCanvasElement {
  const W = 220, H = 80;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(3);
  ctx.beginPath();
  ctx.moveTo(4, H); ctx.lineTo(16, 46); ctx.lineTo(30, 8); ctx.lineTo(190, 8); ctx.lineTo(204, 46); ctx.lineTo(216, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8b8a82');
  g.addColorStop(1, '#4b4a45');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, rng, 0, 0, W, H, 400, '#2a2a26', 2, 0.1, 0.4);
  scratches(ctx, rng, 0, 0, W, H, 40, '#2a2420', 12, 0.4, true);
  ctx.fillStyle = 'rgba(30,30,28,0.9)';
  ctx.beginPath(); ctx.moveTo(150, 8); ctx.lineTo(176, 8); ctx.lineTo(170, 30); ctx.lineTo(158, 22); ctx.fill();
  ctx.restore();
  return canvas;
}

function paintBarrel(): HTMLCanvasElement {
  const W = 60, H = 80;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(9);
  ctx.fillStyle = cylinderGradient(ctx, 4, W - 4, 0x5a3a22, 0.2, 0.6);
  ctx.fillRect(6, 10, W - 12, H - 12);
  ctx.save();
  ctx.beginPath(); ctx.rect(6, 10, W - 12, H - 12); ctx.clip();
  speckle(ctx, rng, 0, 0, W, H, 200, '#20140c', 2.5, 0.2, 0.6);
  speckle(ctx, rng, 0, 0, W, H, 80, '#9a5a2a', 2, 0.1, 0.4);
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (const y of [28, 54]) ctx.fillRect(6, y, W - 12, 3);
  ctx.fillStyle = '#120c08';
  ctx.beginPath(); ctx.ellipse(W / 2, 11, (W - 12) / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  softCircle(ctx, W / 2, 11, 18, 'rgba(255,160,60,0.7)', 'rgba(255,120,40,0)');
  return canvas;
}

function paintWireCoil(): HTMLCanvasElement {
  const W = 520, H = 70;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.strokeStyle = 'rgba(30,30,30,0.9)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 46; i++) {
    const cx = 10 + i * 11;
    ctx.beginPath();
    ctx.ellipse(cx, H / 2 + 6, 16, 26, 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,120,115,0.35)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 46; i++) {
    ctx.beginPath();
    ctx.ellipse(10 + i * 11 - 1, H / 2 + 5, 16, 26, 0.5, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
  }
  return canvas;
}

// ------------------------------------------------------------ foreground

let burlap: CanvasPattern | null = null;
function burlapPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (burlap) return burlap;
  const { canvas, ctx: p } = makeCanvas(48, 48);
  const rng = mulberry32(77);
  p.strokeStyle = 'rgba(26,20,12,0.22)';
  p.lineWidth = 1;
  for (let k = 0; k < 48; k += 3) {
    p.beginPath(); p.moveTo(k, 0); p.lineTo(k, 48); p.stroke();
    p.beginPath(); p.moveTo(0, k); p.lineTo(48, k); p.stroke();
  }
  speckle(p, rng, 0, 0, 48, 48, 40, '#241c12', 2, 0.15, 0.45);
  burlap = ctx.createPattern(canvas, 'repeat')!;
  return burlap;
}

function sandbag(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, base: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.18, x + w - 8, y);
  ctx.quadraticCurveTo(x + w + 4, y + h / 2, x + w - 8, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h * 1.12, x + 8, y + h);
  ctx.quadraticCurveTo(x - 4, y + h / 2, x + 8, y);
  ctx.closePath();
  const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.25, 4, x + w / 2, y + h / 2, w * 0.7);
  g.addColorStop(0, hex(shadeColor(base, 0.22)));
  g.addColorStop(0.6, hex(base));
  g.addColorStop(1, hex(shadeColor(base, -0.6)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // burlap weave + grime from a shared pattern (one fill instead of hundreds of strokes)
  ctx.fillStyle = burlapPattern(ctx);
  ctx.fillRect(x - 6, y - 8, w + 12, h + 16);
  // tied end / seam
  ctx.strokeStyle = 'rgba(25,18,10,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.85, y + 4);
  ctx.quadraticCurveTo(x + w * 0.8, y + h / 2, x + w * 0.86, y + h - 4);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,8,5,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h * 1.12, x + w - 8, y + h);
  ctx.stroke();
}

function paintParapet(): HTMLCanvasElement {
  const W = VIEW.width, top = VIEW.wallTop - 26, H = VIEW.height - top;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(21);
  const rows = [
    { y: 26, h: 38, w: 118 },
    { y: 56, h: 40, w: 128 },
    { y: 88, h: 44, w: 140 },
    { y: 124, h: 50, w: 150 },
    { y: 166, h: 56, w: 160 },
  ];
  for (let r = rows.length - 1; r >= 0; r--) {
    const row = rows[r];
    let x = -rand(rng, 20, 70) - (r % 2) * 50;
    while (x < W + 10) {
      const w = row.w * rand(rng, 0.88, 1.08);
      const base = mix(0x9c8c64, 0x7a6c4c, rng() * 0.6);
      sandbag(ctx, rng, x, row.y + rand(rng, -3, 3) - (r === 0 ? rand(rng, 0, 6) : 0), w, row.h, base);
      x += w - 10;
    }
  }
  // dark shadow under the lip so zombies "sink" behind it
  const sh = ctx.createLinearGradient(0, 0, 0, 40);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, 40);
  // concrete coping along the top of the wall, so the wall's line reads at a glance
  const coping = ctx.createLinearGradient(0, 0, 0, 16);
  coping.addColorStop(0, '#a4a79e');
  coping.addColorStop(1, '#5c5e57');
  ctx.fillStyle = coping;
  ctx.fillRect(0, 0, W, 16);
  ctx.fillStyle = 'rgba(20,20,18,0.55)';
  ctx.fillRect(0, 16, W, 3);
  // barbed wire along the top
  ctx.strokeStyle = 'rgba(196,196,186,0.92)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 120; i++) {
    const cx = i * 11 + 4;
    ctx.beginPath();
    ctx.ellipse(cx, 20, 14, 18, 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(196,196,186,0.92)';
  for (let i = 0; i < 200; i++) ctx.fillRect(rng() * W, rand(rng, 2, 38), 3, 1.2);
  // ammo crate on the left, radio on the right
  ctx.fillStyle = cylinderGradient(ctx, 150, 280, 0x4a4c2e, 0.2, 0.5);
  ctx.fillRect(150, 66, 130, 62);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 66, 130, 62);
  ctx.fillStyle = 'rgba(220,210,170,0.55)';
  ctx.font = 'bold 11px "Saira", sans-serif';
  ctx.fillText('CTG 7.62MM', 168, 100);
  ctx.fillText('LOT 44-91', 172, 114);
  ctx.fillStyle = cylinderGradient(ctx, 1010, 1100, 0x333a2c, 0.2, 0.5);
  ctx.fillRect(1010, 72, 90, 56);
  ctx.fillStyle = '#111';
  ctx.fillRect(1020, 82, 40, 20);
  ctx.fillStyle = '#7fbf6a';
  ctx.fillRect(1068, 84, 5, 5);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1092, 74); ctx.lineTo(1104, 8); ctx.stroke();
  return canvas;
}

function paintFrame(): HTMLCanvasElement {
  // Bunker embrasure framing + vignette, drawn over the battlefield.
  const W = VIEW.width, H = VIEW.height;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(64);
  const concrete = (pts: number[][]) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const density = (bw * bh) / 1000;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4b4d48');
    g.addColorStop(1, '#6a6a62');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    speckle(ctx, rng, bx, by, bw, bh, Math.round(density * 2.2), '#121210', 2.4, 0.1, 0.5);
    speckle(ctx, rng, bx, by, bw, bh, Math.round(density * 0.9), '#6a6a62', 1.6, 0.05, 0.25);
    scratches(ctx, rng, bx, by, bw, bh, Math.round(density * 0.25), '#0c0c0a', 26, 0.45, true);
    ctx.restore();
    ctx.strokeStyle = 'rgba(216,216,200,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.stroke();
  };
  // top lip with a jagged edge
  const lip: number[][] = [[0, 0], [0, 16]];
  for (let x = 0; x <= W; x += 24) lip.push([x, 16 + rand(rng, -3, 5)]);
  lip.push([W, 0]);
  concrete(lip);
  concrete([[0, 30], [0, 18], [WINDOW.topX, WINDOW.topY], [WINDOW.bottomX, H], [0, H]]);
  concrete([[W, 30], [W, 18], [W - WINDOW.topX, WINDOW.topY], [W - WINDOW.bottomX, H], [W, H]]);
  // rebar stubs
  ctx.strokeStyle = '#3a2a1c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(78, 120); ctx.lineTo(96, 116); ctx.moveTo(W - 80, 200); ctx.lineTo(W - 100, 204); ctx.stroke();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

function paintShutters(): HTMLCanvasElement {
  const W = VIEW.width, H = 170;
  const { canvas, ctx } = makeCanvas(W, H);
  const rng = mulberry32(17);
  const pw = 160;
  for (let x = 0; x < W; x += pw) {
    const g = ctx.createLinearGradient(x, 0, x + pw, H);
    g.addColorStop(0, '#5b605f');
    g.addColorStop(0.5, '#3c4140');
    g.addColorStop(1, '#2a2e2d');
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, 14, pw - 2, H - 14);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, 14, pw, H); ctx.clip();
    speckle(ctx, rng, x, 14, pw, H, 140, '#5a3a20', 2.5, 0.1, 0.5);
    scratches(ctx, rng, x, 14, pw, H, 20, '#a0a49e', 14, 0.25);
    ctx.restore();
    ctx.fillStyle = 'rgba(10,10,10,0.85)';
    ctx.fillRect(x + 30, 46, pw - 60, 8);
    ctx.fillStyle = '#7a7e7a';
    for (const ry of [24, H - 12]) for (let rx = x + 10; rx < x + pw; rx += 24) {
      ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // hazard stripe along the top edge
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, 14); ctx.clip();
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = '#151515';
  for (let x = -20; x < W + 20; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 14, 0); ctx.lineTo(x + 28, 0); ctx.lineTo(x + 14, 14); ctx.fill();
  }
  ctx.restore();
  return canvas;
}

function paintGrain(): HTMLCanvasElement {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const rng = mulberry32(2024);
  for (let i = 0; i < S * S; i++) {
    const v = Math.floor(rng() * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function buildEnvironmentTextures(scene: Phaser.Scene): void {
  add(scene, 'backdrop', paintBackdrop());
  add(scene, 'clouds', paintClouds());
  add(scene, 'ground', paintGround());
  add(scene, 'fog_tile', paintFogTile());
  add(scene, 'tree_0', paintDeadTree(101));
  add(scene, 'tree_1', paintDeadTree(202));
  add(scene, 'tree_2', paintDeadTree(303));
  add(scene, 'pole', paintPole());
  add(scene, 'car', paintCar());
  add(scene, 'hedgehog', paintHedgehog());
  add(scene, 'barrier', paintBarrier());
  add(scene, 'barrel', paintBarrel());
  add(scene, 'wire_coil', paintWireCoil());
  add(scene, 'parapet', paintParapet());
  add(scene, 'frame', paintFrame());
  add(scene, 'shutters', paintShutters());
  add(scene, 'grain', paintGrain());
}
