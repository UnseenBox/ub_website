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
  const chargeGlow = clamp01((shot.power - 0.55) / 0.45);
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1);
    const px = preview.points[i * 2];
    // A lofted dot floats above its place on the ground.
    const py = preview.points[i * 2 + 1] - preview.zs[i];
    if (chargeGlow > 0) {
      // At high power the route itself starts to glow.
      ctx.globalAlpha = (1 - f) * 0.3 * chargeGlow;
      ctx.fillStyle = full ? C.sun : C.blueLite;
      ctx.beginPath();
      ctx.arc(px, py, lerp(8.5, 3.8, f), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = lerp(0.85, 0.12, f);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(px, py, lerp(5.5, 2.2, f) * (1 + 0.25 * chargeGlow * Math.sin(time * 18 - i * 0.9)), 0, TAU);
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
  // Sparks pulling in towards the ball once the pull is serious.
  if (shot.power > 0.45) {
    const charge = clamp01((shot.power - 0.45) / 0.55);
    const inner = r + 17;
    const reach = r + 22 + 42 * charge;
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 10; i++) {
      const flick = 0.55 + 0.45 * Math.sin(time * 15 + i * 1.7);
      const a = (i / 10) * TAU + time * 0.55;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = inner + 2 * flick;
      const r1 = reach * (0.55 + 0.45 * flick);
      ctx.strokeStyle = rgba(full ? C.sun : C.blueLite, (0.12 + 0.3 * charge) * flick);
      ctx.lineWidth = 1.5 + 2.8 * charge;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ca * r0, sa * r0);
      ctx.lineTo(ca * r1, sa * r1);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (full) {
    // Three rings beating out of phase: the shot is loaded and the street knows it.
    for (let i = 0; i < 3; i++) {
      const beat = 0.5 + 0.5 * Math.sin(time * 8 - i * 1.1);
      ctx.strokeStyle = rgba(C.sun, (0.5 - i * 0.12) * (0.35 + 0.65 * beat));
      ctx.lineWidth = 3 - i * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, ringR + 8 + i * 7, 0, TAU);
      ctx.stroke();
    }
    // Six ticks around the outside, turning slowly.
    ctx.strokeStyle = rgba(C.sun, 0.9);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + time * 1.4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x + ca * (ringR + 29), y + sa * (ringR + 29));
      ctx.lineTo(x + ca * (ringR + 37), y + sa * (ringR + 37));
      ctx.stroke();
    }
  }
}

/** A looping ghost of the gesture: press, pull back, let go. Shown until the first goal. */
export function drawTutorialGhost(ctx: CanvasRenderingContext2D, ball: Ball, time: number, reach: { x: number; y: number } = { x: 46, y: 78 }): void {
  const phase = (time % 2.2) / 2.2;
  if (phase > 0.86) return;
  const pull = easeOutCubic(clamp01((phase - 0.12) / 0.45));
  const fade = phase < 0.08 ? phase / 0.08 : phase > 0.72 ? 1 - (phase - 0.72) / 0.14 : 1;
  const x = ball.body.x;
  const y = ball.body.y;
  const hx = x + reach.x * pull;
  const hy = y + reach.y * pull;
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

/**
 * The lesson's shot as a flowing line of light: bright dots running from the ball to the goal along the
 * real path (over the wall, round it, off the board), each one floating at its height, and a ring
 * pulsing where it ends. `strength` fades it while the player is aiming for themselves.
 */
export function drawGuidePath(ctx: CanvasRenderingContext2D, preview: TrajectoryPreview, time: number, strength: number): void {
  const n = preview.count;
  if (n < 2 || strength <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = preview.points[i * 2];
    const py = preview.points[i * 2 + 1] - preview.zs[i];
    // A wave of light travels along the dots, from the ball to the goal.
    const wave = Math.max(0, Math.sin(time * 7 - i * 0.55));
    const f = i / Math.max(1, n - 1);
    ctx.globalAlpha = strength * (0.28 + 0.72 * wave) * (1 - 0.35 * f);
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(px, py, 5 + 5 * wave, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const lx = preview.points[(n - 1) * 2];
  const ly = preview.points[(n - 1) * 2 + 1] - preview.zs[n - 1];
  const pulse = (time * 1.4) % 1;
  ctx.globalAlpha = strength * (1 - pulse);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(lx, ly, 14 + 34 * pulse, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = strength;
  ctx.fillStyle = C.sun;
  ctx.beginPath();
  ctx.arc(lx, ly, 8, 0, TAU);
  ctx.fill();
  ctx.restore();
}
