import type { Ball } from '../ball/Ball';
import { SHOT_TUNING, type ShotController } from '../ball/ShotController';
import type { TrajectoryPreview } from '../ball/TrajectoryPreview';
import { clamp01, easeOutCubic, lerp, TAU } from '../core/math';
import { C, rgba } from './Palette';

/** How far the ball itself leans back as the pull tightens. */
const BALL_GIVE = 9;

/** Where the ball is drawn while aiming: eased back along the pull, trembling at full power. */
export function aimOffset(shot: ShotController, time: number, out: { x: number; y: number }): void {
  if (!shot.aiming || !shot.armed) {
    out.x = 0;
    out.y = 0;
    return;
  }
  const k = shot.power * BALL_GIVE;
  const tremble = shot.power > 0.97 ? 1.3 : 0;
  out.x = -shot.dirX * k + Math.sin(time * 95) * tremble;
  out.y = -shot.dirY * k + Math.cos(time * 83) * tremble;
}

/** The elastic and its handle. Sits on the ground, under the ball. */
export function drawAimGround(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number, shot: ShotController): void {
  const hx = ball.body.x + shot.pullX;
  const hy = ball.body.y + shot.pullY;
  if (shot.armed) {
    // A band that thins as it stretches: wide at the ball, a point at the handle.
    const nx = -shot.dirY;
    const ny = shot.dirX;
    const half = ball.radius * lerp(0.85, 0.5, shot.power);
    ctx.beginPath();
    ctx.moveTo(x + nx * half, y + ny * half);
    ctx.lineTo(hx + nx * 3, hy + ny * 3);
    ctx.lineTo(hx - nx * 3, hy - ny * 3);
    ctx.lineTo(x - nx * half, y - ny * half);
    ctx.closePath();
    ctx.fillStyle = rgba(C.ink, 0.2 + 0.14 * shot.power);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(hx, hy, 11, 0, TAU);
  ctx.fillStyle = rgba(C.white, 0.85);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx, hy, 3.5, 0, TAU);
  ctx.fillStyle = shot.armed ? C.blue : C.ink;
  ctx.fill();
}

/** Trajectory dots, the first-touch marker, the direction arrow and the power ring. */
export function drawAimOver(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number, shot: ShotController, preview: TrajectoryPreview, time: number): void {
  if (!shot.armed) return;
  const r = ball.radius;
  const full = shot.power >= 0.995;

  // Dots are evenly spaced in time, so wider gaps mean a faster ball.
  const n = preview.count;
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1);
    ctx.globalAlpha = lerp(0.85, 0.12, f);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(preview.points[i * 2], preview.points[i * 2 + 1], lerp(5.5, 2.2, f), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (preview.hasHit) {
    // Ghost of the ball at its first touch, with a tick showing which way the surface faces.
    ctx.strokeStyle = rgba(C.ink, 0.55);
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(preview.hitX, preview.hitY, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.blue;
    ctx.beginPath();
    ctx.arc(preview.hitX - preview.hitNx * r, preview.hitY - preview.hitNy * r, 4.5, 0, TAU);
    ctx.fill();
  }

  // Arrow: grows with power.
  const len = 30 + 78 * shot.power;
  const start = r + 13;
  const head = 21;
  const halfShaft = 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(shot.dirY, shot.dirX));
  ctx.beginPath();
  ctx.moveTo(start, -halfShaft);
  ctx.lineTo(start + len - head, -halfShaft);
  ctx.lineTo(start + len - head, -head * 0.62);
  ctx.lineTo(start + len, 0);
  ctx.lineTo(start + len - head, head * 0.62);
  ctx.lineTo(start + len - head, halfShaft);
  ctx.lineTo(start, halfShaft);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = full ? C.sun : C.blue;
  ctx.fill();
  ctx.restore();

  // Power ring: ten segments filling clockwise from the top.
  const ringR = r + 10;
  const seg = (TAU * ringR) / SHOT_TUNING.steps;
  ctx.lineCap = 'butt';
  ctx.setLineDash([seg - 4.5, 4.5]);
  ctx.lineWidth = 6;
  ctx.strokeStyle = rgba(C.ink, 0.2);
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, TAU);
  ctx.stroke();
  const filled = shot.step / SHOT_TUNING.steps;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * filled);
  ctx.stroke();
  ctx.strokeStyle = full ? C.sun : C.blue;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * filled);
  ctx.stroke();
  ctx.setLineDash([]);
  if (full) {
    ctx.strokeStyle = rgba(C.sun, 0.5 + 0.5 * Math.sin(time * 18));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, ringR + 8, 0, TAU);
    ctx.stroke();
  }
}

/** A looping ghost of the gesture: press, pull back, let go. Shown until the first goal. */
export function drawTutorialGhost(ctx: CanvasRenderingContext2D, ball: Ball, time: number): void {
  const phase = (time % 2.2) / 2.2;
  if (phase > 0.86) return;
  const pull = easeOutCubic(clamp01((phase - 0.12) / 0.45));
  const fade = phase < 0.08 ? phase / 0.08 : phase > 0.72 ? 1 - (phase - 0.72) / 0.14 : 1;
  const x = ball.body.x;
  const y = ball.body.y;
  const hx = x + 46 * pull;
  const hy = y + 78 * pull;
  ctx.globalAlpha = fade * 0.9;

  if (pull > 0.05) {
    const len = Math.hypot(hx - x, hy - y);
    const dx = -(hx - x) / len;
    const dy = -(hy - y) / len;
    ctx.strokeStyle = rgba(C.ink, 0.35);
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Where the shot would go.
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const a = ball.radius + 12;
    const b = a + 26 + 40 * pull;
    ctx.beginPath();
    ctx.moveTo(x + dx * a, y + dy * a);
    ctx.lineTo(x + dx * b, y + dy * b);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx * b - (dx * 12 - dy * 9), y + dy * b - (dy * 12 + dx * 9));
    ctx.lineTo(x + dx * b, y + dy * b);
    ctx.lineTo(x + dx * b - (dx * 12 + dy * 9), y + dy * b - (dy * 12 - dx * 9));
    ctx.stroke();
  }

  // The "finger".
  ctx.beginPath();
  ctx.arc(hx, hy, 13, 0, TAU);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
