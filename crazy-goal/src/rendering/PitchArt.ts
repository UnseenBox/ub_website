import { hashString, seededRandom, TAU } from '../core/math';
import type { Point } from '../levels/LevelDefinition';
import type { Level } from '../levels/Level';
import { C, rgba } from './Palette';
import { moodOf, type Mood } from './StadiumArt';

/**
 * The pitch: grass inside the boards, mown in a pattern of its own for each match, chalked with
 * touchlines, the box and the centre circle, worn where players stand, and lit by the stadium.
 * None of it changes the physics.
 */

/** The outline of the playable ground, as a path ready to clip or fill. */
export function pitchPath(ctx: CanvasRenderingContext2D, level: Level): void {
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

/** How the groundsman mowed the grass. */
type Mowing = 'stripes' | 'wide' | 'checks' | 'diagonal' | 'rings' | 'columns';
const MOWINGS: readonly Mowing[] = ['stripes', 'wide', 'checks', 'diagonal', 'rings', 'columns'];

function mowingOf(level: Level): Mowing {
  // The tutorial ground keeps the classic stripes; every other match has its own.
  if (level.def.theme === 'stadium') return 'stripes';
  return MOWINGS[hashString(level.def.id) % MOWINGS.length];
}

export function paintPitch(ctx: CanvasRenderingContext2D, level: Level): void {
  const mood = moodOf(level);
  const rng = seededRandom(hashString(level.def.id) ^ 0x9e3779b9);
  const { arena } = level.def;

  ctx.save();
  pitchPath(ctx, level);
  ctx.clip();

  ctx.fillStyle = mood.grass;
  ctx.fillRect(arena.x - 40, arena.y - 40, arena.w + 80, arena.h + 80);
  mow(ctx, level, mood, mowingOf(level));

  // Blades, short and pale, thrown across the grass.
  ctx.strokeStyle = rgba(mood.blade, 0.4);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 420; i++) {
    const x = arena.x + rng() * arena.w;
    const y = arena.y + rng() * arena.h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 4, y - 6 - rng() * 6);
  }
  ctx.stroke();

  paintWear(ctx, level);
  paintMarkings(ctx, level);
  if (mood.snow) paintFrost(ctx, level, rng);
  paintLight(ctx, level, mood);
  paintGoalLine(ctx, level);
  paintBallMark(ctx, level);
  ctx.restore();
}

/** The mowing: a second shade of green laid in a pattern. */
function mow(ctx: CanvasRenderingContext2D, level: Level, mood: Mood, mowing: Mowing): void {
  const { arena, goal } = level.def;
  const x0 = arena.x - 40;
  const y0 = arena.y - 40;
  const w = arena.w + 80;
  const h = arena.h + 80;
  ctx.fillStyle = mood.grassAlt;
  switch (mowing) {
    case 'stripes':
    case 'wide': {
      const band = mowing === 'wide' ? 140 : 94;
      for (let y = arena.y - band, i = 0; y < y0 + h; y += band, i++) if (i % 2 === 1) ctx.fillRect(x0, y, w, band);
      break;
    }
    case 'columns': {
      const band = 100;
      const start = goal.x - band / 2 - Math.ceil((goal.x - x0) / band) * band;
      for (let x = start, i = 0; x < x0 + w; x += band, i++) if (i % 2 === 1) ctx.fillRect(x, y0, band, h);
      break;
    }
    case 'checks': {
      const sq = 100;
      for (let y = arena.y - sq, j = 0; y < y0 + h; y += sq, j++)
        for (let x = goal.x - sq / 2 - Math.ceil((goal.x - x0) / sq) * sq, i = 0; x < x0 + w; x += sq, i++) if ((i + j) % 2 === 1) ctx.fillRect(x, y, sq, sq);
      break;
    }
    case 'diagonal': {
      const band = 90;
      ctx.save();
      ctx.translate(arena.x + arena.w / 2, arena.y + arena.h / 2);
      ctx.rotate(Math.PI / 4);
      const reach = Math.hypot(w, h) / 2 + band;
      for (let x = -reach, i = 0; x < reach; x += band, i++) if (i % 2 === 1) ctx.fillRect(x, -reach, band, reach * 2);
      ctx.restore();
      break;
    }
    case 'rings': {
      // Circles out from the penalty spot.
      const cx = goal.x;
      const cy = goal.lineY + 190;
      const band = 80;
      const reach = Math.hypot(w, h) + band;
      for (let r = reach, i = Math.ceil(reach / band); r > 0; r -= band, i--) {
        ctx.fillStyle = i % 2 === 1 ? mood.grassAlt : mood.grass;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
  }
}

/** Worn grass where the players stand most: the goal mouth and the spot the ball is kicked from. */
function paintWear(ctx: CanvasRenderingContext2D, level: Level): void {
  const { goal, ballStart } = level.def;
  const patch = (x: number, y: number, rx: number, ry: number, a: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(170, 150, 90, ${a})`);
    g.addColorStop(0.6, `rgba(150, 140, 80, ${a * 0.5})`);
    g.addColorStop(1, 'rgba(150, 140, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };
  patch(goal.x, goal.lineY + 30, 120, 50, 0.32);
  patch(ballStart.x, ballStart.y, 56, 40, 0.22);
}

/** Offsets an outline inwards edge by edge: `off(i)` is how far edge i (from point i to point i + 1) moves. */
function insetLoop(poly: readonly Point[], off: (i: number) => number): Point[] {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area >= 0 ? 1 : -1;
  const lines: { px: number; py: number; dx: number; dy: number; nx: number; ny: number; d: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    const d = off(i);
    lines.push({ px: a.x + -dy * sign * d, py: a.y + dx * sign * d, dx, dy, nx: -dy * sign, ny: dx * sign, d });
  }
  const out: Point[] = [{ x: lines[0].px, y: lines[0].py }];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i - 1];
    const q = lines[i];
    const cross = p.dx * q.dy - p.dy * q.dx;
    if (Math.abs(cross) < 1e-6) {
      out.push({ x: q.px, y: q.py });
      continue;
    }
    const t = ((q.px - p.px) * q.dy - (q.py - p.py) * q.dx) / cross;
    out.push({ x: p.px + p.dx * t, y: p.py + p.dy * t });
  }
  const last = lines[lines.length - 1];
  const b = poly[n - 1];
  out.push({ x: b.x + last.nx * last.d, y: b.y + last.ny * last.d });
  return out;
}

/** The chalk: touchlines a short way in from the boards, corner flags, the box, the spot, and the centre circle. */
function paintMarkings(ctx: CanvasRenderingContext2D, level: Level): void {
  const { arena, goal } = level.def;
  const chalk = rgba(C.white, 0.82);
  ctx.strokeStyle = chalk;
  ctx.fillStyle = chalk;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const poly = level.playable;
  let line: Point[] = [];
  if (poly.length >= 4) {
    const top = arena.y;
    line = insetLoop(poly, (i) => (Math.abs(poly[i].y - top) < 2 && Math.abs(poly[i + 1].y - top) < 2 ? 0 : 20));
    ctx.beginPath();
    line.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  // Penalty area, six-yard box, spot and the arc outside the box.
  const cx = goal.x;
  const top = goal.lineY;
  const boxW = 460;
  const boxH = 270;
  ctx.strokeRect(cx - boxW / 2, top, boxW, boxH);
  ctx.strokeRect(cx - 140, top, 280, 96);
  ctx.beginPath();
  ctx.arc(cx, top + 190, 7, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, top + 190, 130, Math.asin((boxH - 190) / 130), Math.PI - Math.asin((boxH - 190) / 130));
  ctx.stroke();

  // The halfway line runs along the near end: half the centre circle shows above it.
  const mx = arena.x + arena.w / 2;
  const my = arena.y + arena.h;
  ctx.beginPath();
  ctx.arc(mx, my, 130, Math.PI, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(arena.x - 40, my - 2);
  ctx.lineTo(arena.x + arena.w + 40, my - 2);
  ctx.stroke();

  // Corner flags: the line's vertex nearest each top corner of the arena.
  if (line.length === 0) return;
  for (const corner of [
    { x: arena.x, y: arena.y },
    { x: arena.x + arena.w, y: arena.y },
  ]) {
    let best = line[0];
    for (const p of line) if (Math.hypot(p.x - corner.x, p.y - corner.y) < Math.hypot(best.x - corner.x, best.y - corner.y)) best = p;
    const dir = corner.x < arena.x + arena.w / 2 ? 1 : -1;
    ctx.strokeStyle = chalk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(best.x, best.y, 18, dir > 0 ? 0 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI);
    ctx.stroke();
    ctx.fillStyle = rgba('#000000', 0.18);
    ctx.beginPath();
    ctx.ellipse(best.x + 5, best.y + 4, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#f4f0e6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(best.x, best.y);
    ctx.lineTo(best.x, best.y - 34);
    ctx.stroke();
    ctx.fillStyle = C.terra;
    ctx.beginPath();
    ctx.moveTo(best.x, best.y - 34);
    ctx.lineTo(best.x + dir * 20, best.y - 28);
    ctx.lineTo(best.x, best.y - 21);
    ctx.closePath();
    ctx.fill();
  }
}

/** Frost along the boards, and a dusting of snow over the grass. */
function paintFrost(ctx: CanvasRenderingContext2D, level: Level, rng: () => number): void {
  ctx.lineJoin = 'round';
  for (const [width, alpha] of [
    [70, 0.18],
    [40, 0.28],
    [18, 0.4],
  ] as const) {
    ctx.strokeStyle = rgba('#ffffff', alpha);
    ctx.lineWidth = width;
    pitchPath(ctx, level);
    ctx.stroke();
  }
  const { arena } = level.def;
  ctx.fillStyle = rgba('#ffffff', 0.5);
  for (let i = 0; i < 260; i++) {
    ctx.beginPath();
    ctx.arc(arena.x + rng() * arena.w, arena.y + rng() * arena.h, 1 + rng() * 2, 0, TAU);
    ctx.fill();
  }
}

/** Under the floodlights: the edges fall into shade, and the pitch is brightest near the lamps. */
function paintLight(ctx: CanvasRenderingContext2D, level: Level, mood: Mood): void {
  const { arena } = level.def;
  const mx = arena.x + arena.w / 2;
  const my = arena.y + arena.h / 2;
  const shade = ctx.createRadialGradient(mx, my, 240, mx, my, 760);
  shade.addColorStop(0, 'rgba(4, 32, 10, 0)');
  shade.addColorStop(1, `rgba(4, 32, 10, ${mood.shade})`);
  ctx.fillStyle = shade;
  ctx.fillRect(arena.x - 40, arena.y - 40, arena.w + 80, arena.h + 80);
  // A pool of light from each corner tower; under a night sky the near corners are lit as well.
  const towers: [number, number][] = [
    [arena.x, arena.y],
    [arena.x + arena.w, arena.y],
  ];
  if (mood.phones) towers.push([arena.x, arena.y + arena.h], [arena.x + arena.w, arena.y + arena.h]);
  for (const [lx, ly] of towers) {
    const pool = ctx.createRadialGradient(lx, ly, 10, lx, ly, 480);
    pool.addColorStop(0, `rgba(${mood.lamp}, ${mood.pool})`);
    pool.addColorStop(1, `rgba(${mood.lamp}, 0)`);
    ctx.fillStyle = pool;
    ctx.fillRect(lx - 480, ly - 480, 960, 960);
  }
  if (mood.tint) {
    // Half the stands' wash: the pitch is under the lights, but it is still the same evening.
    ctx.fillStyle = rgba(mood.tint.color, mood.tint.alpha * 0.45);
    ctx.fillRect(arena.x - 40, arena.y - 40, arena.w + 80, arena.h + 80);
  }
}

/** The goal line. It has to read instantly, so it is always bright. */
function paintGoalLine(ctx: CanvasRenderingContext2D, level: Level): void {
  const g = level.goal;
  const y = g.lineY;
  const w = g.rightPostX - g.leftPostX;
  ctx.fillStyle = rgba(C.white, 0.95);
  ctx.fillRect(g.leftPostX, y - 3, w, 7);
  ctx.fillStyle = rgba(C.white, 0.35);
  ctx.fillRect(g.leftPostX, y + 4, w, 4);
}

/** Where the ball starts: a dashed chalk ring with a cross in it. */
function paintBallMark(ctx: CanvasRenderingContext2D, level: Level): void {
  const { x, y } = level.def.ballStart;
  ctx.strokeStyle = rgba(C.chalk, 0.7);
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 6]);
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
