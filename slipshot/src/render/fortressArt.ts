import type { FortressItemId } from '../game/fortressItems';

const INK = '#1d2638';
const LINE = 0.03;
const TAU = Math.PI * 2;

export interface PieceLook {
  time: number;
  /** 0 = untouched, 1 = about to break. */
  wear: number;
  /** 0..1 white hit flash. */
  flash: number;
  /** Cannon barrel / telescope tube angle in the piece's own frame (radians, 0 = +x). */
  aim: number;
  /** Cannon recoil 0..1. */
  recoil: number;
  seed: number;
  /** Ghost drawing: no outline weight changes, used for build previews. */
  ghost?: boolean;
}

/**
 * Draw one fortress piece centred on the origin, in world units (y up). The
 * caller translates and rotates. w and h are the rotated size.
 */
export function drawPiece(ctx: CanvasRenderingContext2D, id: FortressItemId, w: number, h: number, look: PieceLook): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'brick':
      brick(ctx, w, h);
      break;
    case 'metal':
      metal(ctx, w, h);
      break;
    case 'spikes':
      spikes(ctx, w, h);
      break;
    case 'jelly':
      jelly(ctx, w, h, look);
      break;
    case 'telescope':
      telescope(ctx, w, h, look);
      break;
    case 'cannon':
      cannon(ctx, w, h, look);
      break;
    case 'duck':
      duck(ctx, w, h, look);
      break;
  }
  if (look.wear > 0.05) cracks(ctx, w, h, look.wear, look.seed);
  if (look.flash > 0) {
    ctx.globalAlpha = Math.min(1, look.flash * 4) * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function outline(ctx: CanvasRenderingContext2D, scale = 1): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE * scale;
  ctx.stroke();
}

function brick(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, h / 2, 0, -h / 2);
  g.addColorStop(0, '#f39a72');
  g.addColorStop(1, '#c4583a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 0.06);
  ctx.fill();
  outline(ctx, 1.2);
  // Mortar: a groove along the long side, and offset joints.
  ctx.strokeStyle = '#963f22';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  if (w >= h) {
    ctx.moveTo(-w / 2 + 0.06, 0);
    ctx.lineTo(w / 2 - 0.06, 0);
    ctx.moveTo(-w * 0.1, 0);
    ctx.lineTo(-w * 0.1, h / 2 - 0.05);
    ctx.moveTo(w * 0.22, 0);
    ctx.lineTo(w * 0.22, -h / 2 + 0.05);
  } else {
    ctx.moveTo(0, -h / 2 + 0.06);
    ctx.lineTo(0, h / 2 - 0.06);
    ctx.moveTo(0, h * 0.1);
    ctx.lineTo(w / 2 - 0.05, h * 0.1);
    ctx.moveTo(0, -h * 0.22);
    ctx.lineTo(-w / 2 + 0.05, -h * 0.22);
  }
  ctx.stroke();
  // Glint along the top edge.
  ctx.fillStyle = 'rgba(255, 214, 190, 0.85)';
  ctx.fillRect(-w / 2 + 0.08, h / 2 - 0.1, Math.max(0.05, w * 0.35), 0.045);
}

function metal(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vertical = h > w;
  const g = vertical ? ctx.createLinearGradient(-w / 2, 0, w / 2, 0) : ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#7d8ea3');
  g.addColorStop(0.45, '#e2ebf5');
  g.addColorStop(1, '#8798ad');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 0.03);
  ctx.fill();
  outline(ctx, 1.2);
  // Sheen stripes and rivets at both ends.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  const L = Math.max(w, h);
  for (const t of [-0.2, 0.1]) {
    if (vertical) {
      ctx.moveTo(-w / 2 + 0.03, t * L);
      ctx.lineTo(w / 2 - 0.03, t * L + 0.12);
    } else {
      ctx.moveTo(t * L, -h / 2 + 0.03);
      ctx.lineTo(t * L + 0.12, h / 2 - 0.03);
    }
  }
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (vertical) ctx.arc(0, s * (h / 2 - 0.12), 0.035, 0, TAU);
    else ctx.arc(s * (w / 2 - 0.12), 0, 0.035, 0, TAU);
    ctx.fill();
  }
}

function spikes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const baseH = h * 0.38;
  ctx.fillStyle = '#4b5a75';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, baseH, 0.04);
  ctx.fill();
  outline(ctx, 1.1);
  const n = Math.max(3, Math.round(w / 0.2));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * step;
    const g = ctx.createLinearGradient(x0, 0, x0 + step, 0);
    g.addColorStop(0, '#f4f7fb');
    g.addColorStop(1, '#9aa7b8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.01, -h / 2 + baseH);
    ctx.lineTo(x0 + step / 2, h / 2);
    ctx.lineTo(x0 + step - 0.01, -h / 2 + baseH);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 0.9);
  }
}

function jelly(ctx: CanvasRenderingContext2D, w: number, h: number, look: PieceLook): void {
  // A soft wobble, harder for a moment after a hit.
  const wob = Math.sin(look.time * 6 + look.seed) * (0.04 + 0.25 * look.flash);
  ctx.save();
  ctx.translate(0, -h / 2);
  ctx.scale(1 - wob * 0.5, 1 + wob);
  ctx.translate(0, h / 2);
  const g = ctx.createLinearGradient(0, h / 2, 0, -h / 2);
  g.addColorStop(0, 'rgba(255, 170, 230, 0.95)');
  g.addColorStop(1, 'rgba(230, 70, 180, 0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(-w / 2, h * 0.1);
  ctx.quadraticCurveTo(-w / 2, h / 2, 0, h / 2);
  ctx.quadraticCurveTo(w / 2, h / 2, w / 2, h * 0.1);
  ctx.lineTo(w / 2, -h / 2);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 1.1);
  ctx.fillStyle = 'rgba(255, 235, 250, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.22, h * 0.2, w * 0.16, h * 0.12, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 235, 250, 0.55)';
  for (const [bx, by, br] of [
    [w * 0.18, -h * 0.05, 0.05],
    [w * 0.3, h * 0.15, 0.035],
    [-w * 0.05, -h * 0.2, 0.03],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by + 0.02 * Math.sin(look.time * 2 + bx * 10), br, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function telescope(ctx: CanvasRenderingContext2D, w: number, h: number, look: PieceLook): void {
  // Tripod.
  const hub = { x: 0, y: h * 0.1 };
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(hub.x, hub.y);
  ctx.lineTo(-w / 2 + 0.04, -h / 2);
  ctx.moveTo(hub.x, hub.y);
  ctx.lineTo(w / 2 - 0.04, -h / 2);
  ctx.moveTo(hub.x, hub.y);
  ctx.lineTo(0, -h / 2);
  ctx.stroke();
  // Tube, sweeping slowly across the enemy side.
  ctx.save();
  ctx.translate(hub.x, hub.y + 0.06);
  ctx.rotate(look.aim);
  ctx.fillStyle = '#7a6cff';
  ctx.beginPath();
  ctx.roundRect(-0.32, -0.09, 0.62, 0.18, 0.06);
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#b7aeff';
  ctx.beginPath();
  ctx.roundRect(0.26, -0.12, 0.14, 0.24, 0.05);
  ctx.fill();
  outline(ctx);
  // Lens glint that twinkles.
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(look.time * 4 + look.seed);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0.36, 0.04, 0.035, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function cannon(ctx: CanvasRenderingContext2D, w: number, h: number, look: PieceLook): void {
  const pivot = { x: 0, y: h * 0.12 };
  // Barrel first, so the carriage sits in front of it.
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(look.aim);
  ctx.translate(-0.14 * look.recoil, 0);
  const g = ctx.createLinearGradient(0, -0.13, 0, 0.13);
  g.addColorStop(0, '#8a9bb8');
  g.addColorStop(1, '#3d4a63');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-0.15, -0.13, 0.62, 0.26, 0.1);
  ctx.fill();
  outline(ctx, 1.1);
  ctx.fillStyle = '#2a3346';
  ctx.beginPath();
  ctx.roundRect(0.4, -0.16, 0.12, 0.32, 0.05);
  ctx.fill();
  outline(ctx);
  ctx.restore();
  // Carriage and wheel.
  ctx.fillStyle = '#8a5a2b';
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 0.06, -h / 2 + 0.1);
  ctx.lineTo(w / 2 - 0.1, -h / 2 + 0.1);
  ctx.lineTo(w * 0.1, pivot.y + 0.06);
  ctx.lineTo(-w * 0.25, pivot.y + 0.06);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  const wr = h * 0.3;
  ctx.fillStyle = '#6b4424';
  ctx.beginPath();
  ctx.arc(-w * 0.12, -h / 2 + wr, wr, 0, TAU);
  ctx.fill();
  outline(ctx);
  ctx.strokeStyle = '#3b2a1a';
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.moveTo(-w * 0.12 + Math.cos(a) * wr * 0.85, -h / 2 + wr + Math.sin(a) * wr * 0.85);
    ctx.lineTo(-w * 0.12 - Math.cos(a) * wr * 0.85, -h / 2 + wr - Math.sin(a) * wr * 0.85);
  }
  ctx.stroke();
}

function duck(ctx: CanvasRenderingContext2D, w: number, h: number, look: PieceLook): void {
  // A happy bob, and a squeeze for a moment after a hit.
  const bob = Math.sin(look.time * 3 + look.seed) * 0.03;
  const squeeze = 1 - 0.25 * look.flash;
  ctx.save();
  ctx.translate(0, -h / 2);
  ctx.scale(1 + (1 - squeeze) * 0.6, squeeze);
  ctx.translate(0, h / 2 + bob);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, -h * 0.18, w * 0.46, h * 0.3, 0, 0, TAU);
  ctx.fill();
  outline(ctx);
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.22, h * 0.22, 0, TAU);
  ctx.fill();
  outline(ctx);
  // Beak.
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h * 0.24);
  ctx.quadraticCurveTo(w * 0.55, h * 0.22, w * 0.5, h * 0.12);
  ctx.quadraticCurveTo(w * 0.4, h * 0.1, w * 0.32, h * 0.15);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.9);
  // Eye and wing.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(w * 0.2, h * 0.28, 0.035, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.21, h * 0.295, 0.012, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#e0a800';
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.12);
  ctx.quadraticCurveTo(-w * 0.12, -h * 0.02, 0, -h * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** Cracks that spread as the piece wears down. Deterministic from the seed, so they do not flicker. */
function cracks(ctx: CanvasRenderingContext2D, w: number, h: number, wear: number, seed: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, wear * 1.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.025;
  const lines = wear > 0.6 ? 3 : wear > 0.3 ? 2 : 1;
  for (let i = 0; i < lines; i++) {
    const r1 = frac(Math.sin(seed * 12.9 + i * 7.1) * 4375.5);
    const r2 = frac(Math.sin(seed * 78.2 + i * 3.7) * 4375.5);
    let x = (r1 - 0.5) * w * 0.7;
    let y = h / 2 - 0.02;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (frac(r2 * (k + 3) * 9.7) - 0.5) * w * 0.3;
      y -= h * 0.25 * wear + 0.05;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function frac(v: number): number {
  return v - Math.floor(v);
}
