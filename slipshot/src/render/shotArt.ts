import type { LauncherSpec, ShotLook } from '../game/catalog';

// Projectile and launcher drawing. Everything here draws in world metres: the
// canvas is already set to a y-up transform by Camera.apply().

const OUT = '#1d2638';
const TAU = Math.PI * 2;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Darken a colour by factor f (0 = black, 1 = unchanged). */
function shade(hex: string, f: number): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/** Soft halo behind a shot. */
function halo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, k = 2.3, a = 0.42): void {
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * k);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * k, 0, TAU);
  ctx.fill();
}

/** A glossy ball: white hot spot, colour body, darker rim, outline. */
function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x - r * 0.35, y + r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.32, color);
  g.addColorStop(1, shade(color, 0.5));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y + r * 0.4, r * 0.28, r * 0.16, 0.5, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
}

export interface ShotDraw {
  look: ShotLook;
  color: string;
  r: number;
  x: number;
  y: number;
  /** Direction of travel, radians. */
  angle: number;
  time: number;
  seed: number;
  /** Seconds left on a fuse, 0 when the shot has none. */
  fuse: number;
}

/** Draw one projectile in the silhouette of its look. */
export function drawShot(ctx: CanvasRenderingContext2D, d: ShotDraw): void {
  const { x, y, r, color, time } = d;
  switch (d.look) {
    case 'orb': {
      halo(ctx, x, y, r, color);
      ball(ctx, x, y, r, color);
      return;
    }
    case 'mass': {
      halo(ctx, x, y, r, color, 2.0);
      ball(ctx, x, y, r, color);
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.15, r * 0.95, r * 0.32, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineWidth = r * 0.2;
      ctx.strokeStyle = 'rgba(20,28,40,0.4)';
      ctx.stroke();
      return;
    }
    case 'drop': {
      // A teardrop that points where it is going.
      halo(ctx, x, y, r, color, 2.2, 0.35);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.angle);
      const g = ctx.createLinearGradient(-r, 0, r * 2, 0);
      g.addColorStop(0, shade(color, 0.6));
      g.addColorStop(0.5, color);
      g.addColorStop(1, '#ffffff');
      ctx.beginPath();
      ctx.moveTo(r * 2, 0);
      ctx.bezierCurveTo(r * 1.2, r * 0.9, -r * 0.9, r * 1.0, -r * 0.9, 0);
      ctx.bezierCurveTo(-r * 0.9, -r * 1.0, r * 1.2, -r * 0.9, r * 2, 0);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = r * 0.14;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, r * 0.3, r * 0.3, r * 0.14, 0.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'balloon': {
      // Bulb, knot, and a curly string trailing below.
      const by = y + r * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.5);
      for (let i = 1; i <= 4; i++) {
        const sy = y - r * 0.5 - i * r * 0.55;
        ctx.lineTo(x + Math.sin(time * 4 + i) * r * 0.22, sy);
      }
      ctx.lineWidth = r * 0.08;
      ctx.strokeStyle = 'rgba(29,38,56,0.6)';
      ctx.stroke();
      halo(ctx, x, by, r, color, 2.2, 0.3);
      const g = ctx.createRadialGradient(x - r * 0.3, by + r * 0.35, r * 0.05, x, by, r * 1.05);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, color);
      g.addColorStop(1, shade(color, 0.6));
      ctx.beginPath();
      ctx.ellipse(x, by, r * 0.85, r * 1.05, 0, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = r * 0.12;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.18, y - r * 0.5);
      ctx.lineTo(x + r * 0.18, y - r * 0.5);
      ctx.lineTo(x, y - r * 0.2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = r * 0.08;
      ctx.stroke();
      return;
    }
    case 'spiky': {
      halo(ctx, x, y, r, color, 2.4);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + time * 0.8;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        ctx.lineTo(x + Math.cos(a) * r * 1.8, y + Math.sin(a) * r * 1.8);
        ctx.lineWidth = r * 0.24;
        ctx.lineCap = 'round';
        ctx.strokeStyle = OUT;
        ctx.stroke();
        ctx.lineWidth = r * 0.12;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      ball(ctx, x, y, r, color);
      return;
    }
    case 'streak': {
      // A long, bright bolt with a fading tail.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.angle);
      const tail = ctx.createLinearGradient(-r * 9, 0, r * 2.4, 0);
      tail.addColorStop(0, rgba(color, 0));
      tail.addColorStop(1, rgba(color, 0.7));
      ctx.beginPath();
      ctx.moveTo(-r * 9, 0);
      ctx.lineTo(r * 2.4, 0);
      ctx.lineWidth = r * 0.9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = tail;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.6, r * 0.7, 0, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = r * 0.16;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'ring': {
      // A hollow, glossy ring that spins as it bounces.
      halo(ctx, x, y, r, color, 2.1, 0.35);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.8, 0, TAU);
      ctx.lineWidth = r * 0.5;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.lineWidth = r * 0.3;
      ctx.strokeStyle = color;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, a, a + 0.6);
        ctx.lineWidth = r * 0.12;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      return;
    }
    case 'cracked': {
      halo(ctx, x, y, r, color);
      ball(ctx, x, y, r, color);
      ctx.beginPath();
      const s = d.seed;
      for (let i = 0; i < 3; i++) {
        const a = s + (i * TAU) / 3;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
      }
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      return;
    }
    case 'seeker': {
      // A ball with two fins that trail behind it.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.angle);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.2);
      ctx.lineTo(-r * 2.1, r * 1.2);
      ctx.lineTo(-r * 1.6, 0);
      ctx.lineTo(-r * 2.1, -r * 1.2);
      ctx.lineTo(-r * 0.6, -r * 0.2);
      ctx.closePath();
      ctx.fillStyle = shade(color, 0.85);
      ctx.fill();
      ctx.lineWidth = r * 0.12;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.restore();
      halo(ctx, x, y, r, color);
      ball(ctx, x, y, r, color);
      return;
    }
    case 'boomerang': {
      // A spinning crescent with a bright edge.
      halo(ctx, x, y, r, color, 2.4, 0.35);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 10);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, -2.2, 1.2);
      ctx.lineWidth = r * 1.05;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.lineWidth = r * 0.78;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, -1.9, -0.5);
      ctx.lineWidth = r * 0.18;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'bomb':
      drawBomb(ctx, x, y, r, color, time, d.fuse);
      return;
    case 'cluster': {
      drawBomb(ctx, x, y, r, color, time, d.fuse);
      for (let i = 0; i < 3; i++) {
        const a = time * 3 + (i * TAU) / 3;
        ball(ctx, x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7, r * 0.34, color);
      }
      return;
    }
  }
}

/** A dark bomb with a rim and a fuse spark that flickers. */
function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, time: number, fuse: number): void {
  halo(ctx, x, y, r, color, 2.0, 0.25);
  const g = ctx.createRadialGradient(x - r * 0.35, y + r * 0.35, r * 0.05, x, y, r);
  g.addColorStop(0, '#8a98b8');
  g.addColorStop(1, '#1d2638');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.98, 0.2, 1.6);
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = color;
  ctx.stroke();
  // Fuse and a flickering spark. The spark speeds up as the fuse runs down.
  const fx = x + r * 0.2;
  const fy = y + r * 0.95;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx + r * 0.3, fy + r * 0.6, fx + r * 0.7, fy + r * 0.5);
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = '#c8a16a';
  ctx.stroke();
  const rate = fuse > 0 ? 18 + 14 * (1 - Math.min(1, fuse / 1.4)) : 10;
  const flicker = 0.6 + 0.4 * Math.sin(time * rate);
  halo(ctx, fx + r * 0.7, fy + r * 0.5, r * 0.5, '#ffe27a', 2.2, 0.8 * flicker);
  ctx.beginPath();
  ctx.arc(fx + r * 0.7, fy + r * 0.5, r * 0.22 * flicker, 0, TAU);
  ctx.fillStyle = '#fff6c2';
  ctx.fill();
}

/** Draw a launcher from the hand, pointing along dir. Each kind has its own silhouette. */
export function drawLauncher(ctx: CanvasRenderingContext2D, spec: LauncherSpec, hand: { x: number; y: number }, dir: { x: number; y: number }): void {
  const { length: L, width: W, color, accent } = spec;
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(Math.atan2(dir.y, dir.x));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  const body = (x0: number, x1: number, h: number, fill: string, y0 = 0): void => {
    ctx.beginPath();
    ctx.roundRect(x0, y0 - h / 2, x1 - x0, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 0.022;
    ctx.stroke();
  };
  switch (spec.kind) {
    case 'hand':
      // Bare hands: the renderer draws the blob held in the palm instead.
      break;
    case 'tube':
      body(-0.12, L, W, color);
      body(L * 0.78, L * 0.9, W * 1.2, accent);
      break;
    case 'fork': {
      // Slingshot: a wooden Y with a band and a pouch.
      ctx.beginPath();
      ctx.moveTo(-0.1, 0);
      ctx.lineTo(L * 0.55, 0);
      ctx.lineWidth = W * 0.7;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(L * 0.55, 0);
      ctx.lineTo(L, W * 1.6);
      ctx.moveTo(L * 0.55, 0);
      ctx.lineTo(L, -W * 1.6);
      ctx.lineWidth = W * 0.55;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(L, W * 1.6);
      ctx.quadraticCurveTo(L * 0.7, W * 0.2, L * 0.5, 0);
      ctx.quadraticCurveTo(L * 0.7, -W * 0.2, L, -W * 1.6);
      ctx.lineWidth = 0.02;
      ctx.strokeStyle = accent;
      ctx.stroke();
      break;
    }
    case 'twin':
      body(-0.1, L, W * 0.55, color, W * 0.5);
      body(-0.1, L, W * 0.55, color, -W * 0.5);
      body(L * 0.82, L * 0.92, W * 1.3, accent, W * 0.5);
      body(L * 0.82, L * 0.92, W * 1.3, accent, -W * 0.5);
      break;
    case 'bulb':
      body(0, L, W * 0.55, color);
      ctx.beginPath();
      ctx.ellipse(-0.14, 0, W * 0.8, W * 0.72, 0, 0, TAU);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 0.022;
      ctx.stroke();
      break;
    case 'nozzle':
      body(-0.12, L * 0.5, W * 0.8, color);
      body(L * 0.48, L, W * 0.5, accent);
      for (const hy of [-W * 0.18, 0, W * 0.18]) {
        ctx.beginPath();
        ctx.arc(L * 0.98, hy, W * 0.07, 0, TAU);
        ctx.fillStyle = OUT;
        ctx.fill();
      }
      break;
    case 'scope':
      body(-0.1, L, W * 0.6, color);
      body(L * 0.18, L * 0.7, W * 0.9, accent, W * 0.95);
      ctx.beginPath();
      ctx.arc(L * 0.7, 0, W * 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(200,255,61,0.85)';
      ctx.fill();
      ctx.lineWidth = 0.02;
      ctx.stroke();
      break;
    case 'mortar':
      body(-0.1, L * 0.6, W * 0.9, color);
      ctx.beginPath();
      ctx.moveTo(L * 0.55, -W * 0.45);
      ctx.lineTo(L, -W * 0.75);
      ctx.lineTo(L, W * 0.75);
      ctx.lineTo(L * 0.55, W * 0.45);
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 0.022;
      ctx.stroke();
      break;
    case 'bow': {
      ctx.beginPath();
      ctx.arc(-0.2, 0, L * 0.85, -0.7, 0.7);
      ctx.lineWidth = W * 0.7;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-0.2, 0, L * 0.85, -0.7, 0.7);
      ctx.lineWidth = W * 0.4;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      const tipX = -0.2 + L * 0.85 * Math.cos(0.7);
      const tipY = L * 0.85 * Math.sin(0.7);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(-0.1, 0);
      ctx.lineTo(tipX, -tipY);
      ctx.lineWidth = 0.012;
      ctx.strokeStyle = accent;
      ctx.stroke();
      break;
    }
    case 'emitter':
      body(-0.1, L * 0.55, W * 0.5, color);
      ctx.beginPath();
      ctx.arc(L * 0.6, 0, W * 0.6, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = W * 0.2;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(L * 0.6, 0, W * 0.25, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      break;
    case 'tank':
      body(-0.1, L, W * 0.45, color);
      ctx.beginPath();
      ctx.roundRect(-0.2, -W * 1.25, L * 0.45, W * 1.0, W * 0.3);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 0.022;
      ctx.stroke();
      break;
    case 'barrel':
      body(-0.1, L, W, color);
      for (const bx of [L * 0.3, L * 0.62]) {
        ctx.beginPath();
        ctx.roundRect(bx, -W * 0.6, L * 0.05, W * 1.2, 0.03);
        ctx.fillStyle = accent;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(L, 0, W * 0.5, -Math.PI / 2, Math.PI / 2);
      ctx.fillStyle = OUT;
      ctx.fill();
      break;
    case 'bundle':
      for (const oy of [-W * 0.35, 0, W * 0.35]) {
        ctx.beginPath();
        ctx.moveTo(-0.05, oy * 0.5);
        ctx.lineTo(L, oy);
        ctx.lineWidth = W * 0.32;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        ctx.lineWidth = W * 0.2;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.roundRect(L * 0.1, -W * 0.6, 0.05, W * 1.2, 0.02);
      ctx.fillStyle = accent;
      ctx.fill();
      break;
  }
  ctx.restore();
}
