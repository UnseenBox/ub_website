import type { Theme } from '../levels/LevelDefinition';
import { hashString, seededRandom, TAU } from '../core/math';
import type { Block, Level } from '../levels/Level';
import type { ViewRect } from './Camera';
import { roundRect } from './DrawUtils';
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

/** Kids' chalk: a dashed, dusty line. Call with the path already built. */
function chalk(ctx: CanvasRenderingContext2D, width = 5, color: string = C.chalk): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(color, 0.2);
  ctx.lineWidth = width + 5;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.78);
  ctx.lineWidth = width;
  ctx.setLineDash([30, 5, 14, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Ground colour and the shade of its alternate bands. Punchy: every stop on the tour reads at a glance. */
const GROUNDS: Readonly<Record<Exclude<Theme, 'street'>, readonly [string, string]>> = {
  pitch: ['#37b24d', '#27a03c'],
  beach: ['#ffd166', '#f0a63c'],
  court: ['#2979ff', '#1d5fe0'],
  clay: ['#f0653a', '#cf4b24'],
  roof: ['#6c63ff', '#5750d8'],
  snow: ['#ffffff', '#bfe0ff'],
  sunset: ['#ff9e57', '#ef7334'],
  night: ['#22315e', '#182343'],
};

/** Chalk colour per theme: floodlit gold after dark. */
const THEME_CHALK: Readonly<Record<Theme, string>> = {
  street: C.chalk,
  pitch: '#f4fff4',
  beach: '#fffaf0',
  court: '#eef4ff',
  clay: '#fff2e8',
  roof: '#efeaff',
  snow: '#ffffff',
  sunset: '#fff3e0',
  night: '#ffd97a',
};

/** The alley floor: paving stones, and the pitch the kids have chalked onto them. */
export function paintGround(ctx: CanvasRenderingContext2D, level: Level): void {
  const { arena, ballStart, id } = level.def;
  const g = level.goal;
  const right = arena.x + arena.w;
  const bottom = arena.y + arena.h;
  const cx = arena.x + arena.w / 2;
  const cy = arena.y + arena.h / 2;
  const rng = seededRandom(hashString(id) ^ 0x9e3779b9);

  ctx.save();
  ctx.beginPath();
  ctx.rect(arena.x, arena.y, arena.w, arena.h);
  ctx.clip();

  const theme = level.def.theme ?? 'street';
  ctx.fillStyle = theme === 'street' ? C.ground : GROUNDS[theme][0];
  ctx.fillRect(arena.x, arena.y, arena.w, arena.h);

  // Pavers in a running bond, a few of them a shade off. Other grounds are mown or raked in bands.
  const ph = 58;
  const pw = 116;
  let row = 0;
  if (theme !== 'street') {
    ctx.fillStyle = GROUNDS[theme][1];
    for (let y = arena.y; y < bottom; y += 156) ctx.fillRect(arena.x, y, arena.w, 78);
  }
  for (let y = arena.y; theme === 'street' && y < bottom; y += ph, row++) {
    const offset = row % 2 === 0 ? 0 : pw / 2;
    for (let x = arena.x - offset; x < right; x += pw) {
      const r = rng();
      if (r < 0.16) {
        ctx.fillStyle = r < 0.08 ? rgba(C.paver, 0.09) : rgba('#ffffff', 0.1);
        ctx.fillRect(x, y, pw, ph);
      }
    }
  }
  ctx.strokeStyle = rgba(C.paver, 0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  row = 0;
  for (let y = arena.y; theme === 'street' && y <= bottom; y += ph, row++) {
    ctx.moveTo(arena.x, y);
    ctx.lineTo(right, y);
    const offset = row % 2 === 0 ? 0 : pw / 2;
    for (let x = arena.x - offset + pw; x < right; x += pw) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + ph);
    }
  }
  ctx.stroke();

  // Theme dressing, straight on the ground: shells and foam on sand, sparkles on snow.
  if (theme === 'beach' || theme === 'snow') {
    const n = theme === 'beach' ? 26 : 44;
    for (let i = 0; i < n; i++) {
      const dx = arena.x + rng() * arena.w;
      const dy = arena.y + rng() * arena.h;
      ctx.fillStyle = theme === 'beach' ? rgba('#ffffff', 0.5 + rng() * 0.3) : rgba('#ffffff', 0.65 + rng() * 0.35);
      ctx.beginPath();
      ctx.arc(dx, dy, theme === 'beach' ? 3 + rng() * 4 : 1.5 + rng() * 2, 0, TAU);
      ctx.fill();
    }
  }
  if (theme === 'night') {
    // Floodlights: two warm pools over the alley.
    for (const fx of [arena.x + arena.w * 0.3, arena.x + arena.w * 0.7]) {
      const glow = ctx.createRadialGradient(fx, cy, 20, fx, cy, 320);
      glow.addColorStop(0, rgba('#ffe9a8', 0.22));
      glow.addColorStop(1, rgba('#ffe9a8', 0));
      ctx.fillStyle = glow;
      ctx.fillRect(fx - 320, cy - 320, 640, 640);
    }
  }

  // The chalk pitch.
  const line = THEME_CHALK[theme];
  ctx.beginPath();
  ctx.moveTo(arena.x + 24, cy);
  ctx.lineTo(right - 24, cy);
  chalk(ctx, 5, line);
  ctx.beginPath();
  ctx.arc(cx, cy, 96, 0, TAU);
  chalk(ctx, 5, line);
  const boxW = g.width + 150;
  ctx.beginPath();
  ctx.moveTo(g.cx - boxW / 2, arena.y);
  ctx.lineTo(g.cx - boxW / 2, arena.y + 124);
  ctx.lineTo(g.cx + boxW / 2, arena.y + 124);
  ctx.lineTo(g.cx + boxW / 2, arena.y);
  chalk(ctx, 5, line);

  // Where the ball goes: a chalk ring and a cross.
  ctx.beginPath();
  ctx.arc(ballStart.x, ballStart.y, 32, 0, TAU);
  chalk(ctx, 4, line);
  ctx.beginPath();
  ctx.moveTo(ballStart.x - 9, ballStart.y - 9);
  ctx.lineTo(ballStart.x + 9, ballStart.y + 9);
  ctx.moveTo(ballStart.x + 9, ballStart.y - 9);
  ctx.lineTo(ballStart.x - 9, ballStart.y + 9);
  chalk(ctx, 3, line);

  // The goal line, painted properly because it matters.
  ctx.fillStyle = C.white;
  ctx.fillRect(g.leftPostX, arena.y, g.rightPostX - g.leftPostX, 6);
  ctx.restore();
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
};

/** A solid block in the game's oblique view: footprint on the ground, top face lifted straight up. */
export function drawBlock(ctx: CanvasRenderingContext2D, b: Block): void {
  // Recoil away from the ball, easing out with the square of the hit.
  const push = b.hit * b.hit * 5;
  const ox = -b.hitNx * push;
  const oy = -b.hitNy * push;
  if (b.kind === 'car') {
    drawTaxi(ctx, b, ox, oy);
    return;
  }
  const p = footprint(b, ox, oy);
  const lift = b.lift;
  const look = LOOKS[b.kind];

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
  ctx.translate(b.x + ox, b.y + oy - lift);
  ctx.rotate(b.angle);
  const hw = b.w / 2;
  const hh = b.h / 2;
  if (b.kind === 'crate') {
    // Slats, and the oranges inside.
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 4;
    ctx.strokeRect(-hw + 4, -hh + 4, b.w - 8, b.h - 8);
    const cols = Math.max(1, Math.floor((b.w - 20) / 26));
    const rows = Math.max(1, Math.floor((b.h - 20) / 24));
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
  } else if (b.kind === 'wall') {
    // A line of blue tile along the cap.
    ctx.fillStyle = rgba(C.blue, 0.85);
    const tile = 14;
    const along = b.w >= b.h;
    const len = along ? b.w : b.h;
    for (let d = -len / 2 + 10; d < len / 2 - 10; d += tile * 2) {
      if (along) ctx.fillRect(d, -3, tile, 6);
      else ctx.fillRect(-3, d, 6, tile);
    }
  } else if (b.kind === 'shutter') {
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
    ctx.fillRect(-hw, hh - 5, b.w, 5);
  } else if (b.kind === 'hedge') {
    // Leafy hedge: dark scallops over the green, lighter tufts on top.
    ctx.fillStyle = rgba('#1e4d1e', 0.5);
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 24));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (b.w - 26)) / Math.max(1, cols - 1);
        const y = -hh + 12 + (j * (b.h - 24)) / Math.max(1, rows - 1);
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.fill();
      }
    }
    ctx.fillStyle = rgba('#bfe6a8', 0.7);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -hw + 13 + (i * (b.w - 26)) / Math.max(1, cols - 1) - 3;
        const y = -hh + 12 + (j * (b.h - 24)) / Math.max(1, rows - 1) - 3;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = rgba(C.shadow, 0.1);
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw + 5, -hh + 5, b.w - 10, b.h - 10);
  }
  if (b.hit > 0) {
    ctx.fillStyle = rgba(b.kind === 'crate' ? '#ffffff' : C.sun, b.hit * 0.45);
    ctx.fillRect(-hw, -hh, b.w, b.h);
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
