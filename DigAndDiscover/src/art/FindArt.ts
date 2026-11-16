import type Phaser from 'phaser';
import { mulberry32, type Rng } from '../core/Random';
import { css, darken, lighten, makeCanvasTexture, TAU } from './paint';
import type { FindDef } from '../data/finds';

/**
 * Procedural artwork for finds.
 *
 * Every picture is drawn with plain Canvas 2D primitives in a normalised
 * 100x100 box (the centre is 0,0, the usable area is roughly -40..40, so the
 * picture keeps about an 8% margin). Shapes are chunky, rounded and friendly:
 * a fat dark brown outline, a soft gradient body, one white highlight and a
 * couple of details.
 *
 * Randomness is seeded from the def id, so a find always looks the same and
 * nothing ever uses Math.random.
 */

const OUTLINE = '#3b2616';
const SILHOUETTE = '#3b2616';

/** Palette colour with a safe fallback. */
function pal(def: FindDef, index: number): number {
  const p = def.palette;
  if (!p.length) return 0x808080;
  return p[Math.min(index, p.length - 1)];
}

/** Stable hash of a def id, used to seed the per-find randomness. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Body gradient from the light side of the palette to the dark side. */
function bodyGradient(ctx: CanvasRenderingContext2D, c0: number, c1: number): CanvasGradient {
  const g = ctx.createLinearGradient(-32, -34, 26, 32);
  g.addColorStop(0, css(lighten(c0, 0.3)));
  g.addColorStop(0.55, css(c0));
  g.addColorStop(1, css(darken(c1, 0.18)));
  return g;
}

/** Builds the current path, fills it with the body gradient and outlines it. */
function body(
  ctx: CanvasRenderingContext2D,
  build: () => void,
  c0: number,
  c1: number,
  lineWidth = 2.2,
): void {
  ctx.beginPath();
  build();
  ctx.fillStyle = bodyGradient(ctx, c0, c1);
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** Soft white highlight. */
function shine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = -0.55,
  alpha = 0.55,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), rot, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A few dark specks (rust, dirt, wear). */
function speckle(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  count: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  rMin = 0.7,
  rMax = 2,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const px = x + rng() * w;
    const py = y + rng() * h;
    const r = rMin + rng() * (rMax - rMin);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
}

/** A few engraved / scratched lines. */
function scratches(
  ctx: CanvasRenderingContext2D,
  segs: number[][],
  color: string,
  lineWidth = 1.3,
  alpha = 0.8,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const s of segs) {
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(s[2], s[3]);
  }
  ctx.stroke();
  ctx.restore();
}

/** Circle path helper. */
function circlePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.arc(x, y, r, 0, TAU);
}

/** Rounded rectangle path helper. */
function rectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A toothed gear outline. */
function gearPath(ctx: CanvasRenderingContext2D, x: number, y: number, rOuter: number, rInner: number, teeth: number): void {
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const b = a + step * 0.28;
    const c = a + step * 0.5;
    const d = a + step * 0.78;
    const px = (ang: number, rad: number) => [x + Math.cos(ang) * rad, y + Math.sin(ang) * rad] as const;
    const p0 = px(a, rInner);
    const p1 = px(b, rOuter);
    const p2 = px(c, rOuter);
    const p3 = px(d, rInner);
    if (i === 0) ctx.moveTo(p0[0], p0[1]);
    else ctx.lineTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
  }
  ctx.closePath();
}

/** Five pointed star path. */
function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5): void {
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.46;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ------------------------------------------------------------------
// painters
// ------------------------------------------------------------------

type Painter = (ctx: CanvasRenderingContext2D, def: FindDef, rng: Rng) => void;

/** Motifs used by the shared coin painter. */
const COIN_MOTIFS: Record<string, string> = {
  'copper-roman-coin': 'bust',
  'copper-worn-coin': 'star',
  'medieval-silver-penny': 'cross',
  'silver-roman-denarius': 'wolf',
  'gold-roman-solidus': 'laurel',
  'medieval-gold-noble': 'ship',
};

const paintCoin: Painter = (ctx, def, rng) => {
  const r = 21 + def.tier * 1.7;
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => circlePath(ctx, 0, 0, r), c0, c1, 2.4);
  ctx.strokeStyle = css(darken(c1, 0.25));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  circlePath(ctx, 0, 0, r - 4.6);
  ctx.stroke();

  const motif = COIN_MOTIFS[def.id] ?? 'star';
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.fillStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (motif === 'bust') {
    circlePath(ctx, 0, -5, r * 0.24);
    ctx.moveTo(-r * 0.34, r * 0.42);
    ctx.quadraticCurveTo(0, r * 0.02, r * 0.34, r * 0.42);
  } else if (motif === 'star') {
    starPath(ctx, 0, 0, r * 0.46);
  } else if (motif === 'cross') {
    ctx.moveTo(0, -r * 0.42);
    ctx.lineTo(0, r * 0.42);
    ctx.moveTo(-r * 0.42, 0);
    ctx.lineTo(r * 0.42, 0);
  } else if (motif === 'wolf') {
    ctx.moveTo(-r * 0.38, r * 0.18);
    ctx.lineTo(-r * 0.2, -r * 0.34);
    ctx.lineTo(0, -r * 0.06);
    ctx.lineTo(r * 0.2, -r * 0.34);
    ctx.lineTo(r * 0.38, r * 0.18);
    ctx.closePath();
    ctx.moveTo(-r * 0.2, r * 0.18);
    ctx.quadraticCurveTo(0, r * 0.44, r * 0.2, r * 0.18);
  } else if (motif === 'laurel') {
    ctx.moveTo(-r * 0.34, r * 0.34);
    ctx.quadraticCurveTo(0, -r * 0.42, r * 0.34, r * 0.34);
  } else {
    ctx.moveTo(-r * 0.36, r * 0.1);
    ctx.quadraticCurveTo(0, r * 0.44, r * 0.36, r * 0.1);
    ctx.moveTo(0, r * 0.24);
    ctx.lineTo(0, -r * 0.36);
  }
  ctx.stroke();

  if (motif === 'laurel') {
    ctx.fillStyle = css(darken(c1, 0.35));
    for (let i = 0; i < 4; i++) {
      const t = -0.3 + i * 0.2;
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, r * t, r * 0.1, r * 0.05, -0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.3, r * t, r * 0.1, r * 0.05, 0.5, 0, TAU);
      ctx.fill();
    }
  }

  shine(ctx, -r * 0.34, -r * 0.42, r * 0.26, r * 0.15, -0.6, 0.5);
  speckle(ctx, rng, 5, -r * 0.7, -r * 0.6, r * 1.4, r * 1.2, css(darken(c1, 0.35), 0.5));
};

const paintButton: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => circlePath(ctx, 0, 0, 24), c0, c1, 2.2);
  ctx.strokeStyle = css(darken(c1, 0.2));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  circlePath(ctx, 0, 0, 19);
  ctx.stroke();
  ctx.fillStyle = css(darken(c1, 0.45));
  for (const [hx, hy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    ctx.beginPath();
    circlePath(ctx, hx, hy, 2.6);
    ctx.fill();
  }
  shine(ctx, -7, -10, 6, 3.4, -0.6, 0.5);
  speckle(ctx, rng, 4, -18, -18, 36, 36, css(darken(c1, 0.3), 0.5));
};

const paintBeads: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = css(darken(c1, 0.3));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-28, -6);
  ctx.quadraticCurveTo(0, 22, 28, -6);
  ctx.stroke();
  const spots: [number, number, number][] = [
    [-24, 2, 8.5],
    [-12, 9, 9.5],
    [0, 12, 10],
    [12, 9, 9.5],
    [24, 2, 8.5],
  ];
  for (const [x, y, r] of spots) {
    body(ctx, () => circlePath(ctx, x, y, r), c0, c1, 1.8);
    shine(ctx, x - r * 0.3, y - r * 0.4, r * 0.3, r * 0.2, -0.6, 0.55);
  }
  speckle(ctx, rng, 3, -20, -8, 40, 26, css(darken(c1, 0.4), 0.4));
};

const paintHelmet: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  const gilded = def.id === 'gilded-helmet';
  body(ctx, () => {
    ctx.moveTo(-30, 10);
    ctx.quadraticCurveTo(-28, -26, 0, -26);
    ctx.quadraticCurveTo(28, -26, 30, 10);
    ctx.quadraticCurveTo(14, 16, 0, 16);
    ctx.quadraticCurveTo(-14, 16, -30, 10);
    ctx.closePath();
  }, c0, c1, 2.4);
  body(ctx, () => {
    ctx.moveTo(-33, 8);
    ctx.quadraticCurveTo(0, 22, 33, 8);
    ctx.quadraticCurveTo(33, 16, 0, 26);
    ctx.quadraticCurveTo(-33, 16, -33, 8);
    ctx.closePath();
  }, lighten(c0, 0.05), c1, 2.2);
  scratches(ctx, [[-18, -12, -4, -16], [8, -18, 20, -13]], css(darken(c1, 0.3), 0.6), 1.4);
  if (gilded) {
    ctx.fillStyle = css(darken(c1, 0.35));
    ctx.beginPath();
    ctx.moveTo(-4, -24);
    ctx.quadraticCurveTo(2, -40, 12, -34);
    ctx.quadraticCurveTo(4, -30, 4, -22);
    ctx.closePath();
    ctx.fill();
  }
  shine(ctx, -13, -14, 7, 4, -0.6, 0.5);
  speckle(ctx, rng, 6, -24, -20, 48, 40, css(darken(c1, 0.35), 0.45));
};

const paintShell: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-16, -30);
    ctx.lineTo(16, -30);
    ctx.lineTo(13, 30);
    ctx.lineTo(-13, 30);
    ctx.closePath();
  }, c0, c1, 2.2);
  body(ctx, () => {
    ctx.ellipse(0, -30, 16, 5.5, 0, 0, TAU);
  }, lighten(c0, 0.1), c1, 2);
  body(ctx, () => {
    ctx.ellipse(0, 30, 13, 4.5, 0, 0, TAU);
  }, c0, c1, 2);
  scratches(ctx, [[-9, -20, -8, 22], [0, -22, 1, 24], [9, -18, 8, 20]], css(darken(c1, 0.35), 0.45), 1.2);
  shine(ctx, -8, -12, 3.5, 12, 0, 0.45);
  speckle(ctx, rng, 7, -13, -26, 26, 54, css(darken(c1, 0.4), 0.5));
};

const paintPlane: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -30, -6, 60, 26, 6), c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-12, -6);
    ctx.quadraticCurveTo(-10, -30, 4, -30);
    ctx.quadraticCurveTo(14, -30, 14, -6);
    ctx.closePath();
  }, darken(c0, 0.05), c1, 2.2);
  body(ctx, () => rectPath(ctx, 20, -12, 12, 22, 4), pal(def, 2), c1, 2);
  ctx.fillStyle = css(darken(c1, 0.4));
  ctx.beginPath();
  ctx.ellipse(-24, 16, 6, 3.4, 0, 0, TAU);
  ctx.fill();
  scratches(ctx, [[-26, 2, -4, 4], [2, 6, 18, 4]], css(darken(c1, 0.35), 0.5), 1.3);
  shine(ctx, -18, -20, 6, 3, -0.5, 0.45);
  speckle(ctx, rng, 6, -28, -4, 56, 24, css(darken(c1, 0.3), 0.4));
};

const paintCalipers: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, 24);
  ctx.quadraticCurveTo(-26, 0, -20, -26);
  ctx.moveTo(2, 24);
  ctx.quadraticCurveTo(26, 0, 20, -26);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.35));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, 24);
  ctx.quadraticCurveTo(-26, 0, -20, -26);
  ctx.moveTo(2, 24);
  ctx.quadraticCurveTo(26, 0, 20, -26);
  ctx.stroke();
  body(ctx, () => circlePath(ctx, 0, 8, 5.5), c0, c1, 2);
  shine(ctx, -20, -22, 3, 5, 0.2, 0.5);
  speckle(ctx, rng, 5, -26, -26, 52, 52, css(darken(c1, 0.35), 0.4));
};

const paintTongs: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-22, -32);
  ctx.quadraticCurveTo(-6, -8, 0, 26);
  ctx.moveTo(22, -32);
  ctx.quadraticCurveTo(6, -8, 0, 26);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.3));
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-22, -32);
  ctx.quadraticCurveTo(-6, -8, 0, 26);
  ctx.moveTo(22, -32);
  ctx.quadraticCurveTo(6, -8, 0, 26);
  ctx.stroke();
  body(ctx, () => circlePath(ctx, 0, 30, 5), c0, c1, 2);
  shine(ctx, -22, -28, 3, 4.5, 0.1, 0.45);
  speckle(ctx, rng, 7, -24, -32, 48, 58, css(0x8a5a33, 0.45));
};

const paintDrill: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-22, -16);
  ctx.lineTo(-22, 20);
  ctx.lineTo(22, 20);
  ctx.lineTo(22, -16);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.28));
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-22, -16);
  ctx.lineTo(-22, 20);
  ctx.lineTo(22, 20);
  ctx.lineTo(22, -16);
  ctx.stroke();
  body(ctx, () => rectPath(ctx, -8, -34, 16, 20, 5), c0, c1, 2.2);
  body(ctx, () => {
    ctx.moveTo(-3, -14);
    ctx.lineTo(3, -14);
    ctx.lineTo(1.5, 16);
    ctx.lineTo(-1.5, 16);
    ctx.closePath();
  }, pal(def, 2), c1, 1.8);
  shine(ctx, -4, -28, 3, 4, 0, 0.45);
  speckle(ctx, rng, 5, -24, -34, 48, 56, css(darken(c1, 0.3), 0.4));
};

const paintFlask: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-9, -26);
    ctx.lineTo(9, -26);
    ctx.lineTo(9, -12);
    ctx.quadraticCurveTo(22, -6, 22, 12);
    ctx.quadraticCurveTo(22, 32, 0, 32);
    ctx.quadraticCurveTo(-22, 32, -22, 12);
    ctx.quadraticCurveTo(-22, -6, -9, -12);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, -11, -34, 22, 9, 3), pal(def, 2), c1, 2);
  scratches(ctx, [[-14, 4, 14, 2], [-14, 14, 12, 12]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -11, -4, 4, 12, 0.1, 0.45);
  speckle(ctx, rng, 7, -20, -30, 40, 62, css(darken(c1, 0.35), 0.4));
};

const paintBracelet: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.ellipse(0, 0, 28, 22, 0, 0, TAU);
    ctx.ellipse(0, 0, 17, 12, 0, 0, TAU);
  }, c0, c1, 2.3);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 12, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  scratches(ctx, [[-24, -10, -18, -16], [16, -14, 24, -8], [-12, 14, 4, 18]], css(darken(c1, 0.4), 0.6), 1.4);
  shine(ctx, -18, -14, 5, 3, -0.6, 0.5);
  speckle(ctx, rng, 6, -26, -20, 52, 40, css(0x7a6a3a, 0.45));
};

const paintCannonball: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => circlePath(ctx, 0, 0, 30), c0, c1, 2.4);
  shine(ctx, -12, -14, 8, 5, -0.6, 0.35);
  speckle(ctx, rng, 12, -26, -26, 52, 52, css(0x7a4a2a, 0.5), 1, 3);
  speckle(ctx, rng, 6, -24, -24, 48, 48, css(darken(c1, 0.4), 0.4));
};

const paintWatch: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => circlePath(ctx, 0, 4, 24), c0, c1, 2.3);
  body(ctx, () => circlePath(ctx, 0, 4, 18), pal(def, 2), c1, 1.8);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, -8);
  ctx.moveTo(0, 4);
  ctx.lineTo(9, 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, 4);
  ctx.stroke();
  body(ctx, () => rectPath(ctx, -4, -26, 8, 7, 2.5), c0, c1, 1.8);
  body(ctx, () => circlePath(ctx, 0, -30, 4), c0, c1, 1.8);
  shine(ctx, -10, -6, 6, 3.4, -0.6, 0.5);
  speckle(ctx, rng, 4, -20, -18, 40, 44, css(darken(c1, 0.35), 0.4));
};

const paintGears: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => gearPath(ctx, -10, 6, 26, 18, 10), c0, c1, 2.2);
  body(ctx, () => gearPath(ctx, 18, -14, 17, 11, 8), lighten(c0, 0.08), c1, 2.2);
  ctx.fillStyle = css(darken(c1, 0.4));
  ctx.beginPath();
  circlePath(ctx, -10, 6, 6);
  ctx.fill();
  ctx.beginPath();
  circlePath(ctx, 18, -14, 4);
  ctx.fill();
  shine(ctx, -22, -6, 5, 3, -0.6, 0.4);
  speckle(ctx, rng, 6, -30, -22, 60, 52, css(darken(c1, 0.3), 0.35));
};

const paintTelescope: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.save();
  ctx.rotate(-0.32);
  body(ctx, () => {
    ctx.moveTo(-34, -9);
    ctx.lineTo(26, -13);
    ctx.lineTo(26, 13);
    ctx.lineTo(-34, 9);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, 24, -16, 12, 32, 4), pal(def, 2), c1, 2);
  body(ctx, () => rectPath(ctx, -40, -7, 9, 14, 3), pal(def, 2), c1, 2);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-6, -11.5);
  ctx.lineTo(-6, 10.5);
  ctx.moveTo(10, -12.5);
  ctx.lineTo(10, 12);
  ctx.stroke();
  ctx.restore();
  shine(ctx, -14, -16, 8, 3, -0.2, 0.45);
  speckle(ctx, rng, 5, -30, -18, 56, 40, css(darken(c1, 0.35), 0.4));
};

const paintCamera: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -30, -12, 52, 34, 5), c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(20, -12);
    ctx.lineTo(34, -4);
    ctx.lineTo(34, 22);
    ctx.lineTo(20, 22);
    ctx.closePath();
  }, lighten(c0, 0.06), c1, 2.1);
  body(ctx, () => circlePath(ctx, 30, 9, 10), pal(def, 2), c1, 2);
  body(ctx, () => circlePath(ctx, 30, 9, 5), darken(c1, 0.2), c1, 1.6);
  body(ctx, () => rectPath(ctx, -24, -22, 18, 12, 3), darken(c0, 0.1), c1, 1.9);
  shine(ctx, -16, 0, 7, 3.4, -0.5, 0.4);
  speckle(ctx, rng, 6, -28, -10, 54, 30, css(0x4a3628, 0.4));
};

const paintKeys: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  const rows: [number, number][] = [
    [-18, -14],
    [0, -4],
    [-18, 6],
  ];
  for (const [x, y] of rows) {
    body(ctx, () => {
      ctx.moveTo(x - 11, y - 8);
      ctx.lineTo(x + 11, y - 8);
      ctx.lineTo(x + 9, y + 8);
      ctx.lineTo(x - 9, y + 8);
      ctx.closePath();
    }, c0, c1, 2);
    body(ctx, () => circlePath(ctx, x, y - 1, 5.4), pal(def, 2), c1, 1.6);
    ctx.fillStyle = css(darken(c1, 0.4));
    ctx.beginPath();
    ctx.arc(x, y - 1, 2, 0, TAU);
    ctx.fill();
  }
  scratches(ctx, [[-26, 14, -8, 16]], css(darken(c1, 0.4), 0.5), 1.2);
  shine(ctx, -22, -18, 5, 2.4, -0.4, 0.45);
  speckle(ctx, rng, 5, -28, -20, 50, 44, css(darken(c1, 0.25), 0.4));
};

const paintRing: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.ellipse(0, 12, 20, 18, 0, 0, TAU);
    ctx.ellipse(0, 12, 11, 9, 0, 0, TAU);
  }, c0, c1, 2.3);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(0, 12, 11, 9, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  body(ctx, () => {
    ctx.ellipse(0, -10, 15, 12, 0, 0, TAU);
  }, lighten(c0, 0.1), c1, 2.2);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(6, -10);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, -6);
  ctx.stroke();
  shine(ctx, -6, -16, 4, 2.4, -0.6, 0.55);
  speckle(ctx, rng, 4, -20, -20, 40, 44, css(darken(c1, 0.3), 0.35));
};

const paintBrooch: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-24, 4);
    ctx.quadraticCurveTo(-18, -18, 0, -14);
    ctx.quadraticCurveTo(18, -10, 22, 8);
    ctx.quadraticCurveTo(10, 22, -4, 18);
    ctx.quadraticCurveTo(-18, 14, -24, 4);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-14, 2);
  ctx.quadraticCurveTo(0, -6, 12, 2);
  ctx.moveTo(-10, 10);
  ctx.quadraticCurveTo(0, 2, 10, 10);
  ctx.stroke();
  body(ctx, () => {
    ctx.moveTo(20, 4);
    ctx.lineTo(32, 8);
    ctx.lineTo(20, 12);
    ctx.closePath();
  }, lighten(c0, 0.1), c1, 1.8);
  shine(ctx, -10, -10, 6, 3, -0.5, 0.5);
  speckle(ctx, rng, 5, -22, -14, 44, 34, css(darken(c1, 0.3), 0.35));
};

const paintLocket: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.ellipse(0, 6, 24, 28, 0, 0, TAU);
  }, c0, c1, 2.4);
  body(ctx, () => {
    ctx.ellipse(0, 6, 18, 22, 0, 0, TAU);
  }, lighten(c0, 0.08), c1, 1.6);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.bezierCurveTo(-9, -2, -6, 12, 0, 16);
  ctx.bezierCurveTo(6, 12, 9, -2, 0, -12);
  ctx.stroke();
  body(ctx, () => circlePath(ctx, 0, -28, 5), c0, c1, 1.8);
  shine(ctx, -11, -8, 5, 8, 0.3, 0.5);
  speckle(ctx, rng, 5, -22, -20, 44, 54, css(darken(c1, 0.3), 0.35));
};

const paintIdol: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -24, 24, 48, 12, 3), darken(c0, 0.12), c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-15, 24);
    ctx.quadraticCurveTo(-20, 2, -13, -14);
    ctx.lineTo(13, -14);
    ctx.quadraticCurveTo(20, 2, 15, 24);
    ctx.closePath();
  }, c0, c1, 2.4);
  body(ctx, () => {
    ctx.moveTo(-9, -14);
    ctx.lineTo(9, -14);
    ctx.lineTo(7, -28);
    ctx.quadraticCurveTo(0, -40, -7, -28);
    ctx.closePath();
  }, lighten(c0, 0.08), c1, 2.3);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, -24);
  ctx.lineTo(-1.5, -22);
  ctx.moveTo(5, -24);
  ctx.lineTo(1.5, -22);
  ctx.stroke();
  body(ctx, () => rectPath(ctx, -22, -10, 9, 22, 4), lighten(c0, 0.05), c1, 2);
  body(ctx, () => rectPath(ctx, 13, -10, 9, 22, 4), lighten(c0, 0.05), c1, 2);
  scratches(ctx, [[-8, 4, 8, 4], [-8, 12, 8, 12]], css(darken(c1, 0.4), 0.5), 1.4);
  shine(ctx, -6, -30, 4, 5, 0.2, 0.55);
  speckle(ctx, rng, 6, -22, -32, 44, 60, css(darken(c1, 0.25), 0.3));
};

const paintCrown: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-28, 18);
    ctx.lineTo(-28, -10);
    ctx.lineTo(-14, 4);
    ctx.lineTo(0, -16);
    ctx.lineTo(14, 4);
    ctx.lineTo(28, -10);
    ctx.lineTo(28, 18);
    ctx.closePath();
  }, c0, c1, 2.4);
  body(ctx, () => rectPath(ctx, -28, 16, 56, 12, 4), lighten(c0, 0.06), c1, 2.2);
  ctx.fillStyle = css(0xb03a5a);
  for (const [gx, gy] of [[-14, 12], [0, 12], [14, 12]]) {
    ctx.beginPath();
    circlePath(ctx, gx, gy, 3.6);
    ctx.fill();
  }
  scratches(ctx, [[-24, 22, -6, 24], [2, 22, 22, 24]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -14, -6, 5, 6, 0.2, 0.5);
  speckle(ctx, rng, 5, -26, -12, 52, 40, css(darken(c1, 0.3), 0.3));
};

const paintTablet: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -24, -32, 48, 64, 5), c0, c1, 2.4);
  ctx.strokeStyle = css(darken(c1, 0.45));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const rows: number[][] = [];
  for (let r = 0; r < 6; r++) {
    const y = -24 + r * 10;
    for (let c = 0; c < 3; c++) {
      const x = -15 + c * 11;
      rows.push([x, y, x + 5, y]);
      rows.push([x + 5, y, x + 5, y + 4]);
      rows.push([x + 5, y + 4, x + 9, y + 4]);
    }
  }
  ctx.moveTo(rows[0][0], rows[0][1]);
  for (const s of rows) ctx.lineTo(s[2], s[3]);
  ctx.stroke();
  shine(ctx, -13, -24, 6, 8, 0.2, 0.45);
  speckle(ctx, rng, 6, -22, -30, 44, 60, css(darken(c1, 0.25), 0.35));
};

const paintSoldier: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -10, 6, 8, 22, 3), darken(c0, 0.2), c1, 2);
  body(ctx, () => rectPath(ctx, 2, 6, 8, 22, 3), darken(c0, 0.2), c1, 2);
  body(ctx, () => {
    ctx.moveTo(-12, -14);
    ctx.lineTo(12, -14);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-14, -12);
    ctx.lineTo(-26, -4);
    ctx.lineTo(-24, 2);
    ctx.lineTo(-13, -4);
    ctx.closePath();
  }, lighten(c0, 0.06), c1, 2);
  body(ctx, () => {
    ctx.moveTo(14, -12);
    ctx.lineTo(26, -4);
    ctx.lineTo(24, 2);
    ctx.lineTo(13, -4);
    ctx.closePath();
  }, lighten(c0, 0.06), c1, 2);
  body(ctx, () => circlePath(ctx, 0, -22, 10), pal(def, 2), c1, 2.2);
  body(ctx, () => {
    ctx.moveTo(-11, -26);
    ctx.quadraticCurveTo(0, -42, 11, -26);
    ctx.closePath();
  }, darken(c0, 0.25), c1, 2);
  ctx.fillStyle = css(darken(c1, 0.5));
  ctx.beginPath();
  ctx.arc(-3.5, -22, 1.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3.5, -22, 1.6, 0, TAU);
  ctx.fill();
  scratches(ctx, [[-22, -34, -18, 10]], css(0x6b4a28, 0.8), 2.4);
  shine(ctx, -5, -28, 3.4, 2.2, -0.5, 0.45);
  speckle(ctx, rng, 6, -26, -36, 52, 60, css(darken(c1, 0.3), 0.3));
};

const paintTop: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(0, -32);
    ctx.lineTo(26, 22);
    ctx.lineTo(-26, 22);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(26, 22);
  ctx.lineTo(-26, 22);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = css(pal(def, 2));
  ctx.fillRect(-30, -14, 60, 10);
  ctx.fillRect(-30, 6, 60, 8);
  ctx.restore();
  body(ctx, () => rectPath(ctx, -28, 20, 56, 8, 3), darken(c0, 0.15), c1, 2);
  body(ctx, () => rectPath(ctx, -3, 28, 6, 10, 2), pal(def, 2), c1, 1.8);
  shine(ctx, -10, -18, 4, 9, 0.15, 0.45);
  speckle(ctx, rng, 5, -24, -30, 48, 56, css(darken(c1, 0.3), 0.3));
};

const paintMouse: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(14, 12);
  ctx.quadraticCurveTo(34, 6, 30, -10);
  ctx.stroke();
  body(ctx, () => {
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-24, -14, -4, -16);
    ctx.quadraticCurveTo(18, -18, 20, 2);
    ctx.quadraticCurveTo(20, 16, -2, 18);
    ctx.quadraticCurveTo(-18, 18, -22, 8);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => circlePath(ctx, -12, -18, 8), lighten(c0, 0.08), c1, 2);
  body(ctx, () => circlePath(ctx, -12, -18, 4), pal(def, 2), c1, 1.4);
  ctx.fillStyle = css(darken(c1, 0.5));
  ctx.beginPath();
  ctx.arc(-2, -6, 2.2, 0, TAU);
  ctx.fill();
  shine(ctx, -12, -2, 6, 3, -0.4, 0.45);
  speckle(ctx, rng, 5, -22, -14, 40, 32, css(darken(c1, 0.25), 0.35));
};

const paintDuck: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-26, 10);
    ctx.quadraticCurveTo(-26, -6, -6, -6);
    ctx.quadraticCurveTo(12, -6, 18, 2);
    ctx.quadraticCurveTo(26, 18, -2, 20);
    ctx.quadraticCurveTo(-22, 20, -26, 10);
    ctx.closePath();
  }, c0, c1, 2.4);
  body(ctx, () => circlePath(ctx, -10, -16, 13), lighten(c0, 0.1), c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-22, -14);
    ctx.lineTo(-34, -10);
    ctx.lineTo(-22, -6);
    ctx.closePath();
  }, 0xe07a2a, c1, 1.8);
  ctx.fillStyle = css(darken(c1, 0.55));
  ctx.beginPath();
  ctx.arc(-12, -19, 2.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.quadraticCurveTo(4, -2, 18, 4);
  ctx.stroke();
  shine(ctx, -6, -24, 4.4, 3, -0.5, 0.5);
  speckle(ctx, rng, 4, -26, -8, 48, 30, css(darken(c1, 0.2), 0.3));
};

const paintMug: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(22, 2, 11, -1.2, 1.2);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.3));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(22, 2, 11, -1.2, 1.2);
  ctx.stroke();
  body(ctx, () => rectPath(ctx, -24, -18, 40, 38, 5), c0, c1, 2.3);
  body(ctx, () => {
    ctx.ellipse(-4, -18, 20, 6, 0, 0, TAU);
  }, lighten(c0, 0.08), c1, 2);
  ctx.fillStyle = css(pal(def, 2));
  ctx.beginPath();
  ctx.ellipse(-4, -18, 16, 4, 0, 0, TAU);
  ctx.fill();
  scratches(ctx, [[-18, 4, -2, 6]], css(pal(def, 2), 0.8), 2.4);
  shine(ctx, -16, -6, 3.4, 8, 0.1, 0.45);
  speckle(ctx, rng, 6, -22, -16, 36, 34, css(darken(c1, 0.25), 0.3));
};

const paintShard: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-26, 14);
    ctx.lineTo(-14, -22);
    ctx.lineTo(16, -26);
    ctx.lineTo(26, 6);
    ctx.lineTo(4, 24);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.strokeStyle = css(darken(c1, 0.45));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.quadraticCurveTo(-2, -12, 6, -4);
  ctx.quadraticCurveTo(12, 2, 6, 8);
  ctx.stroke();
  scratches(ctx, [[-24, 12, -6, 18], [10, -20, 20, -6]], css(darken(c1, 0.4), 0.5), 1.4);
  shine(ctx, -14, -14, 6, 3.4, -0.5, 0.45);
  speckle(ctx, rng, 8, -24, -24, 48, 46, css(darken(c1, 0.3), 0.35));
};

const paintMarble: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => circlePath(ctx, 0, 0, 22), c0, c1, 2.2);
  ctx.strokeStyle = css(pal(def, 2));
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, 6);
  ctx.quadraticCurveTo(-2, -12, 12, -4);
  ctx.stroke();
  ctx.strokeStyle = css(darken(c1, 0.3));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, 12);
  ctx.quadraticCurveTo(2, 2, 14, 6);
  ctx.stroke();
  shine(ctx, -8, -10, 6, 3.4, -0.6, 0.6);
  speckle(ctx, rng, 3, -18, -18, 36, 36, css(darken(c1, 0.25), 0.3));
};

const paintKey: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-30, -12);
    ctx.quadraticCurveTo(-8, -28, 14, -14);
    ctx.quadraticCurveTo(20, -8, 14, -2);
    ctx.quadraticCurveTo(-8, -12, -28, 0);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  circlePath(ctx, -20, -11, 5.5);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  body(ctx, () => rectPath(ctx, 6, -8, 26, 9, 3), c0, c1, 2.2);
  body(ctx, () => rectPath(ctx, 22, -8, 6, 14, 2), c0, c1, 2);
  body(ctx, () => rectPath(ctx, 14, -8, 5, 11, 2), c0, c1, 2);
  shine(ctx, -10, -16, 7, 3, -0.4, 0.45);
  speckle(ctx, rng, 6, -28, -24, 54, 32, css(darken(c1, 0.3), 0.35));
};

const paintWhistle: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-6, -26);
    ctx.lineTo(6, -26);
    ctx.quadraticCurveTo(9, -6, 12, 18);
    ctx.quadraticCurveTo(12, 26, 4, 26);
    ctx.lineTo(-4, 26);
    ctx.quadraticCurveTo(-12, 26, -12, 18);
    ctx.quadraticCurveTo(-9, -6, -6, -26);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, -7, -32, 14, 8, 3), lighten(c0, 0.08), c1, 1.9);
  ctx.fillStyle = css(darken(c1, 0.5));
  ctx.beginPath();
  circlePath(ctx, 0, -12, 3.4);
  ctx.fill();
  ctx.beginPath();
  circlePath(ctx, 0, 14, 2.4);
  ctx.fill();
  shine(ctx, -5, -4, 2.6, 12, 0.05, 0.5);
  speckle(ctx, rng, 6, -10, -30, 20, 56, css(darken(c1, 0.25), 0.35));
};

const paintRobot: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -14, -6, 28, 26, 5), c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, -14, -34, 28, 24, 7), lighten(c0, 0.08), c1, 2.3);
  body(ctx, () => rectPath(ctx, -9, -20, 18, 8, 3), darken(c1, 0.25), c1, 1.8);
  ctx.fillStyle = css(pal(def, 2));
  ctx.beginPath();
  ctx.arc(-4, -16, 2.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, -16, 2.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.fillStyle = css(pal(def, 2));
  ctx.beginPath();
  ctx.arc(0, -45, 3, 0, TAU);
  ctx.fill();
  body(ctx, () => rectPath(ctx, -24, -6, 10, 8, 3), lighten(c0, 0.05), c1, 2);
  body(ctx, () => rectPath(ctx, 14, -6, 10, 8, 3), lighten(c0, 0.05), c1, 2);
  body(ctx, () => rectPath(ctx, -12, 20, 9, 12, 3), lighten(c0, 0.05), c1, 2);
  body(ctx, () => rectPath(ctx, 3, 20, 9, 12, 3), lighten(c0, 0.05), c1, 2);
  scratches(ctx, [[-10, 2, 10, 4]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -8, -30, 4, 6, 0.2, 0.5);
  speckle(ctx, rng, 6, -22, -44, 44, 70, css(darken(c1, 0.25), 0.3));
};

const paintDollHead: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-16, -12);
    ctx.quadraticCurveTo(-20, 12, 0, 18);
    ctx.quadraticCurveTo(20, 12, 16, -12);
    ctx.quadraticCurveTo(12, -26, 0, -26);
    ctx.quadraticCurveTo(-12, -26, -16, -12);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-17, -8);
    ctx.quadraticCurveTo(-26, -24, -6, -28);
    ctx.quadraticCurveTo(10, -34, 18, -20);
    ctx.quadraticCurveTo(24, -8, 15, -6);
    ctx.quadraticCurveTo(6, -20, -4, -14);
    ctx.quadraticCurveTo(-12, -8, -17, -8);
    ctx.closePath();
  }, pal(def, 1), darken(pal(def, 1), 0.2), 2.1);
  ctx.fillStyle = css(darken(c1, 0.55));
  ctx.beginPath();
  ctx.arc(-6, -4, 2.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -4, 2.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = css(pal(def, 2));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 3, 4.5, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.fillStyle = css(pal(def, 2), 0.35);
  ctx.beginPath();
  ctx.arc(-11, 2, 3.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(11, 2, 3.4, 0, TAU);
  ctx.fill();
  shine(ctx, -7, -16, 4, 3, -0.5, 0.45);
  speckle(ctx, rng, 5, -16, -26, 32, 46, css(darken(c1, 0.2), 0.3));
};

const paintTeapot: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.arc(20, -2, 11, -1.6, 1.6);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.3));
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(20, -2, 11, -1.6, 1.6);
  ctx.stroke();
  body(ctx, () => {
    ctx.moveTo(-26, 4);
    ctx.quadraticCurveTo(-26, -14, -6, -14);
    ctx.quadraticCurveTo(14, -14, 16, 4);
    ctx.quadraticCurveTo(18, 20, 0, 22);
    ctx.quadraticCurveTo(-20, 22, -26, 4);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-20, -10);
    ctx.quadraticCurveTo(-34, -16, -32, -2);
    ctx.quadraticCurveTo(-30, 8, -22, 6);
    ctx.closePath();
  }, lighten(c0, 0.06), c1, 2.1);
  body(ctx, () => {
    ctx.moveTo(-10, -14);
    ctx.quadraticCurveTo(-8, -26, 0, -26);
    ctx.quadraticCurveTo(8, -26, 10, -14);
    ctx.closePath();
  }, lighten(c0, 0.1), c1, 2);
  body(ctx, () => circlePath(ctx, 0, -28, 4), pal(def, 2), c1, 1.8);
  scratches(ctx, [[-14, 6, -2, 9]], css(darken(c1, 0.5), 0.7), 1.6);
  shine(ctx, -14, -6, 4, 6, 0.2, 0.45);
  speckle(ctx, rng, 7, -26, -26, 52, 48, css(darken(c1, 0.25), 0.3));
};

const paintLamp: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-18, 26);
    ctx.quadraticCurveTo(-22, 8, -8, 4);
    ctx.lineTo(8, 4);
    ctx.quadraticCurveTo(22, 8, 18, 26);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-9, 4);
    ctx.lineTo(9, 4);
    ctx.quadraticCurveTo(6, -8, 0, -10);
    ctx.quadraticCurveTo(-6, -8, -9, 4);
    ctx.closePath();
  }, lighten(c0, 0.08), c1, 2.1);
  body(ctx, () => {
    ctx.moveTo(-7, -10);
    ctx.lineTo(7, -10);
    ctx.quadraticCurveTo(11, -24, 6, -30);
    ctx.lineTo(-6, -30);
    ctx.quadraticCurveTo(-11, -24, -7, -10);
    ctx.closePath();
  }, pal(def, 2), c1, 2.1);
  ctx.fillStyle = css(0xf2a23c, 0.85);
  ctx.beginPath();
  ctx.ellipse(0, -32, 4, 6, 0, 0, TAU);
  ctx.fill();
  shine(ctx, -11, 16, 4, 6, 0.2, 0.45);
  speckle(ctx, rng, 7, -20, -30, 40, 56, css(darken(c1, 0.3), 0.35));
};

const paintMusicBox: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -28, -4, 56, 30, 4), c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-28, -4);
    ctx.lineTo(-28, -26);
    ctx.lineTo(4, -34);
    ctx.lineTo(4, -4);
    ctx.closePath();
  }, lighten(c0, 0.08), c1, 2.2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 4);
  ctx.lineTo(24, 4);
  ctx.lineTo(24, 14);
  ctx.stroke();
  ctx.fillStyle = css(pal(def, 2));
  ctx.beginPath();
  ctx.arc(-14, 10, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(-14, 10, 4, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = css(pal(def, 2));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, -20);
  ctx.bezierCurveTo(12, -26, 8, -32, 14, -34);
  ctx.moveTo(14, -20);
  ctx.bezierCurveTo(20, -26, 16, -32, 22, -34);
  ctx.stroke();
  shine(ctx, -16, -24, 6, 3, -0.5, 0.4);
  speckle(ctx, rng, 6, -26, -32, 52, 60, css(darken(c1, 0.25), 0.3));
};

const paintSnowglobe: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -24, 14, 48, 14, 4), darken(c0, 0.15), c1, 2.2);
  body(ctx, () => circlePath(ctx, 0, -8, 26), pal(def, 2), c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-12, 10);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-2, 10);
    ctx.closePath();
  }, 0x8a5a34, 0x5d3a1f, 1.7);
  body(ctx, () => {
    ctx.moveTo(-15, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(2, -10);
    ctx.lineTo(-11, -10);
    ctx.closePath();
  }, 0xa8483c, 0x6b2a22, 1.7);
  ctx.fillStyle = css(0xffffff, 0.85);
  for (let i = 0; i < 12; i++) {
    const x = -20 + rng() * 40;
    const y = -28 + rng() * 36;
    ctx.beginPath();
    ctx.arc(x, y, 1.1 + rng() * 0.9, 0, TAU);
    ctx.fill();
  }
  shine(ctx, -12, -20, 6, 8, 0.4, 0.6);
  speckle(ctx, rng, 3, -24, -32, 48, 50, css(darken(c1, 0.2), 0.25));
};

const paintMirror: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-4, 14);
    ctx.lineTo(4, 14);
    ctx.lineTo(3, 34);
    ctx.lineTo(-3, 34);
    ctx.closePath();
  }, lighten(c0, 0.05), c1, 2);
  body(ctx, () => {
    ctx.ellipse(0, -10, 20, 25, 0, 0, TAU);
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.ellipse(0, -10, 14, 19, 0, 0, TAU);
  }, 0xdfe8ee, 0x9fb0bb, 1.8);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, -22);
  ctx.quadraticCurveTo(0, -26, 8, -22);
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(0, 6, 8, 2);
  ctx.stroke();
  shine(ctx, -6, -20, 4, 7, 0.4, 0.6);
  speckle(ctx, rng, 5, -18, -32, 36, 44, css(darken(c1, 0.3), 0.3));
};

const paintAmmonite: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-2, 2);
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2.2;
      const r = 3 + i * 0.52;
      const x = Math.cos(t) * r * 0.9 - 4;
      const y = Math.sin(t) * r * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }, c0, c1, 2.2);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 1; i <= 26; i++) {
    const t = (i / 26) * Math.PI * 2.2;
    const r = 3 + i * 1.2;
    const x = Math.cos(t) * r * 0.9 - 4;
    const y = Math.sin(t) * r * 0.9;
    if (i === 1) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  shine(ctx, -14, -14, 6, 4, -0.5, 0.45);
  speckle(ctx, rng, 7, -24, -24, 46, 46, css(darken(c1, 0.25), 0.35));
};

const paintTrilobite: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.ellipse(0, 0, 22, 30, 0, 0, TAU);
  }, c0, c1, 2.3);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = -4; i <= 4; i++) {
    ctx.moveTo(-20, i * 5.4);
    ctx.quadraticCurveTo(0, i * 5.4 + 4, 20, i * 5.4);
  }
  ctx.stroke();
  body(ctx, () => {
    ctx.moveTo(-11, -28);
    ctx.quadraticCurveTo(0, -36, 11, -28);
    ctx.quadraticCurveTo(0, -22, -11, -28);
    ctx.closePath();
  }, lighten(c0, 0.1), c1, 1.9);
  shine(ctx, -8, -18, 5, 6, 0.3, 0.4);
  speckle(ctx, rng, 8, -20, -28, 40, 56, css(darken(c1, 0.3), 0.35));
};

const paintArrowhead: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(0, -32);
    ctx.lineTo(17, 14);
    ctx.lineTo(0, 4);
    ctx.lineTo(-17, 14);
    ctx.closePath();
  }, c0, c1, 2.3);
  scratches(ctx, [[0, -26, 2, 8], [-10, -6, -4, 10], [10, -6, 4, 10]], css(darken(c1, 0.4), 0.55), 1.3);
  shine(ctx, -6, -20, 3.4, 6, 0.3, 0.4);
  speckle(ctx, rng, 8, -15, -30, 30, 44, css(darken(c1, 0.25), 0.35));
};

const paintLighter: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -26, -10, 40, 30, 4), c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, -26, -10, 40, 9, 3), lighten(c0, 0.12), c1, 2);
  body(ctx, () => {
    ctx.ellipse(-6, -14, 8, 5, 0, 0, TAU);
  }, pal(def, 2), c1, 1.8);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.lineTo(2, 6);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-6, 12);
  ctx.stroke();
  shine(ctx, -18, -6, 5, 2.4, -0.4, 0.5);
  speckle(ctx, rng, 6, -24, -8, 36, 26, css(darken(c1, 0.25), 0.3));
};

const paintJackbox: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -28, 0, 56, 26, 4), c0, c1, 2.3);
  body(ctx, () => {
    ctx.moveTo(-28, 0);
    ctx.lineTo(-28, -18);
    ctx.lineTo(-6, -26);
    ctx.lineTo(-6, 0);
    ctx.closePath();
  }, lighten(c0, 0.1), c1, 2.2);
  body(ctx, () => circlePath(ctx, 4, -26, 12), pal(def, 2), c1, 2.2);
  ctx.fillStyle = css(0x2f3238);
  ctx.beginPath();
  ctx.arc(0, -28, 1.8, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, -28, 1.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = css(0xd8463c);
  ctx.beginPath();
  ctx.arc(5, -20, 3.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(24, 8);
  ctx.lineTo(32, 8);
  ctx.stroke();
  scratches(ctx, [[-22, 8, -8, 10], [2, 12, 18, 14]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -18, -18, 5, 3, -0.5, 0.4);
  speckle(ctx, rng, 6, -26, -26, 52, 50, css(darken(c1, 0.25), 0.3));
};

const paintPhone: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-22, 22);
    ctx.quadraticCurveTo(-26, 0, -14, -8);
    ctx.lineTo(14, -8);
    ctx.quadraticCurveTo(26, 0, 22, 22);
    ctx.closePath();
  }, c0, c1, 2.4);
  body(ctx, () => circlePath(ctx, 0, 8, 11), lighten(c0, 0.16), c1, 2);
  ctx.strokeStyle = css(darken(c1, 0.45));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 8, 7, 0, TAU);
  ctx.stroke();
  body(ctx, () => {
    ctx.moveTo(-26, -14);
    ctx.quadraticCurveTo(-20, -26, 0, -26);
    ctx.quadraticCurveTo(20, -26, 26, -14);
    ctx.quadraticCurveTo(20, -8, 0, -8);
    ctx.quadraticCurveTo(-20, -8, -26, -14);
    ctx.closePath();
  }, lighten(c0, 0.08), c1, 2.3);
  body(ctx, () => {
    ctx.ellipse(-18, -12, 6, 7, 0, 0, TAU);
    ctx.ellipse(18, -12, 6, 7, 0, 0, TAU);
  }, c0, c1, 2);
  shine(ctx, -12, -18, 7, 3.4, -0.4, 0.35);
  speckle(ctx, rng, 6, -22, -22, 44, 44, css(0x555a60, 0.4));
};

const paintRadio: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -30, -20, 60, 42, 6), c0, c1, 2.4);
  ctx.strokeStyle = css(darken(c1, 0.5));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(-24, -12 + i * 5);
    ctx.lineTo(6, -12 + i * 5);
  }
  ctx.stroke();
  body(ctx, () => circlePath(ctx, 18, -8, 6), pal(def, 2), c1, 1.8);
  body(ctx, () => circlePath(ctx, 18, 6, 6), pal(def, 2), c1, 1.8);
  scratches(ctx, [[-24, 18, 20, 18]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -16, -18, 8, 3, -0.4, 0.4);
  speckle(ctx, rng, 7, -28, -18, 56, 38, css(darken(c1, 0.25), 0.3));
};

const paintMask: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-20, -18);
    ctx.quadraticCurveTo(0, -32, 20, -18);
    ctx.quadraticCurveTo(24, 8, 0, 32);
    ctx.quadraticCurveTo(-24, 8, -20, -18);
    ctx.closePath();
  }, c0, c1, 2.4);
  ctx.fillStyle = css(darken(c1, 0.55));
  ctx.beginPath();
  ctx.ellipse(-8, -6, 4.4, 3, 0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8, -6, 4.4, 3, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = css(darken(c1, 0.5));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 12);
  ctx.quadraticCurveTo(0, 18, 8, 12);
  ctx.stroke();
  scratches(ctx, [[-14, -18, -10, 2], [14, -18, 10, 2], [0, -24, 0, -8]], css(darken(c1, 0.4), 0.5), 1.3);
  shine(ctx, -8, -22, 5, 3, -0.5, 0.45);
  speckle(ctx, rng, 9, -18, -26, 36, 52, css(darken(c1, 0.3), 0.35));
};

const paintThimble: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-18, 24);
    ctx.lineTo(-14, -8);
    ctx.quadraticCurveTo(-12, -22, 0, -22);
    ctx.quadraticCurveTo(12, -22, 14, -8);
    ctx.lineTo(18, 24);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.fillStyle = css(darken(c1, 0.35));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = -10 + c * 5 + (r % 2) * 2.4;
      const y = -14 + r * 7;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, TAU);
      ctx.fill();
    }
  }
  body(ctx, () => {
    ctx.ellipse(0, 24, 18, 5, 0, 0, TAU);
  }, lighten(c0, 0.05), c1, 1.9);
  shine(ctx, -8, -14, 3, 6, 0.2, 0.55);
  speckle(ctx, rng, 4, -14, -20, 28, 42, css(darken(c1, 0.25), 0.3));
};

const paintDecanter: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-26, 4, -24, 20);
    ctx.quadraticCurveTo(-22, 32, 0, 32);
    ctx.quadraticCurveTo(22, 32, 24, 20);
    ctx.quadraticCurveTo(26, 4, 10, -6);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => rectPath(ctx, -7, -22, 14, 18, 3), lighten(c0, 0.1), c1, 2);
  body(ctx, () => {
    ctx.moveTo(-9, -22);
    ctx.quadraticCurveTo(0, -34, 9, -22);
    ctx.closePath();
  }, pal(def, 2), c1, 1.9);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-14, 8);
  ctx.lineTo(-16, 26);
  ctx.moveTo(0, 6);
  ctx.lineTo(0, 30);
  ctx.moveTo(14, 8);
  ctx.lineTo(16, 26);
  ctx.stroke();
  shine(ctx, -14, 8, 5, 9, 0.2, 0.55);
  speckle(ctx, rng, 4, -20, -26, 40, 58, css(darken(c1, 0.2), 0.25));
};

const paintGlass: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-24, 20);
    ctx.lineTo(-14, -14);
    ctx.lineTo(2, -26);
    ctx.lineTo(20, -6);
    ctx.lineTo(10, 22);
    ctx.closePath();
  }, c0, c1, 2.2);
  scratches(ctx, [[-18, 10, -6, -10], [4, -18, 14, -4]], css(0xffffff, 0.5), 2);
  shine(ctx, -12, -12, 4, 7, 0.3, 0.45);
  speckle(ctx, rng, 5, -20, -22, 40, 44, css(darken(c1, 0.3), 0.3));
};

const paintCan: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-20, -18);
    ctx.lineTo(20, -18);
    ctx.lineTo(18, 20);
    ctx.lineTo(-18, 20);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.ellipse(0, -18, 20, 6, 0, 0, TAU);
  }, darken(c0, 0.2), c1, 2);
  ctx.fillStyle = css(darken(c1, 0.35));
  ctx.beginPath();
  ctx.ellipse(0, -18, 15, 4, 0, 0, TAU);
  ctx.fill();
  scratches(ctx, [[-16, -2, 16, 0], [-15, 10, 15, 8]], css(darken(c1, 0.35), 0.5), 1.3);
  speckle(ctx, rng, 14, -20, -18, 40, 38, css(0x8a4a22, 0.55), 0.9, 2.6);
  shine(ctx, -11, -8, 3, 9, 0.1, 0.3);
};

const paintNails: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  const nails: [number, number, number][] = [
    [-16, 6, -0.7],
    [2, -4, 0.5],
    [16, 12, 2.3],
  ];
  for (const [x, y, rot] of nails) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    body(ctx, () => {
      ctx.moveTo(-2.6, -18);
      ctx.lineTo(2.6, -18);
      ctx.lineTo(1.2, 16);
      ctx.lineTo(0, 22);
      ctx.lineTo(-1.2, 16);
      ctx.closePath();
    }, c0, c1, 1.9);
    body(ctx, () => rectPath(ctx, -6, -22, 12, 5, 2), c0, c1, 1.7);
    ctx.restore();
  }
  speckle(ctx, rng, 9, -24, -24, 48, 48, css(0x8a5a33, 0.5));
};

const paintSpoon: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  ctx.save();
  ctx.rotate(0.25);
  body(ctx, () => {
    ctx.ellipse(0, -16, 11, 15, 0, 0, TAU);
  }, c0, c1, 2.2);
  body(ctx, () => {
    ctx.moveTo(-4, -2);
    ctx.lineTo(4, -2);
    ctx.quadraticCurveTo(9, 18, 5, 32);
    ctx.lineTo(-5, 32);
    ctx.quadraticCurveTo(-9, 18, -4, -2);
    ctx.closePath();
  }, lighten(c0, 0.08), c1, 2.1);
  ctx.restore();
  shine(ctx, -12, -22, 4, 6, -0.4, 0.5);
  speckle(ctx, rng, 7, -18, -32, 36, 60, css(darken(c1, 0.25), 0.3));
};

const paintPlasticToy: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-18, 26);
    ctx.lineTo(-14, -6);
    ctx.quadraticCurveTo(-12, -26, 0, -26);
    ctx.quadraticCurveTo(12, -26, 14, -6);
    ctx.lineTo(18, 26);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.fillStyle = css(darken(c1, 0.45));
  ctx.beginPath();
  ctx.arc(-5, -14, 2.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5, -14, 2.2, 0, TAU);
  ctx.fill();
  scratches(ctx, [[-14, -2, -4, 4], [-4, 4, 4, -2], [4, -2, 12, 6]], css(darken(c1, 0.5), 0.85), 1.7);
  shine(ctx, -7, -22, 4, 3, -0.5, 0.4);
  speckle(ctx, rng, 5, -16, -24, 32, 48, css(darken(c1, 0.2), 0.3));
};

const paintWire: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.bezierCurveTo(-6, -26, 22, -18, 14, 6);
  ctx.bezierCurveTo(4, 28, -22, 22, -12, -2);
  ctx.bezierCurveTo(-4, -20, 20, -4, 24, 16);
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.3));
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.bezierCurveTo(-6, -26, 22, -18, 14, 6);
  ctx.bezierCurveTo(4, 28, -22, 22, -12, -2);
  ctx.bezierCurveTo(-4, -20, 20, -4, 24, 16);
  ctx.stroke();
  speckle(ctx, rng, 8, -26, -24, 52, 50, css(0x8a5a33, 0.45));
};

const paintSole: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-16, -30);
    ctx.quadraticCurveTo(0, -36, 16, -28);
    ctx.quadraticCurveTo(24, -6, 20, 20);
    ctx.quadraticCurveTo(10, 34, -8, 32);
    ctx.quadraticCurveTo(-22, 24, -20, 2);
    ctx.closePath();
  }, c0, c1, 2.3);
  ctx.fillStyle = css(darken(c1, 0.4));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.ellipse(-10 + c * 10, -18 + r * 10, 3, 3.6, 0, 0, TAU);
      ctx.fill();
    }
  }
  scratches(ctx, [[-16, 4, 16, 6]], css(darken(c1, 0.4), 0.5), 1.4);
  speckle(ctx, rng, 9, -18, -30, 36, 60, css(0x2f2620, 0.4));
};

const paintBottleCap: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-24, 0);
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * TAU;
      const r = i % 2 === 0 ? 24 : 20;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }, c0, c1, 2.1);
  body(ctx, () => circlePath(ctx, 0, 0, 15), lighten(c0, 0.1), c1, 1.9);
  shine(ctx, -6, -7, 5, 3.4, -0.6, 0.45);
  speckle(ctx, rng, 8, -20, -20, 40, 40, css(darken(c1, 0.3), 0.35));
};

const paintWrapper: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-26, 4);
    ctx.lineTo(-12, -22);
    ctx.lineTo(10, -18);
    ctx.lineTo(26, 2);
    ctx.lineTo(14, 24);
    ctx.lineTo(-14, 20);
    ctx.closePath();
  }, c0, c1, 2.2);
  scratches(ctx, [[-16, -6, 12, -2], [-10, 10, 14, 6], [-14, 16, 4, 20]], css(darken(c1, 0.35), 0.6), 1.4);
  shine(ctx, -10, -14, 7, 4, -0.4, 0.4);
  speckle(ctx, rng, 9, -24, -20, 48, 42, css(darken(c1, 0.25), 0.35));
};

const paintPipe: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-10, -26);
    ctx.quadraticCurveTo(-16, -8, -12, 6);
    ctx.lineTo(12, 6);
    ctx.quadraticCurveTo(16, -8, 10, -26);
    ctx.closePath();
  }, c0, c1, 2.2);
  body(ctx, () => {
    ctx.moveTo(-5, 6);
    ctx.lineTo(5, 6);
    ctx.quadraticCurveTo(7, 24, 3, 34);
    ctx.lineTo(-3, 34);
    ctx.quadraticCurveTo(-7, 24, -5, 6);
    ctx.closePath();
  }, lighten(c0, 0.06), c1, 2);
  ctx.fillStyle = css(darken(c1, 0.55));
  ctx.beginPath();
  ctx.ellipse(0, -26, 10, 4, 0, 0, TAU);
  ctx.fill();
  shine(ctx, -7, -14, 3, 7, 0.1, 0.4);
  speckle(ctx, rng, 8, -14, -26, 28, 58, css(darken(c1, 0.3), 0.35));
};

const paintComb: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => rectPath(ctx, -30, -18, 60, 12, 4), c0, c1, 2.2);
  for (let i = 0; i < 9; i++) {
    if (i === 4 || i === 5) continue;
    const x = -27 + i * 6.6;
    body(ctx, () => rectPath(ctx, x, -6, 4.4, 16, 2), lighten(c0, 0.06), c1, 1.7);
  }
  shine(ctx, -16, -15, 8, 2.6, -0.3, 0.45);
  speckle(ctx, rng, 6, -28, -18, 56, 26, css(darken(c1, 0.25), 0.3));
};

const paintSpring: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const t = i / 34;
    const x = -26 + t * 52;
    const y = Math.sin(t * Math.PI * 5) * 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = css(lighten(c0, 0.3));
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const t = i / 34;
    const x = -26 + t * 52;
    const y = Math.sin(t * Math.PI * 5) * 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  speckle(ctx, rng, 10, -26, -14, 52, 28, css(0x8a4a22, 0.55));
};

const paintTile: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-26, -24);
    ctx.lineTo(24, -24);
    ctx.lineTo(26, 16);
    ctx.lineTo(8, 26);
    ctx.lineTo(-26, 22);
    ctx.closePath();
  }, c0, c1, 2.2);
  ctx.strokeStyle = css(darken(c1, 0.35));
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-26, -24);
  ctx.lineTo(-26, 22);
  ctx.moveTo(-26, -24);
  ctx.lineTo(24, -24);
  ctx.stroke();
  shine(ctx, -12, -12, 7, 5, -0.4, 0.4);
  speckle(ctx, rng, 8, -24, -22, 48, 46, css(darken(c1, 0.2), 0.35));
};

const paintBattery: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-16, -22);
    ctx.lineTo(16, -22);
    ctx.lineTo(16, 24);
    ctx.lineTo(-16, 24);
    ctx.closePath();
  }, c0, c1, 2.3);
  body(ctx, () => {
    ctx.ellipse(0, -22, 16, 5.5, 0, 0, TAU);
  }, lighten(c0, 0.12), c1, 2);
  body(ctx, () => rectPath(ctx, -6, -30, 12, 8, 3), pal(def, 2), c1, 1.8);
  ctx.strokeStyle = css(darken(c1, 0.4));
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(6, 2);
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 8);
  ctx.stroke();
  scratches(ctx, [[-12, 14, 10, 16]], css(darken(c1, 0.35), 0.5), 1.4);
  speckle(ctx, rng, 8, -14, -20, 28, 42, css(0x6a5a2a, 0.45));
};

const paintLeather: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-28, -14);
    ctx.lineTo(22, -22);
    ctx.lineTo(28, 10);
    ctx.lineTo(-8, 24);
    ctx.lineTo(-30, 6);
    ctx.closePath();
  }, c0, c1, 2.2);
  ctx.strokeStyle = css(darken(c1, 0.5));
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(-22, -8);
  ctx.quadraticCurveTo(-2, 2, 22, -14);
  ctx.stroke();
  ctx.setLineDash([]);
  shine(ctx, -12, -12, 7, 4, -0.4, 0.4);
  speckle(ctx, rng, 9, -26, -18, 50, 40, css(darken(c1, 0.25), 0.35));
};

const paintScrap: Painter = (ctx, def, rng) => {
  const c0 = pal(def, 0);
  const c1 = pal(def, 1);
  body(ctx, () => {
    ctx.moveTo(-26, 6);
    ctx.lineTo(-14, -20);
    ctx.lineTo(6, -14);
    ctx.lineTo(20, -24);
    ctx.lineTo(28, 2);
    ctx.lineTo(10, 22);
    ctx.lineTo(-14, 18);
    ctx.closePath();
  }, c0, c1, 2.2);
  scratches(ctx, [[-18, 2, 12, -4], [-6, -12, 2, 14]], css(darken(c1, 0.4), 0.6), 1.4);
  shine(ctx, -10, -14, 6, 3.4, -0.5, 0.35);
  speckle(ctx, rng, 12, -24, -22, 48, 44, css(0x8a5a33, 0.5));
};

/** Every painter, keyed by the `art` field of a find. */
const PAINTERS: Record<string, Painter> = {
  coin: paintCoin,
  button: paintButton,
  beads: paintBeads,
  helmet: paintHelmet,
  shell: paintShell,
  plane: paintPlane,
  calipers: paintCalipers,
  tongs: paintTongs,
  drill: paintDrill,
  flask: paintFlask,
  bracelet: paintBracelet,
  cannonball: paintCannonball,
  watch: paintWatch,
  gears: paintGears,
  telescope: paintTelescope,
  camera: paintCamera,
  keys: paintKeys,
  ring: paintRing,
  brooch: paintBrooch,
  locket: paintLocket,
  idol: paintIdol,
  crown: paintCrown,
  tablet: paintTablet,
  soldier: paintSoldier,
  top: paintTop,
  mouse: paintMouse,
  duck: paintDuck,
  mug: paintMug,
  shard: paintShard,
  marble: paintMarble,
  key: paintKey,
  whistle: paintWhistle,
  robot: paintRobot,
  dollhead: paintDollHead,
  teapot: paintTeapot,
  lamp: paintLamp,
  musicbox: paintMusicBox,
  snowglobe: paintSnowglobe,
  mirror: paintMirror,
  ammonite: paintAmmonite,
  trilobite: paintTrilobite,
  arrowhead: paintArrowhead,
  lighter: paintLighter,
  jackbox: paintJackbox,
  phone: paintPhone,
  radio: paintRadio,
  mask: paintMask,
  thimble: paintThimble,
  decanter: paintDecanter,
  glass: paintGlass,
  can: paintCan,
  nails: paintNails,
  spoon: paintSpoon,
  plastictoy: paintPlasticToy,
  wire: paintWire,
  sole: paintSole,
  bottlecap: paintBottleCap,
  wrapper: paintWrapper,
  pipe: paintPipe,
  comb: paintComb,
  spring: paintSpring,
  tile: paintTile,
  battery: paintBattery,
  leather: paintLeather,
  scrap: paintScrap,
};

/** True when the catalogue knows how to draw this find. */
export function hasFindPainter(def: FindDef): boolean {
  return Object.prototype.hasOwnProperty.call(PAINTERS, def.art);
}

/** The texture key used for a find. */
export function findTextureKey(def: FindDef): string {
  return `find-${def.id}`;
}

/**
 * Paints a find centred in a size x size box. The background stays
 * transparent, the picture keeps roughly an 8% margin on every side.
 */
export function paintFind(ctx: CanvasRenderingContext2D, def: FindDef, size: number): void {
  const s = Math.max(8, size);
  const painter = PAINTERS[def.art];
  const rng = mulberry32(hashId(def.id));
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.scale(s / 100, s / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (painter) {
    painter(ctx, def, rng);
  } else {
    paintFallback(ctx, def);
  }
  ctx.restore();
}

/** Used when a def has no painter yet, so nothing is ever invisible. */
function paintFallback(ctx: CanvasRenderingContext2D, def: FindDef): void {
  body(ctx, () => circlePath(ctx, 0, 0, 26), pal(def, 0), pal(def, 1), 2.4);
  shine(ctx, -8, -10, 7, 4, -0.6, 0.5);
}

/** Creates an offscreen canvas of the given size. */
function makeOffscreen(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(size));
  canvas.height = Math.max(1, Math.ceil(size));
  return canvas;
}

/**
 * Paints the same shape as the find, but as a flat dark brown silhouette with
 * a soft glow around it.
 */
export function paintSilhouette(ctx: CanvasRenderingContext2D, def: FindDef, size: number): void {
  const s = Math.max(8, size);
  const art = makeOffscreen(s);
  const artCtx = art.getContext('2d');
  if (!artCtx) return;
  paintFind(artCtx, def, s);

  const sil = makeOffscreen(s);
  const silCtx = sil.getContext('2d');
  if (!silCtx) return;
  silCtx.drawImage(art, 0, 0);
  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = SILHOUETTE;
  silCtx.fillRect(0, 0, s, s);

  ctx.save();
  ctx.globalAlpha = 0.09;
  for (let i = 4; i >= 1; i--) {
    const grow = s * 0.022 * i;
    ctx.drawImage(sil, -grow, -grow, s + grow * 2, s + grow * 2);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(sil, 0, 0);
  ctx.restore();
}

/**
 * Makes sure a texture for this find exists and returns its key.
 * The texture is only painted once.
 */
export function ensureFindTexture(textures: Phaser.Textures.TextureManager, def: FindDef, size = 160): string {
  const key = findTextureKey(def);
  if (!textures.exists(key)) {
    makeCanvasTexture(textures, key, size, size, (ctx, w, h) => {
      paintFind(ctx, def, Math.min(w, h));
    });
  }
  return key;
}
