import type { Theme } from '../levels/LevelDefinition';
import { hashString, seededRandom, TAU } from '../core/math';
import type { Block, Level } from '../levels/Level';
import type { ViewRect } from './Camera';
import { roundRect, text } from './DrawUtils';
import { C, rgba } from './Palette';

/** The sun is up and to the left: a thing of height h throws its shadow this far per unit of h. */
export const SUN_X = 0.75;
export const SUN_Y = 0.55;

const corners = new Float32Array(8);
const CORNER_X = [-1, 1, 1, -1] as const;
const CORNER_Y = [-1, -1, 1, 1] as const;

/** World-space corners of a block's footprint, shifted by (dx, dy). */
function footprint(b: Block, dx: number, dy: number): Float32Array {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const hw = b.w / 2;
  const hh = b.h / 2;
  for (let i = 0; i < 4; i++) {
    const lx = CORNER_X[i] * hw;
    const ly = CORNER_Y[i] * hh;
    corners[i * 2] = b.x + dx + lx * c - ly * s;
    corners[i * 2 + 1] = b.y + dy + lx * s + ly * c;
  }
  return corners;
}

function polygon(ctx: CanvasRenderingContext2D, p: Float32Array, dx: number, dy: number): void {
  ctx.beginPath();
  ctx.moveTo(p[0] + dx, p[1] + dy);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i * 2] + dx, p[i * 2 + 1] + dy);
  ctx.closePath();
}

/** Fills the area a quad sweeps as it slides by (dx, dy): its footprint, its far copy, and between. */
function sweep(ctx: CanvasRenderingContext2D, p: Float32Array, dx: number, dy: number): void {
  polygon(ctx, p, 0, 0);
  ctx.fill();
  polygon(ctx, p, dx, dy);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    ctx.beginPath();
    ctx.moveTo(p[i * 2], p[i * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1]);
    ctx.lineTo(p[j * 2] + dx, p[j * 2 + 1] + dy);
    ctx.lineTo(p[i * 2] + dx, p[i * 2 + 1] + dy);
    ctx.closePath();
    ctx.fill();
  }
}

const ROOFS = ['#f6f0e4', '#ede5d5', '#faf6ec', '#e7dece'] as const;
const CLOTH = [C.terra, C.blue, C.sun, C.white, C.blueLite] as const;

/** Rooftop palette per theme: the neighbours dress for the occasion. */
const THEME_ROOFS: Readonly<Record<Theme, readonly string[]>> = {
  street: ROOFS,
  pitch: ['#e3f2e4', '#d7ecd9', '#eef7ee', '#cde6cf'],
  stadium: ['#274a8f', '#1d3a75', '#274a8f', '#1d3a75'],
  beach: ['#fdf3d8', '#f7e7bd', '#fffaf0', '#f2dfae'],
  court: ['#e8f1fe', '#dce8fb', '#f4f8ff', '#d2e2f8'],
  clay: ['#f6ddd0', '#f2cfbd', '#fae9dd', '#ecc4ab'],
  roof: ['#e0defa', '#d2cff7', '#ebe9fd', '#c6c2f2'],
  snow: ['#ffffff', '#eef4fb', '#e2eefb', '#dbe8f5'],
  sunset: ['#f7c9a0', '#f2b183', '#f9d9b8', '#eaa878'],
  night: ['#2a3a63', '#243357', '#33436e', '#1f2c4e'],
};

/** The side streets around the alley, per theme. */
const THEME_STREET: Readonly<Record<Theme, string>> = {
  street: '#b3a48c',
  pitch: '#4c8a52',
  stadium: '#0f1830',
  beach: '#d9a75f',
  court: '#2c5cb8',
  clay: '#a34a2c',
  roof: '#4a4e8f',
  snow: '#9fc0e0',
  sunset: '#c96a35',
  night: '#141c36',
};

/**
 * The quarter seen from above: flat whitewashed roofs with the life people keep on them.
 * Laid out from a seed taken from the level id, so each alley has its own neighbours.
 */
export function paintBackdrop(ctx: CanvasRenderingContext2D, view: ViewRect, level: Level): void {
  const theme = level.def.theme ?? 'street';
  if (theme === 'stadium') {
    paintStands(ctx, view, level);
    return;
  }
  const roofs = THEME_ROOFS[theme];
  const rng = seededRandom(hashString(level.def.id));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];

  // Side streets, in shade.
  ctx.fillStyle = THEME_STREET[theme];
  ctx.fillRect(view.x, view.y, view.w, view.h);

  const gap = 18;
  const right = view.x + view.w;
  const bottom = view.y + view.h;
  // Start from fixed world coordinates so the layout does not shift when the window resizes.
  for (let x = -1200; x < right; ) {
    const w = 210 + rng() * 170;
    for (let y = -900; y < bottom; ) {
      const h = 170 + rng() * 190;
      const seed = rng();
      if (x + w > view.x && y + h > view.y) paintRoof(ctx, x + gap / 2, y + gap / 2, w - gap, h - gap, pick(roofs), seededRandom(Math.floor(seed * 1e9)), theme);
      y += h;
    }
    x += w;
  }
}

/** Seat colours of the bowl, inside out; the crowd sits on them. */
const TIERS = ['#6b7287', '#2c4f98', '#223f7e', '#2c4f98', '#223f7e', '#1a3166', '#152850', '#0f1c3c'] as const;
const CROWD = [C.terra, C.sun, C.white, '#7cc4ff', '#ff7aa8', '#ffffff'] as const;

/**
 * A stadium seen from above: a walkway round the pitch, then tier after tier of stands with the
 * crowd in them, and a floodlight in every corner. Seeded from the level id, so it is the same
 * every time, and cached with the rest of the static layer.
 */
function paintStands(ctx: CanvasRenderingContext2D, view: ViewRect, level: Level): void {
  const { arena } = level.def;
  const rng = seededRandom(hashString(level.def.id) ^ 0x51ad1);
  const first = 34;
  const step = 58;
  const ring = (d: number): [number, number, number, number] => [arena.x - d, arena.y - d, arena.w + d * 2, arena.h + d * 2];

  // Outside in: each tier is a bigger rectangle laid under the smaller ones.
  ctx.fillStyle = TIERS[TIERS.length - 1];
  ctx.fillRect(view.x, view.y, view.w, view.h);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const [x, y, w, h] = ring(first + (i + 1) * step);
    ctx.fillStyle = TIERS[i];
    ctx.fillRect(x, y, w, h);
    // The step edge: a lit lip and the shade under it.
    ctx.strokeStyle = rgba('#ffffff', i === 0 ? 0.35 : 0.14);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  // Aisles: a lighter stripe running outward from the pitch every so often.
  ctx.strokeStyle = rgba('#ffffff', 0.12);
  ctx.lineWidth = 4;
  const outer = first + TIERS.length * step;
  ctx.beginPath();
  for (let t = -outer; t <= arena.w + outer; t += 150) {
    ctx.moveTo(arena.x + t, arena.y - first - step);
    ctx.lineTo(arena.x + t, arena.y - outer);
    ctx.moveTo(arena.x + t, arena.y + arena.h + first + step);
    ctx.lineTo(arena.x + t, arena.y + arena.h + outer);
  }
  for (let t = -outer; t <= arena.h + outer; t += 150) {
    ctx.moveTo(arena.x - first - step, arena.y + t);
    ctx.lineTo(arena.x - outer, arena.y + t);
    ctx.moveTo(arena.x + arena.w + first + step, arena.y + t);
    ctx.lineTo(arena.x + arena.w + outer, arena.y + t);
  }
  ctx.stroke();

  // The crowd, a head every few units along each row of seats (the walkway stays empty).
  for (let i = 1; i < TIERS.length; i++) for (const row of [-19, 0, 19]) {
    const d = first + i * step + step * 0.5 + row;
    const [x, y, w, h] = ring(d);
    const place = (px: number, py: number): void => {
      if (px < view.x - 8 || px > view.x + view.w + 8 || py < view.y - 8 || py > view.y + view.h + 8) return;
      if (rng() < 0.12) return; // an empty seat
      ctx.fillStyle = CROWD[Math.floor(rng() * CROWD.length)];
      ctx.globalAlpha = 0.72 + rng() * 0.25;
      ctx.beginPath();
      ctx.arc(px + (rng() - 0.5) * 3, py + (rng() - 0.5) * 3, 4.6, 0, TAU);
      ctx.fill();
    };
    for (let px = x; px <= x + w; px += 15) {
      place(px, y);
      place(px, y + h);
    }
    for (let py = y + 15; py < y + h; py += 15) {
      place(x, py);
      place(x + w, py);
    }
  }
  ctx.globalAlpha = 1;

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
    ctx.fillStyle = rgba('#ffc83a', 0.1);
    for (let lx = x + 16; lx < x + w - 14; lx += 9) for (let ly = y + 16; ly < y + h - 14; ly += 9) ctx.fillRect(lx, ly, 4, 4);
    text(ctx, level.def.name, x + w / 2, y + h / 2 + 2, { size: 38, color: '#ffc83a', align: 'center', baseline: 'middle', weight: 900, spacing: 4 });
  }

  // Floodlights in the four corners: a pool of light and the lamp head.
  const [lx, ly, lw, lh] = ring(first + 2 * step);
  for (const [cx, cy] of [
    [lx, ly],
    [lx + lw, ly],
    [lx, ly + lh],
    [lx + lw, ly + lh],
  ]) {
    const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 260);
    glow.addColorStop(0, 'rgba(255, 243, 190, 0.55)');
    glow.addColorStop(1, 'rgba(255, 243, 190, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 260, cy - 260, 520, 520);
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#1b2540', 0.8);
    ctx.lineWidth = 4;
    ctx.stroke();
  }
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
    const reach = 34 + 58 * 6;
    for (let i = 0; i < 110; i++) {
      // Anywhere in the stands: outside the walkway, inside the last tiers.
      let x = 0;
      let y = 0;
      do {
        x = arena.x - reach + rng() * (arena.w + reach * 2);
        y = arena.y - reach + rng() * (arena.h + reach * 2);
      } while (x > arena.x - 100 && x < arena.x + arena.w + 100 && y > arena.y - 100 && y < arena.y + arena.h + 100);
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

function paintRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, rng: () => number, theme: Theme): void {
  // Its shadow falls into the street beside it.
  ctx.fillStyle = rgba(C.shadow, 0.32);
  ctx.fillRect(x + 12, y + 9, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  // Parapet: a lit lip and the shade just inside it.
  ctx.strokeStyle = rgba(C.shadow, 0.12);
  ctx.lineWidth = 5;
  ctx.strokeRect(x + 9.5, y + 9.5, w - 19, h - 19);
  ctx.strokeStyle = rgba('#ffffff', 0.7);
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);

  const count = Math.floor(rng() * 3.4);
  for (let i = 0; i < count; i++) {
    const px = x + 40 + rng() * Math.max(1, w - 80);
    const py = y + 40 + rng() * Math.max(1, h - 80);
    const kind = Math.floor(rng() * 6);
    ctx.save();
    ctx.translate(px, py);
    if (kind === 0) rug(ctx, rng);
    else if (kind === 1) tank(ctx);
    else if (kind === 2) dish(ctx, rng);
    else if (kind === 3) pots(ctx, rng);
    else if (kind === 4) hut(ctx);
    else laundry(ctx, rng);
    ctx.restore();
  }
  if (theme === 'night') {
    // Lit windows: someone is always still awake.
    const lit = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < lit; i++) {
      const wx = x + 24 + rng() * Math.max(1, w - 60);
      const wy = y + 24 + rng() * Math.max(1, h - 60);
      ctx.fillStyle = rgba('#ffd97a', 0.28);
      ctx.fillRect(wx - 5, wy - 4, 34, 28);
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(wx, wy, 24, 20);
      ctx.fillStyle = rgba(C.navy, 0.8);
      ctx.fillRect(wx + 11, wy, 2, 20);
      ctx.fillRect(wx, wy + 9, 24, 2);
    }
  }
}

function dropShadow(ctx: CanvasRenderingContext2D, draw: () => void, d = 7): void {
  ctx.save();
  ctx.translate(d, d * 0.75);
  ctx.fillStyle = rgba(C.shadow, 0.22);
  draw();
  ctx.restore();
}

function rug(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.rotate((rng() - 0.5) * 0.5);
  const base = rng() < 0.5 ? C.terra : C.blue;
  ctx.fillStyle = base;
  ctx.fillRect(-38, -24, 76, 48);
  ctx.fillStyle = C.sun;
  ctx.fillRect(-38, -15, 76, 4);
  ctx.fillRect(-38, 11, 76, 4);
  ctx.fillStyle = C.white;
  ctx.fillRect(-38, -5, 76, 3);
  ctx.fillRect(-38, 2, 76, 3);
  // A diamond in the middle, as woven rugs have.
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fillStyle = base === C.terra ? C.blue : C.terra;
  ctx.fill();
}

function tank(ctx: CanvasRenderingContext2D): void {
  dropShadow(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.fill();
  }, 12);
  ctx.fillStyle = C.blueLite;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba('#ffffff', 0.55);
  ctx.beginPath();
  ctx.ellipse(-8, -9, 8, 4, -0.7, 0, TAU);
  ctx.fill();
}

function dish(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.rotate(rng() * TAU);
  dropShadow(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 13, 0, 0, TAU);
    ctx.fill();
  }, 9);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 13, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(C.navy, 0.25);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = rgba(C.navy, 0.55);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(11, -8);
  ctx.stroke();
}

function pots(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const x = i * 24 - (n - 1) * 12;
    const y = (rng() - 0.5) * 14;
    ctx.fillStyle = rgba(C.shadow, 0.22);
    ctx.beginPath();
    ctx.arc(x + 5, y + 4, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.terra;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.25);
    ctx.beginPath();
    ctx.arc(x - 3, y - 4, 3, 0, TAU);
    ctx.fill();
  }
}

/** The little stairwell hut every flat roof has, with its blue door. */
function hut(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.3);
  ctx.fillRect(-26 + 18, -20 + 13, 60, 48);
  ctx.fillStyle = C.whiteShade;
  ctx.fillRect(-30, -4, 60, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-30, -26, 60, 44);
  ctx.fillStyle = C.blue;
  ctx.fillRect(-9, 4, 18, 18);
}

function laundry(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.rotate((rng() - 0.5) * 0.6);
  ctx.strokeStyle = rgba(C.navy, 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-70, 0);
  ctx.lineTo(70, 0);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const w = 14 + rng() * 12;
    const x = -62 + i * 27;
    ctx.fillStyle = rgba(C.shadow, 0.2);
    ctx.fillRect(x + 5, 5, w, 9);
    ctx.fillStyle = CLOTH[Math.floor(rng() * CLOTH.length)];
    ctx.fillRect(x, -3, w, 9);
  }
}


/** Opaque shadow shapes for everything that never moves. The renderer composites them at one alpha. */
export function paintStaticShadows(ctx: CanvasRenderingContext2D, level: Level): void {
  ctx.fillStyle = C.shadow;
  for (const b of level.blocks) if (!b.gone) sweep(ctx, footprint(b, 0, 0), b.lift * SUN_X, b.lift * SUN_Y);
  const g = level.goal;
  // Posts and crossbar.
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.shadow;
  ctx.lineWidth = g.postR * 2;
  for (const px of [g.leftPostX, g.rightPostX]) {
    ctx.beginPath();
    ctx.moveTo(px, g.postY);
    ctx.lineTo(px + g.height * SUN_X, g.postY + g.height * SUN_Y);
    ctx.stroke();
  }
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(g.leftPostX + g.height * SUN_X, g.postY + g.height * SUN_Y);
  ctx.lineTo(g.rightPostX + g.height * SUN_X, g.postY + g.height * SUN_Y);
  ctx.stroke();
}

interface BlockLook {
  top: string;
  side: string;
}

const LOOKS: Readonly<Record<Block['kind'], BlockLook>> = {
  rail: { top: C.white, side: C.whiteShade },
  kerb: { top: C.stone, side: C.stoneDark },
  wall: { top: C.white, side: C.blue },
  hedge: { top: '#5da24a', side: '#2f6f2c' },
  crate: { top: C.wood, side: C.woodDark },
  car: { top: C.sun, side: C.sunDark },
  shutter: { top: C.blueLite, side: C.blueDark },
  defender: { top: '#1b2540', side: '#101a30' },
};

/** A pillar cap for a shared boundary vertex: shadow, blue body, white cap, blue band. */
export function drawBoundaryJoint(ctx: CanvasRenderingContext2D, joint: { x: number; y: number }, boards = false): void {
  const r = 17;
  const lift = 22;
  ctx.fillStyle = rgba(C.shadow, 0.3);
  ctx.beginPath();
  ctx.ellipse(joint.x + r * SUN_X * 0.6, joint.y + r * SUN_Y * 0.6, r * 1.15, r * 0.55, 0, 0, TAU);
  ctx.fill();
  // Pillar body, with a darker lower crescent for depth.
  ctx.fillStyle = boards ? '#10172b' : C.blue;
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - 2, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(C.navy, 0.4);
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - 2, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.fill();
  // White cap on top, rimmed in blue, with the trim dash like the wall faces.
  ctx.fillStyle = boards ? '#e8ecf5' : C.white;
  ctx.beginPath();
  ctx.arc(joint.x, joint.y - lift, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = boards ? rgba(C.terra, 0.95) : rgba(C.blue, 0.9);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = boards ? rgba(C.terra, 0.95) : rgba(C.blue, 0.85);
  ctx.fillRect(joint.x - 8, joint.y - lift - 1.5, 16, 3);
}

/** A solid block in the game's oblique view: footprint on the ground, top face lifted straight up. */
export function drawBlock(ctx: CanvasRenderingContext2D, b: Block, boards = false, time = 0): void {
  // Recoil away from the ball, easing out with the square of the hit.
  const push = b.hit * b.hit * 5;
  const ox = -b.hitNx * push;
  const oy = -b.hitNy * push;
  if (b.kind === 'car') {
    drawTaxi(ctx, b, ox, oy);
    return;
  }
  // Boundary bands butt together like masonry; the pillar caps cover the joints.
  const shrink = b.boundary ? b.h + 2 : 0;
  const blk = shrink > 0 ? { ...b, w: b.w - shrink } : b;
  const p = footprint(blk, ox, oy);
  const lift = blk.lift;
  // Round a stadium the boundary walls are advertising boards.
  const board = boards && blk.boundary && blk.kind === 'wall';
  const look = board ? { top: '#1b2540', side: '#eef1f8' } : LOOKS[blk.kind];

  // Side faces. Only those turned towards the viewer end up visible; the top covers the rest.
  ctx.fillStyle = look.side;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    ctx.beginPath();
    ctx.moveTo(p[i * 2], p[i * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1]);
    ctx.lineTo(p[j * 2], p[j * 2 + 1] - lift);
    ctx.lineTo(p[i * 2], p[i * 2 + 1] - lift);
    ctx.closePath();
    ctx.fill();
  }
  polygon(ctx, p, 0, -lift);
  ctx.fillStyle = look.top;
  ctx.fill();

  // Surface detail, drawn in the block's own frame and clipped to its top face.
  ctx.save();
  ctx.clip();
  ctx.translate(blk.x + ox, blk.y + oy - lift);
  ctx.rotate(blk.angle);
  const hw = blk.w / 2;
  const hh = blk.h / 2;
  if (blk.kind === 'crate') {
    // Slats, and the oranges inside.
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 4;
    ctx.strokeRect(-hw + 4, -hh + 4, blk.w - 8, blk.h - 8);
    const cols = Math.max(1, Math.floor((blk.w - 20) / 26));
    const rows = Math.max(1, Math.floor((blk.h - 20) / 24));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -((cols - 1) * 26) / 2 + i * 26 + (j % 2 === 0 ? 0 : 5);
        const y = -((rows - 1) * 24) / 2 + j * 24;
        ctx.fillStyle = C.orange;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.4);
        ctx.beginPath();
        ctx.arc(x - 3.5, y - 4, 3, 0, TAU);
        ctx.fill();
      }
    }
  } else if (blk.kind === 'defender') {
    // A man in the wall seen from above: broad shoulders in club colours and a head.
    ctx.fillStyle = '#2b3b6b';
    ctx.fillRect(-hw + 2, -hh + 2, blk.w - 4, blk.h - 4);
    ctx.fillStyle = rgba(C.greenHi, 0.55);
    ctx.fillRect(-hw + 2, -3, blk.w - 4, 6);
    ctx.fillStyle = '#e0b48f';
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(hw, hh) * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#101a30';
    ctx.beginPath();
    ctx.arc(0, -1.5, Math.min(hw, hh) * 0.42, Math.PI, 0);
    ctx.fill();
  } else if (board) {
    // Advertising boards: panels of colour along the face, separated by a thin dark seam.
    const along = blk.w >= blk.h;
    const len = along ? blk.w : blk.h;
    const wid = along ? blk.h : blk.w;
    const panel = 96;
    const colours = [C.terra, C.sun, C.white, '#3f8cff'] as const;
    for (let d = -len / 2, i = 0; d < len / 2; d += panel, i++) {
      const size = Math.min(panel, len / 2 - d) - 4;
      if (size <= 6) continue;
      // LED boards: every few seconds the ads rotate one panel along.
      ctx.fillStyle = colours[(i + Math.floor(time / 2.6)) % colours.length];
      if (along) ctx.fillRect(d + 2, -wid / 2 + 3, size, wid - 6);
      else ctx.fillRect(-wid / 2 + 3, d + 2, wid - 6, size);
      ctx.fillStyle = rgba('#1b2540', 0.75);
      if (along) ctx.fillRect(d + 2 + size * 0.18, -2, size * 0.64, 4);
      else ctx.fillRect(-2, d + 2 + size * 0.18, 4, size * 0.64);
    }
  } else if (blk.kind === 'wall') {
    // A line of blue tile along the cap.
    ctx.fillStyle = rgba(C.blue, 0.85);
    const tile = 14;
    const along = blk.w >= blk.h;
    const len = along ? blk.w : blk.h;
    for (let d = -len / 2 + 10; d < len / 2 - 10; d += tile * 2) {
      if (along) ctx.fillRect(d, -3, tile, 6);
      else ctx.fillRect(-3, d, 6, tile);
    }
  } else if (blk.kind === 'shutter') {
    // Roller-shutter slats, and the yellow pull bar along the bottom.
    ctx.strokeStyle = rgba(C.blueDark, 0.55);
    ctx.lineWidth = 2;
    for (let y = -hh + 5; y < hh - 4; y += 6) {
      ctx.beginPath();
      ctx.moveTo(-hw + 3, y);
      ctx.lineTo(hw - 3, y);
      ctx.stroke();
    }
    ctx.fillStyle = C.sun;
    ctx.fillRect(-hw, hh - 5, blk.w, 5);
  } else if (blk.kind === 'hedge') {
    // Leafy hedge: dark scallops over the green, lighter tufts on top.
    ctx.fillStyle = rgba('#1e4d1e', 0.5);
    const cols = Math.max(2, Math.floor(blk.w / 26));
    const rows = Math.max(1, Math.floor(blk.h / 24));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (blk.w - 26)) / Math.max(1, cols - 1);
        const y = -hh + 12 + (j * (blk.h - 24)) / Math.max(1, rows - 1);
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = rgba('#bfe6a8', 0.7);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (blk.w - 26)) / Math.max(1, cols - 1) - 3;
        const y = -hh + 12 + (j * (blk.h - 24)) / Math.max(1, rows - 1) - 3;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = rgba(C.shadow, 0.1);
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw + 5, -hh + 5, blk.w - 10, blk.h - 10);
  }
  if (blk.hit > 0) {
    ctx.fillStyle = rgba(blk.kind === 'crate' ? '#ffffff' : C.sun, blk.hit * 0.45);
    ctx.fillRect(-hw, -hh, blk.w, blk.h);
  }
  ctx.restore();
}

/** The parked taxi, built as a stack of slices so its rounded body reads as a volume. */
function drawTaxi(ctx: CanvasRenderingContext2D, b: Block, ox: number, oy: number): void {
  const hw = b.w / 2;
  const hh = b.h / 2;
  const alarm = b.hit > 0 && Math.sin(b.hit * 40) > 0;
  const slice = (lift: number, draw: () => void): void => {
    ctx.save();
    ctx.translate(b.x + ox, b.y + oy - lift);
    ctx.rotate(b.angle);
    draw();
    ctx.restore();
  };
  const body = (): void => roundRect(ctx, -hw, -hh, b.w, b.h, Math.min(24, hh * 0.6));

  // Wheels on the ground.
  slice(0, () => {
    ctx.fillStyle = C.rubber;
    for (const sx of [-0.3, 0.3]) {
      for (const sy of [-1, 1]) roundRect(ctx, sx * b.w - 15, sy * hh - (sy < 0 ? 4 : 5), 30, 9, 4), ctx.fill();
    }
  });
  for (let k = 3; k <= b.lift; k += 3) {
    slice(k, () => {
      body();
      ctx.fillStyle = C.sunDark;
      ctx.fill();
    });
  }
  slice(b.lift, () => {
    body();
    ctx.fillStyle = C.sun;
    ctx.fill();
    // Cabin: rear window, roof, windscreen. The bonnet is at +x.
    const ch = b.h * 0.74;
    roundRect(ctx, -b.w * 0.36, -ch / 2, b.w * 0.62, ch, 12);
    ctx.fillStyle = rgba(C.navy, 0.82);
    ctx.fill();
    roundRect(ctx, -b.w * 0.27, -ch / 2, b.w * 0.42, ch, 8);
    ctx.fillStyle = '#ffe08a';
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.fillRect(b.w * 0.17, -ch * 0.36, 4, ch * 0.3);
    // Roof sign.
    roundRect(ctx, -b.w * 0.09, -9, 20, 18, 4);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.fillRect(-b.w * 0.09 + 6, -5, 8, 10);
    // Lights: they flash when the alarm goes.
    ctx.fillStyle = alarm ? C.orange : C.white;
    for (const sy of [-1, 1]) roundRect(ctx, hw - 9, sy * hh * 0.62 - 6, 7, 12, 3), ctx.fill();
    ctx.fillStyle = alarm ? C.orange : C.terra;
    for (const sy of [-1, 1]) roundRect(ctx, -hw + 2, sy * hh * 0.62 - 6, 6, 12, 3), ctx.fill();
  });
}
