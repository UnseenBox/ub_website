import { TAU, clamp01 } from '../core/Mathx';
import type { CursorController } from '../cursor/CursorController';
import type { CursorDecoy } from '../cursor/CursorDecoy';
import { PALETTE, circle, halo, withAlpha, type Ctx } from './DrawUtils';

export interface CursorStyle {
  highContrast: boolean;
  reducedEffects: boolean;
}

/**
 * Simple aim reticle for side-view: a crosshair that follows the mouse.
 * It pulses with room heat and tremors near death.
 */
export function drawCursor(ctx: Ctx, cursor: CursorController, style: CursorStyle): void {
  const heat = clamp01(cursor.displayHeat);
  const color = heat > 0.72 ? PALETTE.alarm : heat > 0.3 ? PALETTE.warm : PALETTE.eye;
  const pulse = 0.5 + 0.5 * Math.sin(cursor.pulse);

  // Tremor near death
  const tremor = style.reducedEffects ? 0 : cursor.tremor;
  const jx = tremor * (Math.random() - 0.5) * 2.6;
  const jy = tremor * (Math.random() - 0.5) * 2.6;

  const x = cursor.x + jx;
  const y = cursor.y + jy;

  if (!style.reducedEffects) {
    halo(ctx, x, y, 22 + heat * 28 + pulse * heat * 10, color, 0.08 + heat * 0.18);
  }

  ctx.save();
  ctx.translate(x, y);

  // Crosshair: four arms with heat-dependent length
  const arm = 8 + heat * 14;
  const gap = 4 + heat * 3;
  const thick = style.highContrast ? 2.2 : 1.6;

  ctx.strokeStyle = withAlpha(color, 0.9);
  ctx.lineWidth = thick;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Up
  ctx.moveTo(0, -gap);
  ctx.lineTo(0, -gap - arm);
  // Down
  ctx.moveTo(0, gap);
  ctx.lineTo(0, gap + arm);
  // Left
  ctx.moveTo(-gap, 0);
  ctx.lineTo(-gap - arm, 0);
  // Right
  ctx.moveTo(gap, 0);
  ctx.lineTo(gap + arm, 0);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = withAlpha(color, 0.95);
  circle(ctx, 0, 0, 2 + heat * 1.8);
  ctx.fill();

  // Outer ring dilating with heat
  const ringR = 6 + heat * 4 + pulse * (0.6 + heat * 1.8);
  ctx.strokeStyle = withAlpha(color, 0.75);
  ctx.lineWidth = style.highContrast ? 2 : 1.2;
  circle(ctx, 0, 0, ringR);
  ctx.stroke();

  // High contrast outline
  if (style.highContrast) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.8;
    circle(ctx, 0, 0, ringR + 2);
    ctx.stroke();
  }

  // Fracture marks at high danger
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

/**
 * A machine echo decoy (projector, terminal, mirror shard).
 * Reads as slightly hollow/cold so a careful player can tell.
 */
export function drawDecoy(ctx: Ctx, decoy: CursorDecoy, time: number): void {
  const convincing = decoy.sourceId !== null && decoy.sourceId.startsWith('enemy-');
  const color = convincing ? PALETTE.eye : PALETTE.cold;
  const fade = decoy.fade;
  if (fade <= 0.01) return;

  const angle = Math.atan2(decoy.headingY, decoy.headingX);
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + decoy.age * 3);

  halo(ctx, decoy.x, decoy.y, 18 + pulse * 6, color, 0.08 * fade);

  ctx.save();
  ctx.translate(decoy.x, decoy.y);
  ctx.globalAlpha = fade * (convincing ? 0.9 : 0.7);

  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-3, -2.5);
  ctx.lineTo(-1.2, 0);
  ctx.lineTo(-3, 2.5);
  ctx.closePath();
  if (convincing) {
    ctx.fillStyle = withAlpha(color, 0.85);
    ctx.fill();
  } else {
    ctx.strokeStyle = withAlpha(color, 0.75);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(color, 0.65);
  ctx.lineWidth = 1;
  circle(ctx, 0, 0, 5 + pulse * 0.6);
  ctx.stroke();

  if (convincing) {
    ctx.fillStyle = withAlpha(color, 0.85);
    circle(ctx, 0, 0, 1.4);
    ctx.fill();
  }

  if (decoy.clickedThisStep) {
    ctx.strokeStyle = withAlpha(color, 0.5);
    circle(ctx, 0, 0, 11);
    ctx.stroke();
  }

  ctx.restore();
}

/** The "mouse required" state — not used in side-view, kept for compat. */
export function drawLostCursor(ctx: Ctx, x: number, y: number, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = withAlpha(PALETTE.fogDim, 0.3 + pulse * 0.2);
  ctx.lineWidth = 1.2;
  circle(ctx, x, y, 7 + pulse * 2);
  ctx.stroke();
  ctx.restore();
}