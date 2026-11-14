import { rtl, tr } from '../core/i18n';
import { FONT } from './Palette';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export interface TextStyle {
  size: number;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number;
  /** Extra space between letters, in world units. */
  spacing?: number;
  alpha?: number;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, s: TextStyle): void {
  ctx.font = `${s.weight ?? 900} ${s.size}px ${FONT}`;
  ctx.textAlign = s.align ?? 'left';
  ctx.textBaseline = s.baseline ?? 'alphabetic';
  // Spacing letters apart breaks Arabic, whose letters join.
  // Lilita One is set close: the spacing callers ask for is scaled down to suit it.
  ctx.letterSpacing = `${rtl ? 0 : (s.spacing ?? 0) * 0.35}px`;
  ctx.fillStyle = s.color;
  if (s.alpha !== undefined) ctx.globalAlpha = s.alpha;
  ctx.fillText(tr(str), x, y);
  if (s.alpha !== undefined) ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';
}

/**
 * Sign-painter lettering: flat colour with a hard offset shadow, no outline.
 * Caller sets font, alignment and any transform first.
 */
export function signText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, fill: string, shadow: string, depth: number, under?: string): void {
  str = tr(str);
  if (under) {
    ctx.fillStyle = under;
    ctx.fillText(str, x + depth * 1.9, y + depth * 1.9);
  }
  ctx.fillStyle = shadow;
  for (let d = depth; d >= 1; d -= 1.5) ctx.fillText(str, x + d, y + d);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

export const formatScore = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Greedy word wrap. Uses the font currently set on the context. */
export function wrapText(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
