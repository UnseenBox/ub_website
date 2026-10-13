import type { Ball } from '../ball/Ball';
import type { BallTrail } from '../ball/BallTrail';
import { clamp, easeOutBack, TAU } from '../core/math';
import { C, rgba, SHADOW_ALPHA } from './Palette';

/** Angular radius of a pentagon patch, in radians. */
const PATCH = 0.4;
const FIFTH = TAU / 5;

export function drawBallShadow(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number): void {
  const r = ball.radius * easeOutBack(ball.spawn);
  if (r <= 0) return;
  ctx.fillStyle = rgba(C.shadow, SHADOW_ALPHA + 0.06);
  ctx.beginPath();
  ctx.ellipse(x + 9, y + 9, r * 1.02, r * 0.8, 0, 0, TAU);
  ctx.fill();
}

/** Dust kicked up behind a fast ball: a pale ribbon, widest and strongest at the ball. */
export function drawTrail(ctx: CanvasRenderingContext2D, trail: BallTrail, radius: number, color: string = C.white): void {
  if (trail.count < 2) return;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (let i = 1; i < trail.count; i++) {
    const a = trail.index(i - 1);
    const b = trail.index(i);
    const f = i / (trail.count - 1);
    const strength = trail.strength[b];
    if (strength <= 0.01) continue;
    ctx.globalAlpha = f * f * 0.5 * strength;
    ctx.lineWidth = radius * (0.25 + 1.45 * f);
    ctx.beginPath();
    ctx.moveTo(trail.xs[a], trail.ys[a]);
    ctx.lineTo(trail.xs[b], trail.ys[b]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * The football. Its twelve pentagons live on a sphere that really rotates as the ball rolls,
 * so the pattern slides across the face and foreshortens at the edge.
 */
export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number, patch: string = C.ink, base: string = C.bone): void {
  const pop = easeOutBack(ball.spawn);
  if (pop <= 0) return;
  const r = ball.radius;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);

  // Squash against whatever it hit, plus a slight stretch along the direction of travel.
  const speed = ball.speed;
  let k = ball.squash;
  let angle = ball.squashAngle;
  if (Math.abs(k) < 0.02 && speed > 300) {
    k = clamp((speed - 300) / 2200, 0, 1) * 0.13;
    angle = Math.atan2(ball.body.vy, ball.body.vx);
  }
  ctx.rotate(angle);
  ctx.scale(1 + k, 1 - k * 0.75);
  ctx.rotate(-angle);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  ctx.clip();
  // In a duel the pentagons are painted in the shooter's colour.
  ctx.fillStyle = patch;
  const p = ball.patches;
  const sinP = Math.sin(PATCH);
  const cosP = Math.cos(PATCH);
  for (let i = 0; i < p.length; i += 6) {
    const cz = p[i + 2];
    // Patches well round the back cannot show any corner.
    if (cz > sinP) continue;
    const cx = p[i];
    const cy = p[i + 1];
    const ux = p[i + 3];
    const uy = p[i + 4];
    const uz = p[i + 5];
    // Second tangent: centre cross first tangent.
    const wx = cy * uz - cz * uy;
    const wy = cz * ux - cx * uz;
    const wz = cx * uy - cy * ux;
    ctx.beginPath();
    for (let v = 0; v < 5; v++) {
      const ca = Math.cos(v * FIFTH) * sinP;
      const sa = Math.sin(v * FIFTH) * sinP;
      let px = cx * cosP + ux * ca + wx * sa;
      let py = cy * cosP + uy * ca + wy * sa;
      const pz = cz * cosP + uz * ca + wz * sa;
      if (pz > 0) {
        // A corner behind the horizon is pinned to the rim so the patch does not fold over.
        const len = Math.hypot(px, py) || 1;
        px /= len;
        py /= len;
      }
      if (v === 0) ctx.moveTo(px * r, py * r);
      else ctx.lineTo(px * r, py * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Form shading: lit from the upper left.
  const shade = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.2, 0, 0, r * 1.15);
  shade.addColorStop(0, rgba(C.white, 0.18));
  shade.addColorStop(0.55, rgba(C.ink, 0));
  shade.addColorStop(1, rgba(C.ink, 0.42));
  ctx.fillStyle = shade;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = rgba(C.white, 0.9);
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.46, r * 0.24, r * 0.13, -0.7, 0, TAU);
  ctx.fill();

  ctx.restore();
}
