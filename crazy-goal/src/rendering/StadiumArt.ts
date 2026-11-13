import { hashString, seededRandom, TAU } from '../core/math';
import type { Theme } from '../levels/LevelDefinition';
import type { Level } from '../levels/Level';
import type { ViewRect } from './Camera';
import { roundRect, text } from './DrawUtils';
import { C, rgba } from './Palette';

/**
 * Every match is played in a stadium, seen from above: a grass pitch with advertising boards
 * round it, a running track, tier after tier of stands with the crowd in them, floodlights in
 * the corners and a big screen with the match name over the goal end.
 *
 * A level's `theme` is the stadium's mood: whose colours the seats are in, the time of day, the
 * weather. Seeded from the level id, so each match keeps its own crowd and its own mowing.
 */

export interface Mood {
  /** Seat colours of the bowl, inside out. The first is the low concourse just past the track. */
  tiers: readonly string[];
  /** Shirts and scarves in the crowd. The first two are the home colours, used for the flags. */
  crowd: readonly string[];
  track: string;
  trackWear: string;
  trackLine: string;
  /** The grass of the pitch, its mown stripes, and the blades thrown across it. */
  grass: string;
  grassAlt: string;
  blade: string;
  /** The darker grass between the pitch's boards and the track. */
  runoff: string;
  /** Floodlight colour (r, g, b) and how strongly it lights the stands and the pitch. */
  lamp: string;
  glow: number;
  pool: number;
  /** How far the pitch's edges fall into shade. */
  shade: number;
  /** A wash over the stands: low sun, or the dark of night. */
  tint?: { color: string; alpha: number };
  /** Snow on the stands, the track and the edges of the pitch. */
  snow?: boolean;
  /** The crowd holds up phone lights. */
  phones?: boolean;
  /** Lettering on the big screen. */
  screen: string;
}

const DAY_LAMP = '255, 243, 190';

const MOODS: Readonly<Record<Theme, Mood>> = {
  // The tutorial ground: the club's own blue.
  stadium: {
    tiers: ['#6b7287', '#2c4f98', '#223f7e', '#2c4f98', '#223f7e', '#1a3166', '#152850', '#0f1c3c'],
    crowd: [C.terra, C.sun, C.white, '#7cc4ff', '#ff7aa8', '#ffffff'],
    track: '#b4513a',
    trackWear: '#d9825f',
    trackLine: '#ffffff',
    grass: '#3f9a4a',
    grassAlt: '#378f43',
    blade: '#5cb566',
    runoff: '#2f7e3a',
    lamp: DAY_LAMP,
    glow: 0.55,
    pool: 0.2,
    shade: 0.3,
    screen: '#ffc83a',
  },
  // The old town's ground: red and cream.
  street: {
    tiers: ['#7d7f8c', '#c2452c', '#a63a24', '#e8dcc4', '#c2452c', '#a63a24', '#86301e', '#5f2215'],
    crowd: ['#d8452c', '#f4ead6', C.sun, '#ffffff', '#1f5fa8', '#ff9a5a'],
    track: '#3c6fb4',
    trackWear: '#5d8fd0',
    trackLine: '#ffffff',
    grass: '#43a04c',
    grassAlt: '#3a9244',
    blade: '#66bd6e',
    runoff: '#33843d',
    lamp: DAY_LAMP,
    glow: 0.45,
    pool: 0.18,
    shade: 0.26,
    screen: '#ffc83a',
  },
  // Sky blue and white.
  court: {
    tiers: ['#7b879c', '#3a8ad6', '#2d74bd', '#eef3fa', '#3a8ad6', '#2d74bd', '#255fa0', '#1a4677'],
    crowd: ['#4aa3f0', '#ffffff', C.sun, '#7cc4ff', '#1f5fa8', '#ffffff'],
    track: '#c4553a',
    trackWear: '#e07f5f',
    trackLine: '#ffffff',
    grass: '#45a24e',
    grassAlt: '#3c9546',
    blade: '#69c071',
    runoff: '#348740',
    lamp: DAY_LAMP,
    glow: 0.45,
    pool: 0.18,
    shade: 0.26,
    screen: '#ffffff',
  },
  // Orange and black.
  clay: {
    tiers: ['#857a72', '#e07b28', '#c4691d', '#2a2522', '#e07b28', '#c4691d', '#a35616', '#7c4010'],
    crowd: ['#f08a24', '#2a2522', '#ffffff', C.sun, '#ffb066', '#ffffff'],
    track: '#3e4452',
    trackWear: '#5a6170',
    trackLine: '#f6c445',
    grass: '#47a04a',
    grassAlt: '#3e9342',
    blade: '#6bbd67',
    runoff: '#35853b',
    lamp: DAY_LAMP,
    glow: 0.45,
    pool: 0.18,
    shade: 0.26,
    screen: '#ffb347',
  },
  // A ground by the sea: turquoise and yellow, a sand track.
  beach: {
    tiers: ['#a39f93', '#1fb3b0', '#f2c14a', '#1fb3b0', '#f2c14a', '#17908e', '#127371', '#0d5857'],
    crowd: ['#20c4c0', '#ffd34d', '#ff7aa8', '#ffffff', '#ff9a3d', '#7ce0ff'],
    track: '#e2c387',
    trackWear: '#f0d8a6',
    trackLine: '#fffaf0',
    grass: '#48a952',
    grassAlt: '#3f9b49',
    blade: '#70c779',
    runoff: '#368c40',
    lamp: DAY_LAMP,
    glow: 0.35,
    pool: 0.16,
    shade: 0.22,
    screen: '#ffd34d',
  },
  // Purple and gold.
  roof: {
    tiers: ['#7f7a95', '#6b4fc4', '#5a40ab', '#f2c14a', '#6b4fc4', '#5a40ab', '#4a338f', '#33246a'],
    crowd: ['#7a5ad8', '#f2c14a', '#ffffff', '#c7b6ff', C.terra, '#ffffff'],
    track: '#b4513a',
    trackWear: '#d9825f',
    trackLine: '#ffffff',
    grass: '#41994b',
    grassAlt: '#388c43',
    blade: '#62b86b',
    runoff: '#2f7d3a',
    lamp: DAY_LAMP,
    glow: 0.5,
    pool: 0.2,
    shade: 0.28,
    screen: '#f2c14a',
  },
  // Green and white.
  pitch: {
    tiers: ['#7a8578', '#2f8f4a', '#277a3e', '#f1f4ee', '#2f8f4a', '#277a3e', '#1f6633', '#143f20'],
    crowd: ['#2fae55', '#ffffff', C.sun, '#9be6b0', '#ffffff', C.terra],
    track: '#b4513a',
    trackWear: '#d9825f',
    trackLine: '#ffffff',
    grass: '#3f9a4a',
    grassAlt: '#378f43',
    blade: '#5cb566',
    runoff: '#2f7e3a',
    lamp: DAY_LAMP,
    glow: 0.5,
    pool: 0.2,
    shade: 0.28,
    screen: '#ffffff',
  },
  // A winter match: snow on the seats and the track, frost round the edge of the pitch.
  snow: {
    tiers: ['#9aa4b4', '#5b6d8f', '#4d5f80', '#c8d4e4', '#5b6d8f', '#4d5f80', '#405170', '#2c3a55'],
    crowd: ['#d8452c', '#ffffff', C.sun, '#7cc4ff', '#2a3a63', '#ffffff'],
    track: '#e9f1f8',
    trackWear: '#ffffff',
    trackLine: '#a6cbe4',
    grass: '#4e9b5c',
    grassAlt: '#469052',
    blade: '#cfe8d4',
    runoff: '#3f8250',
    lamp: '235, 245, 255',
    glow: 0.5,
    pool: 0.16,
    shade: 0.24,
    snow: true,
    screen: '#bfe3ff',
  },
  // Kick-off at dusk: the low sun warms everything.
  sunset: {
    tiers: ['#8c7466', '#c2552f', '#a84726', '#f2c7a0', '#c2552f', '#a84726', '#8c3a1f', '#612816'],
    crowd: ['#ff7a3d', '#ffd27a', '#ffffff', '#ff5a7a', '#ffb066', '#ffffff'],
    track: '#8a3f5c',
    trackWear: '#a85a78',
    trackLine: '#ffe2c2',
    grass: '#4f9a3e',
    grassAlt: '#468e38',
    blade: '#86c46a',
    runoff: '#3d7f33',
    lamp: '255, 214, 150',
    glow: 0.6,
    pool: 0.22,
    shade: 0.3,
    tint: { color: '#ff7a2e', alpha: 0.16 },
    screen: '#ffd27a',
  },
  // Under the lights: dark stands, phone torches in the crowd, bright pools on the grass.
  night: {
    tiers: ['#3b4560', '#1f2c55', '#192447', '#2a3766', '#1f2c55', '#192447', '#141d3a', '#0b1022'],
    crowd: ['#3a4f8f', '#5a6aa0', '#2a3a6a', '#7a86b8', '#4a5a90', '#8fa2d6'],
    track: '#5a2e3a',
    trackWear: '#73404e',
    trackLine: '#c9d3ea',
    grass: '#2f8a3f',
    grassAlt: '#287e37',
    blade: '#4fae5c',
    runoff: '#226b2e',
    lamp: '225, 240, 255',
    glow: 0.5,
    pool: 0.26,
    shade: 0.45,
    tint: { color: '#050a1c', alpha: 0.3 },
    phones: true,
    screen: '#9fe3ff',
  },
};

/** The stadium a level is played in. */
export function moodOf(level: Level): Mood {
  return MOODS[level.def.theme ?? 'street'];
}

/** How far the running track reaches from the arena, how deep each tier is, and how round the bowl's inner corner is. */
const BOWL_FIRST = 88;
const BOWL_STEP = 58;
const BOWL_R = 70;
/** The darker grass between the boards and the track. */
const RUNOFF = 24;

/** Points a fixed distance apart all the way round a rounded rectangle: the seats of one row. */
function walkRounded(x: number, y: number, w: number, h: number, r: number, gap: number): [number, number][] {
  const k = Math.min(r, w / 2, h / 2);
  const out: [number, number][] = [];
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.floor(len / gap));
    for (let i = 0; i < n; i++) out.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const arc = (cx: number, cy: number, from: number): void => {
    const n = Math.max(1, Math.floor((k * (Math.PI / 2)) / gap));
    for (let i = 0; i < n; i++) {
      const a = from + (i / n) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]);
    }
  };
  line(x + k, y, x + w - k, y);
  arc(x + w - k, y + k, -Math.PI / 2);
  line(x + w, y + k, x + w, y + h - k);
  arc(x + w - k, y + h - k, 0);
  line(x + w - k, y + h, x + k, y + h);
  arc(x + k, y + h - k, Math.PI / 2);
  line(x, y + h - k, x, y + k);
  arc(x + k, y + k, Math.PI);
  return out;
}

/**
 * The stadium round the pitch: run-off grass, the track, the stands with the crowd and their flags,
 * the tunnel, the big screen and the floodlights. Cached with the rest of the static layer.
 */
export function paintStands(ctx: CanvasRenderingContext2D, view: ViewRect, level: Level): void {
  const { arena } = level.def;
  const mood = moodOf(level);
  const tiers = mood.tiers;
  const rng = seededRandom(hashString(level.def.id) ^ 0x51ad1);
  const first = BOWL_FIRST;
  const step = BOWL_STEP;
  // A ring round the pitch, `d` units out from the arena, with corners that round off more the further out it is.
  const ring = (d: number): [number, number, number, number, number] => [arena.x - d, arena.y - d, arena.w + d * 2, arena.h + d * 2, BOWL_R + d * 0.9];

  // Outside in: each tier is a bigger rounded rectangle laid under the smaller ones.
  ctx.fillStyle = tiers[tiers.length - 1];
  ctx.fillRect(view.x, view.y, view.w, view.h);
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [x, y, w, h, r] = ring(first + (i + 1) * step);
    ctx.fillStyle = tiers[i];
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    // The rows of seats: faint lines a third of a tier apart.
    ctx.strokeStyle = rgba('#000000', 0.1);
    ctx.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      const [sx, sy, sw, sh, sr] = ring(first + i * step + step * k);
      roundRect(ctx, sx, sy, sw, sh, sr);
      ctx.stroke();
    }
    // The step edge: a lit lip.
    ctx.strokeStyle = rgba('#ffffff', i === 0 ? 0.35 : 0.14);
    ctx.lineWidth = 3;
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r);
    ctx.stroke();
  }

  // The running track round the pitch, with lane lines and a low rail where the stands begin.
  {
    const [x, y, w, h, r] = ring(first);
    ctx.fillStyle = mood.track;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = rgba(mood.trackWear, 0.5);
    ctx.lineWidth = 16;
    const [ix, iy, iw, ih, ir] = ring(first * 0.62);
    roundRect(ctx, ix, iy, iw, ih, ir);
    ctx.stroke();
    ctx.strokeStyle = rgba(mood.trackLine, 0.7);
    ctx.lineWidth = 2.5;
    for (const k of [0.5, 0.68, 0.86]) {
      const [lx, ly, lw, lh, lr] = ring(first * k);
      roundRect(ctx, lx, ly, lw, lh, lr);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1a2a52';
    ctx.lineWidth = 6;
    roundRect(ctx, x + 3, y + 3, w - 6, h - 6, r);
    ctx.stroke();
  }

  // Run-off: darker grass between the boards and the track, mown in stripes like the pitch. Any part of the
  // arena the pitch does not reach is run-off too.
  {
    const [x, y, w, h, r] = ring(RUNOFF);
    ctx.save();
    roundRect(ctx, x, y, w, h, r * 0.5);
    ctx.fillStyle = mood.runoff;
    ctx.fill();
    ctx.clip();
    // Out of play, so a good deal darker than the pitch, and hatched so it never reads as grass you can use.
    ctx.fillStyle = rgba('#06180a', 0.3);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba('#000000', 0.12);
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let d = -h; d < w; d += 22) {
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba('#ffffff', 0.18);
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r * 0.5);
    ctx.stroke();
  }

  // Aisles: a lighter stripe running outward from the pitch every so often, on the straight stretches.
  ctx.strokeStyle = rgba('#ffffff', 0.12);
  ctx.lineWidth = 4;
  const outer = first + tiers.length * step;
  ctx.beginPath();
  for (let t = 150; t < arena.w - 90; t += 150) {
    ctx.moveTo(arena.x + t, arena.y - first - step);
    ctx.lineTo(arena.x + t, arena.y - outer);
    ctx.moveTo(arena.x + t, arena.y + arena.h + first + step);
    ctx.lineTo(arena.x + t, arena.y + arena.h + outer);
  }
  for (let t = 150; t < arena.h - 90; t += 150) {
    ctx.moveTo(arena.x - first - step, arena.y + t);
    ctx.lineTo(arena.x - outer, arena.y + t);
    ctx.moveTo(arena.x + arena.w + first + step, arena.y + t);
    ctx.lineTo(arena.x + arena.w + outer, arena.y + t);
  }
  ctx.stroke();

  // Snow lies on the seats in drifts.
  if (mood.snow) {
    for (let i = 0; i < 900; i++) {
      const x = view.x + rng() * view.w;
      const y = view.y + rng() * view.h;
      if (x > arena.x - first && x < arena.x + arena.w + first && y > arena.y - first && y < arena.y + arena.h + first) continue;
      ctx.fillStyle = rgba('#ffffff', 0.35 + rng() * 0.45);
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + rng() * 14, 3 + rng() * 5, 0, 0, TAU);
      ctx.fill();
    }
  }

  // The crowd: a head every few units along three rows of seats in every tier, following the bowl round its corners.
  const crowd = mood.crowd;
  for (let i = 1; i < tiers.length; i++)
    for (const row of [-19, 0, 19]) {
      const [x, y, w, h, r] = ring(first + i * step + step * 0.5 + row);
      for (const [px, py] of walkRounded(x, y, w, h, r, 15)) {
        if (px < view.x - 8 || px > view.x + view.w + 8 || py < view.y - 8 || py > view.y + view.h + 8) continue;
        if (rng() < 0.12) continue; // an empty seat
        const hx = px + (rng() - 0.5) * 3;
        const hy = py + (rng() - 0.5) * 3;
        // Shoulders in the shirt colour, then the head.
        ctx.fillStyle = crowd[Math.floor(rng() * crowd.length)];
        ctx.globalAlpha = 0.72 + rng() * 0.25;
        ctx.beginPath();
        ctx.ellipse(hx, hy + 2, 6, 4, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = rng() < 0.5 ? '#3a2a22' : '#6b4a35';
        ctx.beginPath();
        ctx.arc(hx, hy - 1, 2.8, 0, TAU);
        ctx.fill();
      }
    }
  ctx.globalAlpha = 1;

  // The home end's flags: a big banner laid over the crowd on each side stand, in the home colours.
  for (const side of [-1, 1]) {
    const depth = step * 2.6;
    const len = Math.min(320, arena.h * 0.36);
    const x = side < 0 ? arena.x - first - step * 0.75 - depth : arena.x + arena.w + first + step * 0.75;
    const y = arena.y + arena.h * (0.3 + rng() * 0.25) - len / 2;
    paintBanner(ctx, x, y, depth, len, crowd[0], crowd[1], rng);
  }

  // A wash over the stands for the time of day.
  if (mood.tint) {
    ctx.fillStyle = rgba(mood.tint.color, mood.tint.alpha);
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }

  // Phone torches held up all over the stands.
  if (mood.phones) {
    for (let i = 0; i < 520; i++) {
      const x = view.x + rng() * view.w;
      const y = view.y + rng() * view.h;
      if (x > arena.x - first - step && x < arena.x + arena.w + first + step && y > arena.y - first - step && y < arena.y + arena.h + first + step) continue;
      const r = 1.6 + rng() * 1.6;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      halo.addColorStop(0, 'rgba(230, 245, 255, 0.5)');
      halo.addColorStop(1, 'rgba(230, 245, 255, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      ctx.fillStyle = '#f4fbff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }

  // The players' tunnel at the near end: a dark mouth in the first tier, with a light either side.
  {
    const w = 190;
    const h = 40;
    const x = arena.x + arena.w / 2 - w / 2;
    const y = arena.y + arena.h + first + 4;
    ctx.fillStyle = '#05080f';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.2);
    ctx.fillRect(x + 12, y + h - 8, w - 24, 3);
    ctx.fillStyle = '#ffc83a';
    for (const lx of [x - 10, x + w + 10]) {
      ctx.beginPath();
      ctx.arc(lx, y + h / 2, 5, 0, TAU);
      ctx.fill();
    }
  }

  // The big screen over the goal end: the match name in lights.
  {
    const w = 560;
    const h = 84;
    const x = arena.x + arena.w / 2 - w / 2;
    // High in the stands, clear of the star targets that sit above the goal on a phone.
    const y = arena.y - 330 - h / 2;
    ctx.fillStyle = rgba('#000000', 0.35);
    ctx.fillRect(x + 8, y + 10, w, h);
    ctx.fillStyle = '#0a1128';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = '#8fa2d6';
    ctx.lineWidth = 4;
    roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 8);
    ctx.stroke();
    // Rows of tiny lamps behind the lettering.
    ctx.fillStyle = rgba(mood.screen, 0.1);
    for (let lx = x + 16; lx < x + w - 14; lx += 9) for (let ly = y + 16; ly < y + h - 14; ly += 9) ctx.fillRect(lx, ly, 4, 4);
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.55);
    glow.addColorStop(0, rgba(mood.screen, 0.16));
    glow.addColorStop(1, rgba(mood.screen, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    text(ctx, level.def.name, x + w / 2, y + h / 2 + 2, { size: 38, color: mood.screen, align: 'center', baseline: 'middle', weight: 900, spacing: 4 });
  }

  // Floodlights on the bowl's corners: a pool of light and the lamp head.
  const [lx, ly, lw, lh, lr] = ring(first + 2 * step);
  const off = lr * (1 - Math.SQRT1_2);
  const reach = 220 + mood.glow * 120;
  for (const [cx, cy] of [
    [lx + off, ly + off],
    [lx + lw - off, ly + off],
    [lx + off, ly + lh - off],
    [lx + lw - off, ly + lh - off],
  ]) {
    const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, reach);
    glow.addColorStop(0, `rgba(${mood.lamp}, ${mood.glow})`);
    glow.addColorStop(1, `rgba(${mood.lamp}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
    // The lamp bank: a grid of bulbs on a dark frame.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(arena.y + arena.h / 2 - cy, arena.x + arena.w / 2 - cx) + Math.PI / 2);
    ctx.fillStyle = rgba('#000000', 0.3);
    roundRect(ctx, -24, -10, 52, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#1b2540';
    roundRect(ctx, -26, -13, 52, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#fffbe8';
    for (let bx = -19; bx <= 19; bx += 9.5)
      for (const by of [-5, 5]) {
        ctx.beginPath();
        ctx.arc(bx, by, 3.4, 0, TAU);
        ctx.fill();
      }
    ctx.restore();
  }
}

/** A supporters' banner lying over the seats: stripes in the home colours, a star, and the folds of the cloth. */
function paintBanner(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: string, b: string, rng: () => number): void {
  ctx.save();
  ctx.fillStyle = rgba('#000000', 0.25);
  ctx.fillRect(x + 6, y + 6, w, h);
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  const stripes = 5;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(x, y + (h * i) / stripes, w, h / stripes + 1);
  }
  // A star in the middle, in a white disc.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = a === '#ffffff' || a === '#f4ead6' ? b : a;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r * 0.72 : r * 0.3;
    ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  // Folds: soft dark and light bands across the cloth.
  for (let fy = y + 20 + rng() * 20; fy < y + h; fy += 46 + rng() * 30) {
    const g = ctx.createLinearGradient(x, fy - 12, x, fy + 12);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, fy - 12, w, 24);
  }
  ctx.restore();
}

interface Flash {
  x: number;
  y: number;
  phase: number;
  rate: number;
}

const FLASH_SPOTS = new Map<string, Flash[]>();

/**
 * Cameras going off in the stands. A few pulses a second here and there while you aim, a storm of them
 * when the ball is in the net. Drawn live over the cached stands; it never touches the pitch.
 */
export function drawCrowdFlashes(ctx: CanvasRenderingContext2D, level: Level, time: number, excited: number): void {
  const { arena } = level.def;
  let spots = FLASH_SPOTS.get(level.def.id);
  if (!spots) {
    const rng = seededRandom(hashString(level.def.id) ^ 0xf1a5);
    spots = [];
    const reach = BOWL_FIRST + BOWL_STEP * 6;
    for (let i = 0; i < 110; i++) {
      // Anywhere in the stands: outside the walkway, inside the last tiers.
      let x = 0;
      let y = 0;
      do {
        x = arena.x - reach + rng() * (arena.w + reach * 2);
        y = arena.y - reach + rng() * (arena.h + reach * 2);
      } while (x > arena.x - BOWL_FIRST - 40 && x < arena.x + arena.w + BOWL_FIRST + 40 && y > arena.y - BOWL_FIRST - 40 && y < arena.y + arena.h + BOWL_FIRST + 40);
      spots.push({ x, y, phase: rng() * TAU, rate: 0.35 + rng() * 0.6 });
    }
    FLASH_SPOTS.set(level.def.id, spots);
  }
  ctx.save();
  for (const f of spots) {
    const pulse = Math.sin(time * f.rate * TAU * (1 + excited * 2.4) + f.phase);
    // A flash is the sharp top of the wave: rare while calm, common when excited.
    const edge = 0.93 - excited * 0.55;
    if (pulse < edge) continue;
    const k = (pulse - edge) / (1 - edge);
    const r = 5 + 9 * k;
    ctx.globalAlpha = 0.25 + 0.65 * k;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(f.x, f.y, r * 0.45, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff6c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.x - r, f.y);
    ctx.lineTo(f.x + r, f.y);
    ctx.moveTo(f.x, f.y - r);
    ctx.lineTo(f.x, f.y + r);
    ctx.stroke();
  }
  ctx.restore();
}
