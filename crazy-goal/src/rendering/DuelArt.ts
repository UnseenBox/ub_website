import { rtl } from '../core/i18n';
import { roundRect } from './DrawUtils';
import { C, FONT, rgba } from './Palette';

/** A small coloured label with a pointer under it, for naming things in the world. */
export function drawTag(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color: string, bob = 0): void {
  ctx.font = `900 13px ${FONT}`;
  ctx.letterSpacing = rtl ? '0px' : '1.5px';
  const w = ctx.measureText(label).width + 22;
  const h = 26;
  const top = y - h - 8 + bob;
  roundRect(ctx, x - w / 2 + 3, top + 4, w, h, 8);
  ctx.fillStyle = rgba(C.shadow, 0.3);
  ctx.fill();
  roundRect(ctx, x - w / 2, top, w, h, 8);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7, top + h - 1);
  ctx.lineTo(x + 7, top + h - 1);
  ctx.lineTo(x, top + h + 8);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.white;
  ctx.fillText(label, x + 0.75, top + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0px';
}
