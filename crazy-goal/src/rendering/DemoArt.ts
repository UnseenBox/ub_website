import type { Boost } from '../abilities/Cards';
import { clamp01, TAU } from '../core/math';
import type { Goal } from '../goal/Goal';
import type { Trace } from '../levels/sweep';
import { ABILITY_ICON } from '../ui/abilityIcons';
import { drawMagnetField, BOOST_TRAIL } from './AbilityArt';
import { C, rgba } from './Palette';

/** The ghost's two flights on the real pitch, as an ability lesson plays them. */
export interface AbilityDemo {
  boost: Boost;
  plain: Trace;
  boosted: Trace;
}

const SAMPLE = 1 / 30;
const GHOST_R = 18;
/** The longest a flight is shown for, in seconds. */
const MAX_FLIGHT = 3.6;
/** Pauses: after the grey shot fails, and on the finished shot. */
const FAIL_HOLD = 1;
const WIN_HOLD = 1.5;

const images = new Map<Boost, HTMLImageElement>();
function iconOf(boost: Boost): HTMLImageElement | null {
  let img = images.get(boost);
  if (!img) {
    img = new Image();
    img.src = ABILITY_ICON[boost];
    images.set(boost, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Where the ball was `t` seconds into a trace: x, y, height (clamped to its ends). */
function at(trace: Trace, t: number): [number, number, number] {
  const n = trace.pts.length / 3;
  const f = Math.max(0, Math.min(n - 1, t / SAMPLE));
  const i = Math.floor(f);
  const j = Math.min(n - 1, i + 1);
  const k = f - i;
  const p = trace.pts;
  return [p[i * 3] + (p[j * 3] - p[i * 3]) * k, p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * k, p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * k];
}

const lengthOf = (trace: Trace): number => Math.min(MAX_FLIGHT, Math.max(0.6, trace.seconds));

/** One full loop of the demo, in seconds. */
export const demoCycle = (demo: AbilityDemo): number => lengthOf(demo.plain) + FAIL_HOLD + lengthOf(demo.boosted) + WIN_HOLD;

/** A path drawn as far as `t`: a faint dashed line for the failed shot, a glowing one for the real one. */
function trail(ctx: CanvasRenderingContext2D, trace: Trace, t: number, color: string, glow: boolean): void {
  const upto = Math.min(trace.pts.length / 3 - 1, t / SAMPLE);
  if (upto < 1) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (): void => {
    ctx.beginPath();
    for (let i = 0; i <= Math.floor(upto); i++) {
      const x = trace.pts[i * 3];
      const y = trace.pts[i * 3 + 1] - trace.pts[i * 3 + 2];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const [ex, ey, ez] = at(trace, t);
    ctx.lineTo(ex, ey - ez);
    ctx.stroke();
  };
  if (glow) {
    ctx.strokeStyle = rgba(color, 0.35);
    ctx.lineWidth = 16;
    line();
    ctx.strokeStyle = rgba('#ffffff', 0.85);
    ctx.lineWidth = 4;
    line();
  } else {
    ctx.strokeStyle = rgba(C.ink, 0.45);
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 12]);
    line();
  }
  ctx.restore();
}

/** The ghost ball: a pale ball with a ring, tinted by the ability when it is on. */
function ghostBall(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, tint: string | null, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Its shadow stays on the ground.
  ctx.fillStyle = rgba('#000000', 0.2);
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 8, GHOST_R, GHOST_R * 0.7, 0, 0, TAU);
  ctx.fill();
  const cy = y - z;
  if (tint) {
    const glow = ctx.createRadialGradient(x, cy, GHOST_R * 0.5, x, cy, GHOST_R * 2.6);
    glow.addColorStop(0, rgba(tint, 0.55));
    glow.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, cy, GHOST_R * 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fbf7ee';
  ctx.strokeStyle = tint ?? C.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, cy, GHOST_R, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(x, cy, GHOST_R * 0.35, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A red cross in a circle: the shot that did not work. */
function failMark(ctx: CanvasRenderingContext2D, x: number, y: number, pop: number): void {
  const r = 26 * pop;
  if (r < 1) return;
  ctx.save();
  ctx.fillStyle = '#d8453b';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y - 30, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  const k = r * 0.42;
  ctx.beginPath();
  ctx.moveTo(x - k, y - 30 - k);
  ctx.lineTo(x + k, y - 30 + k);
  ctx.moveTo(x + k, y - 30 - k);
  ctx.lineTo(x - k, y - 30 + k);
  ctx.stroke();
  ctx.restore();
}

/** A green tick in a circle, with a ring of light: the shot that did. */
function winMark(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  const pop = Math.min(1, age / 0.25);
  const r = 30 * (0.6 + 0.4 * Math.sin(pop * Math.PI * 0.5));
  ctx.save();
  const ring = clamp01(age / 0.9);
  ctx.strokeStyle = rgba('#7be08a', 1 - ring);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, 20 + 70 * ring, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#2fb35a';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.36);
  ctx.lineTo(x + r * 0.5, y - r * 0.32);
  ctx.stroke();
  ctx.restore();
}

/** A burst of flame where the ball went through something. */
function flameBurst(ctx: CanvasRenderingContext2D, x: number, y: number, age: number): void {
  if (age < 0 || age > 0.9) return;
  const k = age / 0.9;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 30 + 90 * k);
  glow.addColorStop(0, rgba('#ffe27a', 0.9 * (1 - k)));
  glow.addColorStop(0.5, rgba('#e2472b', 0.6 * (1 - k)));
  glow.addColorStop(1, rgba('#e2472b', 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 30 + 90 * k, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba('#ffd27a', 1 - k);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (18 + 40 * k), y + Math.sin(a) * (18 + 40 * k));
    ctx.lineTo(x + Math.cos(a) * (30 + 78 * k), y + Math.sin(a) * (30 + 78 * k));
    ctx.stroke();
  }
  ctx.restore();
}

/** A ring that spreads out where the ball bounced. */
function bounceRing(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, color: string): void {
  if (age < 0 || age > 0.6) return;
  const k = age / 0.6;
  ctx.save();
  ctx.strokeStyle = rgba(color, 1 - k);
  ctx.lineWidth = 6 * (1 - k) + 2;
  ctx.beginPath();
  ctx.arc(x, y, 14 + 44 * k, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/**
 * The ability lesson's ghost, looped on the real pitch while the ball waits: first the shot without the ability
 * (a pale ghost that fails, with a red cross), then the same shot with it (a glowing ghost that scores, with a
 * tick), and what the ability did on the way: a flame where it burned through, the goal's pull, a ring at each
 * bounce. No words; `time` is the game clock, so the loop runs on its own.
 */
export function drawAbilityDemo(ctx: CanvasRenderingContext2D, demo: AbilityDemo, goal: Goal, time: number, strength: number): void {
  if (strength <= 0.01) return;
  const tA = lengthOf(demo.plain);
  const tB = lengthOf(demo.boosted);
  const t = time % demoCycle(demo);
  const color = BOOST_TRAIL[demo.boost];
  ctx.save();
  ctx.globalAlpha = strength;

  if (t < tA + FAIL_HOLD) {
    // The shot without the ability.
    const run = Math.min(t, tA);
    trail(ctx, demo.plain, run, C.ink, false);
    const [x, y, z] = at(demo.plain, run);
    ghostBall(ctx, x, y, z, null, 0.7);
    for (const m of demo.plain.marks) if (m.kind === 'bounce') bounceRing(ctx, m.x, m.y, run - m.t, '#8a93ad');
    if (t > tA - 0.1) failMark(ctx, x, y, Math.min(1, (t - tA + 0.1) / 0.25));
  } else {
    const run = Math.min(t - tA - FAIL_HOLD, tB);
    const done = t - tA - FAIL_HOLD >= tB;
    if (demo.boost === 'magnet') {
      // The goal's pull: the rings close in, and once the ball is inside them they grip it.
      const [gx, gy, gz] = at(demo.boosted, run);
      const gripped = demo.boosted.marks.some((m) => m.kind === 'magnet' && m.t <= run);
      drawMagnetField(ctx, goal, time, gx, gy - gz, gripped && !done);
    }
    trail(ctx, demo.boosted, run, color, true);
    const [x, y, z] = at(demo.boosted, run);
    for (const m of demo.boosted.marks) {
      if (m.kind === 'burn') flameBurst(ctx, m.x, m.y, run - m.t);
      else if (m.kind === 'bounce') bounceRing(ctx, m.x, m.y, run - m.t, demo.boost === 'rubber' ? '#8fe0b4' : '#8a93ad');
    }
    ghostBall(ctx, x, y, z, color, 1);
    // The ability's badge rides above the ghost.
    const icon = iconOf(demo.boost);
    if (icon && !done) ctx.drawImage(icon, x - 17, y - z - GHOST_R - 40, 34, 34);
    if (done && demo.boosted.scored) winMark(ctx, goal.cx, goal.lineY + 30, t - tA - FAIL_HOLD - tB);
    else if (done) failMark(ctx, x, y, 1);
  }
  ctx.restore();
}
