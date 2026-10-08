import { TAU, clamp01 } from '../core/Mathx';
import type { CursorController } from '../cursor/CursorController';
import type { CursorDecoy } from '../cursor/CursorDecoy';
import type { CursorStateName } from '../cursor/CursorState';
import { PALETTE, circle, halo, withAlpha, type Ctx } from './DrawUtils';

const STATE_COLOR: Record<CursorStateName, string> = {
  NORMAL: PALETTE.eye,
  EXPOSED: '#b6f0dd',
  SUSPICIOUS: PALETTE.warm,
  DETECTED: '#ff9a5a',
  PANICKING: PALETTE.alarm,
};

export interface CursorStyle {
  highContrast: boolean;
  reducedEffects: boolean;
}

/**
 * The cursor is the main character, so it gets the most expressive drawing in the
 * game: an eye wearing a pointer. It stretches the way it is travelling, its
 * aperture widens as something notices it, and it loses its nerve before you do.
 */
export function drawCursor(ctx: Ctx, cursor: CursorController, style: CursorStyle): void {
  const d = cursor.sensor.data;
  const heat = clamp01(cursor.displayHeat);
  const color = STATE_COLOR[cursor.state];
  const pulse = 0.5 + 0.5 * Math.sin(cursor.pulse);

  // Tremor: only at the very top of the danger curve, and never enough to make
  // the cursor untrustworthy to aim with.
  const tremor = style.reducedEffects ? 0 : cursor.tremor;
  const jx = tremor * (Math.random() - 0.5) * 2.6;
  const jy = tremor * (Math.random() - 0.5) * 2.6;

  drawTrail(ctx, cursor, color, style);

  const x = d.x + jx;
  const y = d.y + jy;
  const stretch = 1 + clamp01(d.speed / 1400) * 1.3;
  const angle = Math.atan2(d.headingY, d.headingX);

  if (!style.reducedEffects) {
    halo(ctx, x, y, 26 + heat * 34 + pulse * heat * 12, color, 0.1 + heat * 0.22);
  }

  ctx.save();
  ctx.translate(x, y);

  // The pointer: a needle laid along the direction of travel. This is the part
  // that makes "pointing at it" legible as an act.
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = withAlpha(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(13 * stretch, 0);
  ctx.lineTo(-3, -3.2);
  ctx.lineTo(-1.4, 0);
  ctx.lineTo(-3, 3.2);
  ctx.closePath();
  ctx.fill();
  if (style.highContrast) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();

  // The eye: a ring whose aperture opens as awareness climbs.
  const ringR = 6.4 + heat * 2.2 + pulse * (0.4 + heat * 1.6);
  ctx.strokeStyle = withAlpha(color, 0.85);
  ctx.lineWidth = style.highContrast ? 2 : 1.4;
  circle(ctx, 0, 0, ringR);
  ctx.stroke();

  if (style.highContrast) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    circle(ctx, 0, 0, ringR + 2.2);
    ctx.stroke();
  }

  // Pupil, which dilates with danger.
  ctx.fillStyle = withAlpha(color, 0.95);
  circle(ctx, 0, 0, 1.5 + heat * 2.1);
  ctx.fill();

  // Fracture marks at the edge of being caught.
  if (heat > 0.8 && !style.reducedEffects) {
    const a = (heat - 0.8) / 0.2;
    ctx.strokeStyle = withAlpha(PALETTE.alarm, a * 0.8);
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * TAU + cursor.pulse * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * (ringR + 2), Math.sin(ang) * (ringR + 2));
      ctx.lineTo(Math.cos(ang) * (ringR + 5 + a * 4), Math.sin(ang) * (ringR + 5 + a * 4));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTrail(ctx: Ctx, cursor: CursorController, color: string, style: CursorStyle): void {
  const points = cursor.trail.all;
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const life = b.life;
    const alpha = life * life * (style.highContrast ? 0.4 : 0.26);
    if (alpha < 0.01) continue;
    ctx.strokeStyle = withAlpha(color, alpha);
    ctx.lineWidth = 0.7 + life * 2.1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A fake cursor.
 *
 * Ones thrown by the room read as slightly hollow and cold, so a careful player
 * can tell. The ones a Mimic makes do not, and that is the point of the Mimic.
 */
export function drawDecoy(ctx: Ctx, decoy: CursorDecoy, time: number): void {
  const convincing = decoy.sourceId !== null && decoy.sourceId.startsWith('enemy-');
  const color = convincing ? PALETTE.eye : PALETTE.cold;
  const fade = decoy.fade;
  if (fade <= 0.01) return;

  const angle = Math.atan2(decoy.headingY, decoy.headingX);
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + decoy.age * 3);

  halo(ctx, decoy.x, decoy.y, 20 + pulse * 8, color, 0.1 * fade);

  ctx.save();
  ctx.translate(decoy.x, decoy.y);
  ctx.globalAlpha = fade * (convincing ? 0.95 : 0.78);

  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-3, -3);
  ctx.lineTo(-1.3, 0);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  if (convincing) {
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fill();
  } else {
    ctx.strokeStyle = withAlpha(color, 0.85);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(color, 0.75);
  ctx.lineWidth = 1.2;
  circle(ctx, 0, 0, 6 + pulse * 0.8);
  ctx.stroke();

  if (convincing) {
    ctx.fillStyle = withAlpha(color, 0.9);
    circle(ctx, 0, 0, 1.6);
    ctx.fill();
  }

  if (decoy.clickedThisStep) {
    ctx.strokeStyle = withAlpha(color, 0.6);
    circle(ctx, 0, 0, 13);
    ctx.stroke();
  }

  ctx.restore();
}

/** The "mouse required" state. Shows exactly where attention was abandoned. */
export function drawLostCursor(ctx: Ctx, x: number, y: number, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = withAlpha(PALETTE.fogDim, 0.4 + pulse * 0.3);
  ctx.lineWidth = 1.2;
  circle(ctx, x, y, 9 + pulse * 3);
  ctx.stroke();
  ctx.restore();
}
