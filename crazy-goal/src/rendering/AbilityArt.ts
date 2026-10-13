import type { Boost } from '../abilities/Cards';
import type { Ball } from '../ball/Ball';
import { TAU } from '../core/math';
import type { Goal } from '../goal/Goal';
import { BOOST_TUNING } from '../levels/Level';
import type { ArenaDef } from '../levels/LevelDefinition';
import { C, rgba } from './Palette';

const FIRE = ['#e2472b', C.orange, C.sun] as const;
export const RUBBER_GREEN = '#2f9a63';

/** What the dust behind the ball looks like under each boost. */
export const BOOST_TRAIL: Readonly<Record<Boost, string>> = {
  fire: C.orange,
  magnet: C.blueLite,
  rubber: '#8fe0b4',
};

/** A cheap repeatable 0 to 1 number from an index, so smoke and bolts need no stored state. */
const frac = (n: number): number => n - Math.floor(n);
const noise = (i: number, salt: number): number => frac(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

/** One tongue of flame: a circle at the ball with a tail curling away from it. */
function tongue(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, radius: number, length: number, sway: number, color: string): void {
  const px = -dy;
  const py = dx;
  const tx = x + dx * length + px * sway;
  const ty = y + dy * length + py * sway;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + px * radius, y + py * radius);
  ctx.quadraticCurveTo(x + dx * length * 0.45 + px * (radius + sway * 0.4), y + dy * length * 0.45 + py * (radius + sway * 0.4), tx, ty);
  ctx.quadraticCurveTo(x + dx * length * 0.45 - px * (radius - sway * 0.4), y + dy * length * 0.45 - py * (radius - sway * 0.4), x - px * radius, y - py * radius);
  ctx.closePath();
  ctx.fill();
}

/** Drawn before the ball: whatever a boost puts behind or under it. */
export function drawBoostUnder(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number, boost: Boost, time: number): void {
  const r = ball.radius;
  if (boost === 'fire') {
    // Flames stream out behind a moving ball and stand straight up from a waiting one.
    const speed = ball.speed;
    let dx = 0;
    let dy = -1;
    if (speed > 60) {
      dx = -ball.body.vx / speed;
      dy = -ball.body.vy / speed;
    }
    const reach = r * (2.1 + Math.min(2.2, speed / 520));
    FIRE.forEach((color, i) => {
      const flicker = 0.82 + 0.18 * Math.sin(time * (23 + i * 7) + i * 2);
      const sway = Math.sin(time * (17 + i * 5) + i) * r * 0.45;
      tongue(ctx, x, y, dx, dy, r * (1.28 - i * 0.23), reach * (1 - i * 0.24) * flicker, sway, color);
    });
  } else if (boost === 'magnet') {
    ctx.strokeStyle = rgba(C.blueLite, 0.75);
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(x, y, r + 9, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  } else {
    // Rubber: the ball sits in a springy green ring that breathes.
    const pulse = 1 + Math.sin(time * 9) * 0.08;
    ctx.fillStyle = rgba(RUBBER_GREEN, 0.3);
    ctx.beginPath();
    ctx.arc(x, y, (r + 10) * pulse, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = RUBBER_GREEN;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, (r + 6) * pulse, 0, TAU);
    ctx.stroke();
  }
}

/** Drawn over the ball: the tint that says which boost it is carrying. */
export function drawBoostOver(ctx: CanvasRenderingContext2D, ball: Ball, x: number, y: number, boost: Boost, time: number): void {
  const r = ball.radius;
  const color = boost === 'fire' ? FIRE[0] : boost === 'magnet' ? C.blue : RUBBER_GREEN;
  ctx.fillStyle = rgba(color, boost === 'fire' ? 0.42 + 0.1 * Math.sin(time * 26) : 0.26);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/**
 * The magnet at work, on the ground in front of the goal: rings closing in on the mouth,
 * and, once it has hold of the ball, a crackle from each post.
 */
export function drawMagnetField(ctx: CanvasRenderingContext2D, goal: Goal, time: number, bx: number, by: number, gripping: boolean): void {
  const range = BOOST_TUNING.magnetRange;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const f = frac(time * 0.55 + i / 3);
    ctx.strokeStyle = rgba(gripping ? C.sun : C.blueLite, Math.sin(f * Math.PI) * (gripping ? 0.8 : 0.5));
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    // The lower half of a circle: the part that lies on the street.
    ctx.arc(goal.cx, goal.lineY, range * (1 - f) + 24, 0.04, Math.PI - 0.04);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!gripping) return;

  // Bolts are redrawn in a new shape thirty times a second, which is what makes them crackle.
  const tick = Math.floor(time * 30);
  ctx.lineJoin = 'round';
  [goal.leftPostX, goal.rightPostX].forEach((px, side) => {
    const py = goal.postY;
    const len = Math.hypot(bx - px, by - py) || 1;
    const nx = -(by - py) / len;
    const ny = (bx - px) / len;
    for (const [width, color] of [[7, rgba(C.blue, 0.55)], [3, C.white]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 1; k < 6; k++) {
        const jitter = (noise(tick + k * 3, side + 1) - 0.5) * Math.min(46, len * 0.18);
        ctx.lineTo(px + ((bx - px) * k) / 6 + nx * jitter, py + ((by - py) * k) / 6 + ny * jitter);
      }
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  });
}

/** The black patch left where something burnt. */
export function drawScorch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = rgba(C.navy, 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.56 + 8, h * 0.56 + 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba('#000000', 0.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.4, h * 0.4, 0, 0, TAU);
  ctx.fill();
  // A few embers still glowing in it.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? C.orange : C.sun;
    ctx.beginPath();
    ctx.arc((noise(i, 3) - 0.5) * w * 0.6, (noise(i, 7) - 0.5) * h * 0.6, 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const SMOKE = ['#f3efe8', '#e1dcd8', '#cfcacc'] as const;
const PUFFS = 38;

/**
 * Smoke over the middle of the street: thick enough at `amount` 1 to hide what stands there.
 * As the amount falls the puffs swell and lift, so it reads as being blown away, not faded.
 */
export function drawSmoke(ctx: CanvasRenderingContext2D, arena: ArenaDef, amount: number, time: number): void {
  if (amount <= 0.01) return;
  const top = arena.y + 110;
  const height = 620;
  const lift = (1 - amount) * 150;
  const swell = 1 + (1 - amount) * 0.55;
  for (let i = 0; i < PUFFS; i++) {
    // Rows from the back of the street to the front, so nearer puffs overlap further ones.
    const row = Math.floor((i / PUFFS) * 6);
    const x = arena.x + noise(i, 1) * arena.w + Math.sin(time * 0.45 + i) * 28;
    const y = top + ((row + noise(i, 2)) / 6) * height + Math.cos(time * 0.37 + i * 1.7) * 12 - lift;
    const r = (74 + noise(i, 5) * 56) * swell;
    ctx.fillStyle = rgba(SMOKE[i % 3], amount * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(SMOKE[i % 3], Math.min(1, amount * 1.15) * 0.96);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}
