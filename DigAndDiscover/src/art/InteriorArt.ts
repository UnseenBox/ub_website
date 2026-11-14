import type { MineralDef } from '../data/minerals';
import type { Rng } from '../core/Random';
import { TAU, blobPath, blobPoints, css, darken, ellipse, hsl, lighten, mix, polygon, star, type Pt } from './paint';

/**
 * Cross-section painters, one per InteriorStyle. Each paints inside an
 * already-clipped region of radius `r` centered at (cx, cy).
 */
type InteriorPainter = (ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, r: number, m: MineralDef) => void;

function fillAll(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
}

function speckle(ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, r: number, count: number, colors: string[], size: number): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r;
    ctx.fillStyle = colors[i % colors.length];
    ellipse(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * (0.5 + rng()), size * (0.4 + rng() * 0.6), rng() * TAU);
  }
}

function sparkles(ctx: CanvasRenderingContext2D, rng: Rng, cx: number, cy: number, r: number, count: number, color: string): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r;
    star(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.06 + rng() * 0.1), color);
  }
}

/** One prism crystal pointing along `angle`, with a lit and a shaded face. */
function crystal(ctx: CanvasRenderingContext2D, bx: number, by: number, angle: number, len: number, w: number, color: number): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const p = (along: number, side: number): Pt => ({ x: bx + dx * along + px * side, y: by + dy * along + py * side });
  const baseL = p(0, w);
  const baseR = p(0, -w);
  const shL = p(len * 0.72, w);
  const shR = p(len * 0.72, -w);
  const mid = p(len * 0.72, 0);
  const tip = p(len, 0);
  const baseM = p(0, 0);

  ctx.fillStyle = css(color);
  polygon(ctx, [baseL, shL, tip, shR, baseR]);
  ctx.fill();
  ctx.fillStyle = css(darken(color, 0.28), 0.55);
  polygon(ctx, [baseM, mid, tip, shR, baseR]);
  ctx.fill();
  ctx.fillStyle = css(lighten(color, 0.55), 0.6);
  polygon(ctx, [shL, tip, mid]);
  ctx.fill();
  ctx.strokeStyle = css(lighten(color, 0.8), 0.8);
  ctx.lineWidth = Math.max(1, w * 0.18);
  ctx.beginPath();
  ctx.moveTo(baseL.x, baseL.y);
  ctx.lineTo(shL.x, shL.y);
  ctx.stroke();
  ctx.strokeStyle = css(darken(color, 0.45), 0.5);
  ctx.lineWidth = Math.max(1, w * 0.1);
  polygon(ctx, [baseL, shL, tip, shR, baseR]);
  ctx.stroke();
}

/** Faceted cut gem, lit from the upper left. */
function gem(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, g: number, main: number, deep: number): void {
  const sides = 6;
  const rot = rng() * 0.4 - 0.2 + Math.PI / 6;
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    outer.push({ x: x + Math.cos(a) * g, y: y + Math.sin(a) * g * 0.9 });
    inner.push({ x: x + Math.cos(a) * g * 0.55, y: y + Math.sin(a) * g * 0.5 });
  }
  ctx.fillStyle = css(deep);
  polygon(ctx, outer);
  ctx.fill();
  const light = -2.3;
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const midA = rot + ((i + 0.5) / sides) * TAU;
    const l = 0.5 + 0.5 * Math.cos(midA - light);
    ctx.fillStyle = css(mix(darken(main, 0.4), lighten(main, 0.5), l));
    polygon(ctx, [outer[i], outer[j], inner[j], inner[i]]);
    ctx.fill();
  }
  const table = ctx.createLinearGradient(x - g * 0.5, y - g * 0.5, x + g * 0.5, y + g * 0.5);
  table.addColorStop(0, css(lighten(main, 0.45)));
  table.addColorStop(1, css(main));
  ctx.fillStyle = table;
  polygon(ctx, inner);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  polygon(ctx, [inner[3], inner[4], { x: x - g * 0.05, y: y - g * 0.05 }]);
  ctx.fill();
  ctx.strokeStyle = css(darken(deep, 0.35), 0.8);
  ctx.lineWidth = Math.max(1.5, g * 0.035);
  polygon(ctx, outer);
  ctx.stroke();
  star(ctx, outer[4].x + g * 0.1, outer[4].y + g * 0.15, g * 0.22, 'rgba(255,255,255,0.9)');
}

function glow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: number, strength: number): void {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, css(color, strength));
  g.addColorStop(1, css(color, 0));
  fillAll(ctx, cx, cy, r, g);
  ctx.globalCompositeOperation = prev;
}

const plain: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.1);
  g.addColorStop(0, css(m.colors[2]));
  g.addColorStop(1, css(m.colors[1]));
  fillAll(ctx, cx, cy, r, g);
  speckle(ctx, rng, cx, cy, r, 90, ['rgba(255,255,255,0.22)', 'rgba(0,0,0,0.18)', css(m.colors[0], 0.7)], r * 0.035);
  ctx.strokeStyle = 'rgba(40,35,30,0.35)';
  ctx.lineWidth = Math.max(1.5, r * 0.025);
  for (let c = 0; c < 2; c++) {
    let x = cx + (rng() - 0.5) * r;
    let y = cy - r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rng() - 0.5) * r * 0.35;
      y += r * 0.34;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

const cluster: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  const g = ctx.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r * 1.1);
  g.addColorStop(0, css(darken(m.colors[1], 0.35)));
  g.addColorStop(1, css(m.colors[1]));
  fillAll(ctx, cx, cy, r, g);
  speckle(ctx, rng, cx, cy, r, 40, [css(m.colors[2], 0.6), 'rgba(255,255,255,0.4)'], r * 0.03);
  // Small crystals hanging from the top.
  for (let i = 0; i < 5; i++) {
    const bx = cx + (i / 4 - 0.5) * r * 1.2 + (rng() - 0.5) * r * 0.1;
    crystal(ctx, bx, cy - r * 0.95, Math.PI / 2 + (rng() - 0.5) * 0.5, r * (0.3 + rng() * 0.2), r * 0.08, lighten(m.colors[0], 0.1));
  }
  // Big crystals rising from the bottom.
  const n = 7 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const bx = cx + t * r * 1.4 + (rng() - 0.5) * r * 0.1;
    const angle = -Math.PI / 2 + t * 0.9 + (rng() - 0.5) * 0.3;
    crystal(ctx, bx, cy + r * 0.95, angle, r * (0.75 + rng() * 0.45), r * (0.1 + rng() * 0.06), m.colors[0]);
  }
};

const banded: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  let k = 0;
  for (let s = 1.15; s > 0.1; s -= 0.085) {
    const path = blobPath(blobPoints(rng, 10, 0.14, 0.88), cx + (rng() - 0.5) * r * 0.06, cy + (rng() - 0.5) * r * 0.06, r * s);
    ctx.fillStyle = css(m.colors[k % m.colors.length]);
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.stroke(path);
    k++;
  }
  sparkles(ctx, rng, cx, cy, r * 0.12, 5, css(lighten(m.colors[0], 0.7)));
};

const geode: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  const [crys, band, hollow] = m.colors;
  fillAll(ctx, cx, cy, r, css(band));
  const rows: [number, number, number, number][] = [
    // count, base radius, min tip, tip range
    [30, 1.05, 0.42, 0.2],
    [22, 0.66, 0.3, 0.1],
  ];
  rows.forEach(([n, r1, tipMin, tipRange], row) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng() * 0.12;
      const half = (Math.PI / n) * 1.2;
      const b1 = { x: cx + Math.cos(a - half) * r * r1, y: cy + Math.sin(a - half) * r * r1 };
      const b2 = { x: cx + Math.cos(a + half) * r * r1, y: cy + Math.sin(a + half) * r * r1 };
      const tr = r * (tipMin + rng() * tipRange);
      const ta = a + (rng() - 0.5) * 0.12;
      const tip = { x: cx + Math.cos(ta) * tr, y: cy + Math.sin(ta) * tr };
      const shadeT = rng() * 0.25;
      const color = row === 0 ? mix(crys, darken(crys, 0.3), shadeT) : lighten(crys, 0.2 + shadeT);
      ctx.fillStyle = css(color);
      polygon(ctx, [b1, tip, b2]);
      ctx.fill();
      ctx.fillStyle = css(lighten(color, 0.5), 0.45);
      polygon(ctx, [b1, tip, { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 }]);
      ctx.fill();
      ctx.strokeStyle = css(darken(color, 0.4), 0.35);
      ctx.lineWidth = Math.max(1, r * 0.01);
      polygon(ctx, [b1, tip, b2]);
      ctx.stroke();
    }
  });
  const hp = blobPath(blobPoints(rng, 9, 0.25, 0.9), cx, cy, r * 0.32);
  const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.32);
  hg.addColorStop(0, css(darken(hollow, 0.35)));
  hg.addColorStop(1, css(hollow));
  ctx.fillStyle = hg;
  ctx.fill(hp);
  sparkles(ctx, rng, cx, cy, r * 0.28, 7, css(lighten(crys, 0.6), 0.9));
  if (m.glow) glow(ctx, cx, cy, r * 1.05, crys, 0.45);
};

const gemStyle: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.1);
  g.addColorStop(0, '#ebe4d8');
  g.addColorStop(1, '#bfb5a6');
  fillAll(ctx, cx, cy, r, g);
  speckle(ctx, rng, cx, cy, r, 60, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.5)', css(m.colors[1], 0.35)], r * 0.03);
  ctx.fillStyle = css(darken(m.colors[1], 0.35), 0.45);
  ctx.fill(blobPath(blobPoints(rng, 9, 0.18, 0.95), cx, cy, r * 0.66));
  glow(ctx, cx, cy, r * 0.8, m.colors[0], 0.3);
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    const d = r * (0.7 + rng() * 0.15);
    gem(ctx, rng, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.07 + rng() * 0.05), m.colors[0], m.colors[1]);
  }
  gem(ctx, rng, cx, cy, r * 0.52, m.colors[0], m.colors[1]);
};

const opal: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, css(m.colors[0]));
  fillAll(ctx, cx, cy, r, g);
  for (let i = 0; i < 38; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r;
    const color = m.colors[1 + Math.floor(rng() * (m.colors.length - 1))];
    ctx.fillStyle = css(color, 0.55 + rng() * 0.3);
    ctx.fill(blobPath(blobPoints(rng, 7, 0.35, 0.8), cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.07 + rng() * 0.15)));
  }
  sparkles(ctx, rng, cx, cy, r * 0.9, 12, 'rgba(255,255,255,0.95)');
};

const prism: InteriorPainter = (ctx, rng, cx, cy, r, m) => {
  fillAll(ctx, cx, cy, r, css(m.colors[1]));
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const half = (Math.PI / n) * 1.2;
    const color = hsl((i / n) * 360, 0.85, 0.66);
    const b1 = { x: cx + Math.cos(a - half) * r * 1.05, y: cy + Math.sin(a - half) * r * 1.05 };
    const b2 = { x: cx + Math.cos(a + half) * r * 1.05, y: cy + Math.sin(a + half) * r * 1.05 };
    const tr = r * (0.4 + rng() * 0.2);
    const tip = { x: cx + Math.cos(a) * tr, y: cy + Math.sin(a) * tr };
    ctx.fillStyle = css(color);
    polygon(ctx, [b1, tip, b2]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    polygon(ctx, [b1, tip, { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 }]);
    ctx.fill();
  }
  ctx.fillStyle = css(darken(m.colors[1], 0.3));
  ctx.fill(blobPath(blobPoints(rng, 9, 0.2, 0.9), cx, cy, r * 0.4));
  glow(ctx, cx, cy, r, 0xffffff, 0.35);
  gem(ctx, rng, cx, cy, r * 0.3, m.colors[0], darken(m.colors[0], 0.45));
};

export const INTERIOR_PAINTERS: Record<MineralDef['style'], InteriorPainter> = {
  plain,
  cluster,
  banded,
  geode,
  gem: gemStyle,
  opal,
  prism,
};
