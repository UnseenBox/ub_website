import { hashString, seededRandom, TAU } from '../core/math';
import type { Point, Surface } from '../levels/LevelDefinition';
import type { Level } from '../levels/Level';
import { roundRect } from './DrawUtils';
import { C, rgba } from './Palette';

/**
 * The street itself.
 *
 * The old game painted every alley with the same golden paving and then chalked a football
 * pitch onto it, so a hundred levels looked like one pitch with the furniture rearranged.
 * Here every level picks its own ground: worn asphalt, poured concrete, market terracotta,
 * beach sand, cracked cement, roof screed, patchy pavement, a street of drains, courtyard
 * tile, old cobbles, ice, wet tarmac or the ochre paving of the houma.
 *
 * None of it changes the physics. It only tells the player where they are.
 */

interface Look {
  base: string;
  alt: string;
  seam: string;
  grit: string;
  mark: string;
}

const LOOKS: Readonly<Record<Surface, Look>> = {
  asphalt: { base: '#5f616b', alt: '#52545e', seam: '#43454f', grit: '#7b7d86', mark: '#3a3c44' },
  concrete: { base: '#b8b4a7', alt: '#aaa697', seam: '#8e8b7f', grit: '#c9c5b7', mark: '#6e6c61' },
  paving: { base: '#d8b375', alt: '#c8a361', seam: '#9a7b46', grit: '#e4c68e', mark: '#896c3b' },
  terracotta: { base: '#c76a49', alt: '#d58460', seam: '#a44f36', grit: '#e49b79', mark: '#8c4028' },
  sand: { base: '#efd9a5', alt: '#e3ca8f', seam: '#d1b276', grit: '#f7e9c3', mark: '#c5a669' },
  cracked: { base: '#aaa699', alt: '#9b9789', seam: '#6e6c60', grit: '#bdb9ab', mark: '#5e5c52' },
  rooftop: { base: '#8f8ca1', alt: '#7b7891', seam: '#69667b', grit: '#a19eae', mark: '#555268' },
  patches: { base: '#5e606a', alt: '#b1aea1', seam: '#464852', grit: '#7b7d86', mark: '#3a3c44' },
  drains: { base: '#595b65', alt: '#4b4d57', seam: '#40424c', grit: '#777983', mark: '#32343c' },
  tiles: { base: '#e5eef2', alt: '#c8dce6', seam: '#9eb8c5', grit: '#f3f8fa', mark: '#2f6fa8' },
  cobble: { base: '#8e8778', alt: '#9c9383', seam: '#716b5f', grit: '#a89f8d', mark: '#605a50' },
  ice: { base: '#dceffd', alt: '#c6e1f4', seam: '#ffffff', grit: '#f3fbff', mark: '#a6cbe4' },
  wet: { base: '#42444e', alt: '#373943', seam: '#2c2e37', grit: '#585b66', mark: '#22242b' },
  turf: { base: '#3f9a4a', alt: '#378f43', seam: '#ffffff', grit: '#5cb566', mark: '#2d7a38' },
};

/** The outline of the playable ground, as a path ready to clip or fill. */
export function streetPath(ctx: CanvasRenderingContext2D, level: Level): void {
  const poly = level.playable;
  ctx.beginPath();
  if (poly.length === 0) {
    const { arena } = level.def;
    ctx.rect(arena.x, arena.y, arena.w, arena.h);
    return;
  }
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

function pointInPoly(poly: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A random spot on the street, clear of the walls. */
function spot(rng: () => number, poly: readonly Point[], margin: number): Point | null {
  if (poly.length < 3) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  for (let i = 0; i < 40; i++) {
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (!pointInPoly(poly, x, y)) continue;
    // Keep clear of the walls by checking the distance to every edge.
    let clear = true;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
      if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) < margin) {
        clear = false;
        break;
      }
    }
    if (clear) return { x, y };
  }
  return null;
}

/** A soft blotch: oil on tarmac, damp on concrete, a worn patch on paving. */
function blotch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const rr = r * (0.62 + ((i * 37) % 11) / 22);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.78;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** A branching crack in hard ground. */
function crack(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string, width: number, rng: () => number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  let px = x;
  let py = y;
  let a = angle;
  ctx.beginPath();
  ctx.moveTo(px, py);
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    a += (rng() - 0.5) * 1.1;
    px += Math.cos(a) * (len / steps);
    py += Math.sin(a) * (len / steps);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** The surface of the street. */
export function paintStreet(ctx: CanvasRenderingContext2D, level: Level): void {
  const { surface = 'paving' } = level.def;
  const look = LOOKS[surface];
  const rng = seededRandom(hashString(level.def.id) ^ 0x9e3779b9);
  const { arena } = level.def;

  ctx.save();
  streetPath(ctx, level);
  ctx.clip();

  ctx.fillStyle = look.base;
  ctx.fillRect(arena.x - 40, arena.y - 40, arena.w + 80, arena.h + 80);

  switch (surface) {
    case 'asphalt':
      paintAsphalt(ctx, level, look, rng);
      break;
    case 'concrete':
      paintConcrete(ctx, level, look, rng);
      break;
    case 'paving':
      paintPaving(ctx, level, look, rng);
      break;
    case 'terracotta':
      paintTerracotta(ctx, level, look, rng);
      break;
    case 'sand':
      paintSand(ctx, level, look, rng);
      break;
    case 'cracked':
      paintCracked(ctx, level, look, rng);
      break;
    case 'rooftop':
      paintRooftop(ctx, level, look, rng);
      break;
    case 'patches':
      paintPatches(ctx, level, look, rng);
      break;
    case 'drains':
      paintDrains(ctx, level, look, rng);
      break;
    case 'tiles':
      paintTiles(ctx, level, look, rng);
      break;
    case 'cobble':
      paintCobble(ctx, level, look, rng);
      break;
    case 'ice':
      paintIce(ctx, level, look, rng);
      break;
    case 'wet':
      paintWet(ctx, level, look, rng);
      break;
    case 'turf':
      paintTurf(ctx, level, look, rng);
      break;
  }

  paintDressing(ctx, level, rng);
  paintGoalLine(ctx, level, surface);
  paintBallMark(ctx, level, surface);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 *  The surfaces
 * ------------------------------------------------------------------ */

function paintAsphalt(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  // Tar seams holding two stretches of road together.
  ctx.strokeStyle = rgba(look.seam, 0.75);
  ctx.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    const y = arena.y + 140 + i * 300 + rng() * 80;
    ctx.beginPath();
    ctx.moveTo(arena.x - 20, y);
    for (let x = arena.x; x < arena.x + arena.w + 40; x += 90) ctx.lineTo(x, y + (rng() - 0.5) * 16);
    ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const p = spot(rng, level.playable, 50);
    if (!p) continue;
    blotch(ctx, p.x, p.y, 26 + rng() * 34, look.mark, 0.2 + rng() * 0.2);
  }
  for (let i = 0; i < 5; i++) {
    const p = spot(rng, level.playable, 60);
    if (!p) continue;
    crack(ctx, p.x, p.y, 70 + rng() * 70, rng() * TAU, rgba(look.seam, 0.5), 2, rng);
  }
  ctx.fillStyle = rgba(look.grit, 0.35);
  for (let i = 0; i < 130; i++) {
    const p = spot(rng, level.playable, 8);
    if (!p) continue;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

function paintConcrete(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  ctx.strokeStyle = rgba(look.seam, 0.55);
  ctx.lineWidth = 3;
  const sw = 250;
  const sh = 230;
  for (let x = arena.x - sw; x < arena.x + arena.w + sw; x += sw) {
    ctx.beginPath();
    ctx.moveTo(x, arena.y - 20);
    ctx.lineTo(x + 12, arena.y + arena.h + 20);
    ctx.stroke();
  }
  for (let y = arena.y - sh; y < arena.y + arena.h + sh; y += sh) {
    ctx.beginPath();
    ctx.moveTo(arena.x - 20, y);
    ctx.lineTo(arena.x + arena.w + 20, y + 8);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const p = spot(rng, level.playable, 40);
    if (!p) continue;
    ctx.fillStyle = rgba(rng() < 0.5 ? look.alt : look.grit, 0.3);
    ctx.fillRect(p.x - 60, p.y - 40, 120 + rng() * 60, 80 + rng() * 50);
  }
  for (let i = 0; i < 6; i++) {
    const p = spot(rng, level.playable, 50);
    if (!p) continue;
    crack(ctx, p.x, p.y, 60 + rng() * 80, rng() * TAU, rgba(look.seam, 0.6), 1.6, rng);
  }
}

function paintPaving(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  const ph = 62;
  const pw = 124;
  let row = 0;
  for (let y = arena.y - ph; y < arena.y + arena.h + ph; y += ph, row++) {
    const off = row % 2 === 0 ? 0 : pw / 2;
    for (let x = arena.x - off - pw; x < arena.x + arena.w + pw; x += pw) {
      const r = rng();
      if (r < 0.2) {
        ctx.fillStyle = rgba(r < 0.09 ? look.seam : look.grit, r < 0.09 ? 0.12 : 0.16);
        ctx.fillRect(x + 3, y + 3, pw - 6, ph - 6);
      }
    }
  }
  ctx.strokeStyle = rgba(look.seam, 0.32);
  ctx.lineWidth = 2;
  row = 0;
  for (let y = arena.y - ph; y < arena.y + arena.h + ph; y += ph, row++) {
    ctx.beginPath();
    ctx.moveTo(arena.x - 40, y);
    ctx.lineTo(arena.x + arena.w + 40, y);
    const off = row % 2 === 0 ? 0 : pw / 2;
    for (let x = arena.x - off; x < arena.x + arena.w + pw; x += pw) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + ph);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const p = spot(rng, level.playable, 70);
    if (!p) continue;
    blotch(ctx, p.x, p.y, 30, look.mark, 0.14);
  }
}

function paintTerracotta(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  const t = 76;
  for (let y = arena.y - t; y < arena.y + arena.h + t; y += t) {
    for (let x = arena.x - t; x < arena.x + arena.w + t; x += t) {
      const r = rng();
      ctx.fillStyle = rgba(r < 0.22 ? look.alt : r < 0.34 ? '#e8d6bb' : look.base, 0.85);
      ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
    }
  }
  ctx.strokeStyle = rgba(look.seam, 0.4);
  ctx.lineWidth = 2;
  for (let y = arena.y - t; y < arena.y + arena.h + t; y += t) {
    ctx.beginPath();
    ctx.moveTo(arena.x - 40, y);
    ctx.lineTo(arena.x + arena.w + 40, y);
    ctx.stroke();
  }
  for (let x = arena.x - t; x < arena.x + arena.w + t; x += t) {
    ctx.beginPath();
    ctx.moveTo(x, arena.y - 40);
    ctx.lineTo(x, arena.y + arena.h + 40);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const p = spot(rng, level.playable, 60);
    if (!p) continue;
    blotch(ctx, p.x, p.y, 22 + rng() * 18, '#7a4a2a', 0.16);
  }
}

function paintSand(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  // Wind ripples: long, shallow curves.
  ctx.strokeStyle = rgba(look.alt, 0.7);
  ctx.lineWidth = 7;
  for (let y = arena.y + 60; y < arena.y + arena.h; y += 46) {
    ctx.beginPath();
    ctx.moveTo(arena.x - 20, y);
    for (let x = arena.x; x < arena.x + arena.w + 40; x += 70) {
      ctx.quadraticCurveTo(x + 35, y + (rng() - 0.5) * 18, x + 70, y + (rng() - 0.5) * 6);
    }
    ctx.stroke();
  }
  // Shells and bright grains.
  for (let i = 0; i < 34; i++) {
    const p = spot(rng, level.playable, 10);
    if (!p) continue;
    ctx.fillStyle = rgba(i % 3 === 0 ? '#ffffff' : look.grit, 0.7);
    ctx.beginPath();
    ctx.arc(p.x, p.y, i % 3 === 0 ? 3 : 1.6, 0, TAU);
    ctx.fill();
  }
  // A dry drift against one wall.
  for (let i = 0; i < 3; i++) {
    const p = spot(rng, level.playable, 80);
    if (!p) continue;
    blotch(ctx, p.x, p.y, 46, look.alt, 0.45);
  }
}

function paintCracked(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  // Big slabs of broken cement.
  ctx.strokeStyle = rgba(look.seam, 0.6);
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = arena.x + rng() * arena.w;
    const y = arena.y + rng() * arena.h;
    crack(ctx, x, y, 140 + rng() * 160, rng() * TAU, rgba(look.seam, 0.6), 2.4, rng);
  }
  for (let i = 0; i < 10; i++) {
    const p = spot(rng, level.playable, 40);
    if (!p) continue;
    blotch(ctx, p.x, p.y, 26 + rng() * 30, look.alt, 0.35);
  }
  // Weeds pushing through the cracks.
  for (let i = 0; i < 12; i++) {
    const p = spot(rng, level.playable, 30);
    if (!p) continue;
    ctx.fillStyle = rgba('#5f8a3e', 0.8);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(p.x + (rng() - 0.5) * 12, p.y + (rng() - 0.5) * 10, 7, 3, rng() * TAU, 0, TAU);
      ctx.fill();
    }
  }
}

function paintRooftop(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  // Felt patches rolled out over the screed.
  for (let i = 0; i < 7; i++) {
    const p = spot(rng, level.playable, 60);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((rng() - 0.5) * 0.4);
    ctx.fillStyle = rgba(look.alt, 0.65);
    ctx.fillRect(-70 - rng() * 50, -40, 140 + rng() * 100, 80 + rng() * 20);
    ctx.strokeStyle = rgba(look.seam, 0.5);
    ctx.lineWidth = 3;
    ctx.strokeRect(-70 - rng() * 50, -40, 140 + rng() * 100, 80 + rng() * 20);
    ctx.restore();
  }
  // Gravel along the parapet.
  ctx.fillStyle = rgba(look.grit, 0.5);
  for (let i = 0; i < 120; i++) {
    const p = spot(rng, level.playable, 12);
    if (!p) continue;
    ctx.fillRect(p.x, p.y, 2.5, 2.5);
  }
  ctx.strokeStyle = rgba('#ffffff', 0.22);
  ctx.lineWidth = 2;
  for (let y = arena.y + 90; y < arena.y + arena.h; y += 150) {
    ctx.beginPath();
    ctx.moveTo(arena.x, y);
    ctx.lineTo(arena.x + arena.w, y + 8);
    ctx.stroke();
  }
}

function paintPatches(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  // Pale concrete repairs dropped into the tarmac.
  for (let i = 0; i < 9; i++) {
    const p = spot(rng, level.playable, 30);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((rng() - 0.5) * 1.2);
    const w = 70 + rng() * 130;
    const h = 40 + rng() * 80;
    ctx.fillStyle = rgba(look.alt, 0.8);
    roundRect(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = rgba(look.seam, 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = rgba(look.seam, 0.5);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const p = spot(rng, level.playable, 50);
    if (!p) continue;
    crack(ctx, p.x, p.y, 80 + rng() * 90, rng() * TAU, rgba(look.seam, 0.5), 2, rng);
  }
  ctx.fillStyle = rgba(look.grit, 0.3);
  for (let i = 0; i < 90; i++) {
    const p = spot(rng, level.playable, 8);
    if (!p) continue;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

function paintDrains(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  paintAsphalt(ctx, level, look, rng);
  // A grid of iron covers and grates.
  const cols = 3;
  const rows = 5;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = arena.x + 120 + i * 230;
      const y = arena.y + 140 + j * 190;
      if (!pointInPoly(level.playable, x, y)) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = rgba(look.mark, 0.95);
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(look.grit, 0.8);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(look.grit, 0.45);
      ctx.lineWidth = 2;
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 5, -15);
        ctx.lineTo(k * 5, 15);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // Drain grates against the kerb.
  for (let i = 0; i < 4; i++) {
    const p = spot(rng, level.playable, 40);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rng() < 0.5 ? 0 : Math.PI / 2);
    ctx.fillStyle = rgba('#2b2d34', 0.95);
    ctx.fillRect(-30, -14, 60, 28);
    ctx.strokeStyle = rgba(look.grit, 0.4);
    ctx.lineWidth = 2;
    for (let x = -24; x <= 24; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x, 10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function paintTiles(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  const t = 58;
  for (let y = arena.y - t; y < arena.y + arena.h + t; y += t) {
    let col = 0;
    for (let x = arena.x - t; x < arena.x + arena.w + t; x += t, col++) {
      const blue = (Math.floor((y - arena.y) / t) + col) % 3 === 0;
      ctx.fillStyle = blue ? rgba(look.mark, 0.34) : rgba(rng() < 0.1 ? look.alt : look.base, 0.9);
      ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
      if (blue) {
        ctx.fillStyle = rgba('#ffffff', 0.35);
        ctx.fillRect(x + 12, y + 12, t - 24, t - 24);
      }
    }
  }
  ctx.strokeStyle = rgba(look.seam, 0.5);
  ctx.lineWidth = 2;
  for (let y = arena.y - t; y < arena.y + arena.h + t; y += t) {
    ctx.beginPath();
    ctx.moveTo(arena.x - 40, y);
    ctx.lineTo(arena.x + arena.w + 40, y);
    ctx.stroke();
  }
  for (let x = arena.x - t; x < arena.x + arena.w + t; x += t) {
    ctx.beginPath();
    ctx.moveTo(x, arena.y - 40);
    ctx.lineTo(x, arena.y + arena.h + 40);
    ctx.stroke();
  }
  // A chip out of the glaze, here and there.
  for (let i = 0; i < 10; i++) {
    const p = spot(rng, level.playable, 20);
    if (!p) continue;
    ctx.fillStyle = rgba(look.grit, 0.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + rng() * 4, 0, TAU);
    ctx.fill();
  }
}

function paintCobble(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  const w = 54;
  const h = 36;
  for (let y = arena.y - h; y < arena.y + arena.h + h; y += h) {
    const off = (Math.round((y - arena.y) / h) % 2) * (w / 2);
    for (let x = arena.x - w - off; x < arena.x + arena.w + w; x += w) {
      const grey = rng();
      ctx.fillStyle = rgba(grey < 0.25 ? look.alt : grey < 0.45 ? look.grit : look.base, 0.9);
      ctx.beginPath();
      ctx.ellipse(x + w / 2 + off, y + h / 2, w * 0.42, h * 0.38, 0, 0, TAU);
      ctx.fill();
    }
  }
  // Worn pale tracks where carts always went.
  ctx.strokeStyle = rgba(look.grit, 0.25);
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  for (const x of [arena.x + 210, arena.x + 490]) {
    ctx.beginPath();
    ctx.moveTo(x, arena.y + 80);
    ctx.lineTo(x + 30, arena.y + arena.h);
    ctx.stroke();
  }
  void level;
}

function paintIce(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  // Frozen puddles: pale, flat, with a bright rim.
  for (let i = 0; i < 7; i++) {
    const p = spot(rng, level.playable, 40);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = rgba(look.alt, 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 60 + rng() * 50, 30 + rng() * 30, rng() * TAU, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.75);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  // Cracks in the ice.
  for (let i = 0; i < 10; i++) {
    const p = spot(rng, level.playable, 30);
    if (!p) continue;
    crack(ctx, p.x, p.y, 80 + rng() * 110, rng() * TAU, rgba('#ffffff', 0.8), 1.6, rng);
  }
  // A cold blue sheen.
  const g = ctx.createLinearGradient(arena.x, arena.y, arena.x + arena.w, arena.y + arena.h);
  g.addColorStop(0, rgba(look.mark, 0.18));
  g.addColorStop(0.5, rgba('#ffffff', 0.05));
  g.addColorStop(1, rgba(look.mark, 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(arena.x, arena.y, arena.w, arena.h);
}

/** A stadium pitch: mowing stripes, blades of grass, and the chalk of the penalty area. */
function paintTurf(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena, goal } = level.def;
  // Mowing stripes, alternate bands a shade darker.
  const band = 94;
  for (let y = arena.y - band, i = 0; y < arena.y + arena.h + band; y += band, i++) {
    if (i % 2 === 1) {
      ctx.fillStyle = look.alt;
      ctx.fillRect(arena.x - 40, y, arena.w + 80, band);
    }
  }
  // Blades, short and pale, thrown across the grass.
  ctx.strokeStyle = rgba(look.grit, 0.4);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 360; i++) {
    const x = arena.x + rng() * arena.w;
    const y = arena.y + rng() * arena.h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 4, y - 6 - rng() * 6);
  }
  ctx.stroke();
  // The chalk: penalty area, six-yard box, spot and the arc outside the box.
  const line = rgba(C.white, 0.82);
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  const cx = goal.x;
  const top = goal.lineY;
  const boxW = 460;
  const boxH = 270;
  ctx.strokeRect(cx - boxW / 2, top, boxW, boxH);
  ctx.strokeRect(cx - 140, top, 280, 96);
  ctx.fillStyle = line;
  ctx.beginPath();
  ctx.arc(cx, top + 190, 7, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, top + 190, 130, Math.asin((boxH - 190) / 130) , Math.PI - Math.asin((boxH - 190) / 130));
  ctx.stroke();
}

function paintWet(ctx: CanvasRenderingContext2D, level: Level, look: Look, rng: () => number): void {
  const { arena } = level.def;
  paintAsphalt(ctx, level, look, rng);
  // Standing water: dark pools with a bright reflected rim.
  for (let i = 0; i < 8; i++) {
    const p = spot(rng, level.playable, 50);
    if (!p) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rng() * TAU);
    const w = 50 + rng() * 80;
    const h = 20 + rng() * 34;
    ctx.fillStyle = rgba('#1d2a3a', 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#cfe6f5', 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-4, -3, w * 0.8, h * 0.7, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // The long sheen of a street lamp on wet tarmac.
  ctx.fillStyle = rgba('#f6e6b0', 0.06);
  for (const x of [arena.x + 180, arena.x + 520]) {
    ctx.beginPath();
    ctx.moveTo(x - 40, arena.y + 200);
    ctx.lineTo(x + 40, arena.y + 200);
    ctx.lineTo(x + 90, arena.y + arena.h);
    ctx.lineTo(x - 90, arena.y + arena.h);
    ctx.closePath();
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ *
 *  Landmarks on the ground
 * ------------------------------------------------------------------ */

/** Flat street furniture: it tells you where you are and never blocks the ball. */
export function paintDressing(ctx: CanvasRenderingContext2D, level: Level, rng: () => number): void {
  for (const d of level.def.dressing ?? []) {
    const s = d.scale ?? 1;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle ?? 0);
    ctx.scale(s, s);
    switch (d.kind) {
      case 'garage':
        garage(ctx);
        break;
      case 'cafe':
        cafe(ctx);
        break;
      case 'mural':
        mural(ctx, rng);
        break;
      case 'fountain':
        fountain(ctx, rng);
        break;
      case 'stairs':
        stairs(ctx);
        break;
      case 'stall':
        stall(ctx);
        break;
      case 'washline':
        washline(ctx, rng);
        break;
      case 'manhole':
        manhole(ctx);
        break;
      case 'puddle':
        puddle(ctx);
        break;
      case 'parking':
        parking(ctx);
        break;
      case 'phonebox':
        phonebox(ctx);
        break;
      case 'planter':
        planter(ctx, rng);
        break;
      case 'signpost':
        signpost(ctx);
        break;
      case 'grill':
        grill(ctx);
        break;
      case 'barrel':
        barrel(ctx);
        break;
    }
    ctx.restore();
  }
}

function shadow(ctx: CanvasRenderingContext2D, draw: () => void, d = 6): void {
  ctx.save();
  ctx.translate(d, d * 0.7);
  ctx.fillStyle = rgba(C.shadow, 0.18);
  draw();
  ctx.restore();
}

function garage(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.2);
  ctx.fillRect(-86, -54, 176, 112);
  ctx.fillStyle = C.blue;
  ctx.fillRect(-88, -58, 176, 112);
  ctx.strokeStyle = rgba(C.blueDark, 0.8);
  ctx.lineWidth = 3;
  for (let y = -52; y < 48; y += 12) {
    ctx.beginPath();
    ctx.moveTo(-82, y);
    ctx.lineTo(82, y);
    ctx.stroke();
  }
  ctx.fillStyle = C.sun;
  ctx.fillRect(-88, 40, 176, 8);
  ctx.fillStyle = rgba('#ffffff', 0.25);
  ctx.fillRect(-82, -52, 164, 6);
}

function cafe(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.sun, 0.5);
  ctx.beginPath();
  ctx.moveTo(-96, -60);
  ctx.lineTo(96, -60);
  ctx.lineTo(76, -12);
  ctx.lineTo(-76, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(C.terra, 0.7);
  for (let x = -72; x <= 72; x += 24) ctx.fillRect(x, -58, 12, 46);
  // Two little tables and their chairs.
  for (const sx of [-44, 44]) {
    ctx.fillStyle = rgba(C.shadow, 0.18);
    ctx.beginPath();
    ctx.arc(sx + 4, 12, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(sx, 8, 21, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(C.navy, 0.25);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.wood;
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx + sy * 30, 8, 8, 0, TAU);
      ctx.fill();
    }
  }
}

function mural(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.fillStyle = rgba(C.white, 0.9);
  ctx.fillRect(-90, -50, 180, 100);
  const cols = [C.blue, C.terra, C.sun, '#5da24a', '#8f5bb8'] as const;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = rgba(cols[Math.floor(rng() * cols.length)], 0.75);
    const x = -80 + rng() * 130;
    const y = -40 + rng() * 70;
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + rng() * 22, 8 + rng() * 16, rng() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(C.navy, 0.25);
  ctx.lineWidth = 3;
  ctx.strokeRect(-90, -50, 180, 100);
}

function fountain(ctx: CanvasRenderingContext2D, rng: () => number): void {
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, TAU);
    ctx.fill();
  }, 10);
  ctx.fillStyle = C.whiteShade;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.6);
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 10 + i * 8 + rng() * 3, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = C.stone;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
}

function stairs(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.2);
  ctx.fillRect(-50, -44, 110, 96);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? C.stone : C.stoneDark;
    ctx.fillRect(-54, -48 + i * 19, 108, 17);
  }
  ctx.fillStyle = rgba(C.blue, 0.85);
  ctx.fillRect(38, -48, 16, 95);
}

function stall(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.18);
  ctx.fillRect(-62, -38, 132, 92);
  // Striped canopy.
  const stripe = 22;
  for (let x = -60; x < 60; x += stripe) {
    ctx.fillStyle = (Math.round((x + 60) / stripe) % 2 === 0) ? C.terra : C.white;
    ctx.fillRect(x, -40, stripe, 56);
  }
  ctx.fillStyle = C.wood;
  ctx.fillRect(-58, 16, 116, 30);
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 3;
  ctx.strokeRect(-58, 16, 116, 30);
  // Fruit on the trestle.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = [C.orange, C.sun, '#c8442e', '#7cae4a'][i % 4];
    ctx.beginPath();
    ctx.arc(-46 + (i % 4) * 30, 24 + Math.floor(i / 4) * 14, 8, 0, TAU);
    ctx.fill();
  }
}

function washline(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.strokeStyle = rgba(C.navy, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-90, 0);
  ctx.lineTo(90, 0);
  ctx.stroke();
  const cols = [C.white, C.blueLite, C.terra, C.sun] as const;
  for (let i = 0; i < 6; i++) {
    const x = -80 + i * 30;
    const w = 14 + rng() * 12;
    ctx.fillStyle = rgba(C.shadow, 0.14);
    ctx.fillRect(x + 4, 4, w, 8);
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(x, -3, w, 8);
  }
  ctx.fillStyle = C.woodDark;
  for (const x of [-90, 86]) ctx.fillRect(x - 2, -8, 4, 16);
}

function manhole(ctx: CanvasRenderingContext2D): void {
  shadow(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.fill();
  }, 4);
  ctx.fillStyle = '#3c3e46';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#60636d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, TAU);
  ctx.stroke();
}

function puddle(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba('#2b3c52', 0.28);
  ctx.beginPath();
  ctx.ellipse(0, 0, 58, 26, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#cfe6f5', 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-4, -3, 44, 17, 0.2, 0, TAU);
  ctx.stroke();
}

function parking(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = rgba(C.white, 0.45);
  ctx.lineWidth = 4;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 70 - 30, -60);
    ctx.lineTo(i * 70 - 30, 60);
    ctx.stroke();
  }
}

function phonebox(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.22);
  ctx.fillRect(-14, -18, 46, 66);
  ctx.fillStyle = '#c8402f';
  ctx.fillRect(-18, -22, 36, 62);
  ctx.fillStyle = rgba('#ffe08a', 0.85);
  ctx.fillRect(-11, -15, 22, 30);
  ctx.strokeStyle = rgba(C.navy, 0.4);
  ctx.lineWidth = 2;
  ctx.strokeRect(-11, -15, 22, 30);
}

function planter(ctx: CanvasRenderingContext2D, rng: () => number): void {
  shadow(ctx, () => {
    ctx.fillRect(-30, -22, 66, 52);
  }, 5);
  ctx.fillStyle = C.stone;
  ctx.fillRect(-32, -24, 64, 48);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(-26, -18, 52, 36);
  ctx.fillStyle = '#5f8a3e';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(-18 + rng() * 36, -10 + rng() * 22, 9 + rng() * 5, 0, TAU);
    ctx.fill();
  }
}

function signpost(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = C.blueDark;
  ctx.fillRect(-2, -6, 4, 42);
  ctx.fillStyle = C.white;
  ctx.fillRect(-34, -18, 68, 18);
  ctx.fillStyle = C.blue;
  ctx.fillRect(-30, -15, 60, 12);
  ctx.fillStyle = rgba(C.white, 0.8);
  ctx.fillRect(-24, -12, 30, 3);
  ctx.fillRect(-24, -7, 20, 3);
  ctx.fillStyle = C.terra;
  ctx.beginPath();
  ctx.moveTo(30, -16);
  ctx.lineTo(42, -9);
  ctx.lineTo(30, -2);
  ctx.closePath();
  ctx.fill();
}

function grill(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.25);
  ctx.fillRect(-34, -20, 72, 48);
  ctx.fillStyle = '#3a3d4a';
  ctx.fillRect(-36, -22, 72, 44);
  ctx.strokeStyle = '#6b6f7d';
  ctx.lineWidth = 3;
  for (let x = -26; x <= 26; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, -16);
    ctx.lineTo(x, 16);
    ctx.stroke();
  }
  // Smoke stains climbing off the coals.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = rgba('#ffffff', 0.08);
    ctx.beginPath();
    ctx.arc(-16 + i * 8, 26 + i * 5, 10 + i * 3, 0, TAU);
    ctx.fill();
  }
}

function barrel(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = rgba(C.shadow, 0.2);
  ctx.beginPath();
  ctx.arc(5, 5, 18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3f6f8f';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  ctx.stroke();
}

/* ------------------------------------------------------------------ *
 *  The marks that matter
 * ------------------------------------------------------------------ */

/** The goal line. It has to read instantly on every surface, so it is always bright. */
function paintGoalLine(ctx: CanvasRenderingContext2D, level: Level, surface: Surface): void {
  const g = level.goal;
  const y = g.lineY;
  const w = g.rightPostX - g.leftPostX;
  const colour = surface === 'ice' ? '#2f6fa8' : surface === 'sand' ? '#ffffff' : C.white;
  ctx.fillStyle = rgba(colour, 0.95);
  ctx.fillRect(g.leftPostX, y - 3, w, 7);
  ctx.fillStyle = rgba(colour, 0.35);
  ctx.fillRect(g.leftPostX, y + 4, w, 4);
}

/** Where the ball starts. A chalk mark on hard ground, a raked ring in the sand. */
function paintBallMark(ctx: CanvasRenderingContext2D, level: Level, surface: Surface): void {
  const { x, y } = level.def.ballStart;
  const sandLike = surface === 'sand';
  const iceLike = surface === 'ice';
  const colour = sandLike ? '#ffffff' : iceLike ? '#2f6fa8' : C.chalk;
  const alpha = sandLike ? 0.55 : iceLike ? 0.5 : 0.7;
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.setLineDash(sandLike ? [] : [14, 6]);
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 10);
  ctx.lineTo(x + 10, y + 10);
  ctx.moveTo(x + 10, y - 10);
  ctx.lineTo(x - 10, y + 10);
  ctx.stroke();
}
