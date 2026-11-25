// The shared look of every screen: colours, fonts and the few parts everything is built
// from (chips, key caps, buttons, action cards, meters, rings, portraits).
// Sizes are in game pixels on the 1280×720 canvas.

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { icon, iconWidth, type IconName } from './icons';
import { portraitColours } from './messages';

export const MONO = 'Consolas, "Courier New", monospace';
export const STENCIL = 'Impact, "Arial Narrow Bold", "Arial Black", sans-serif';
export const BODY = '"Segoe UI", system-ui, sans-serif';

export const C = {
  text: 0xf1ead0,
  title: 0xe0e6c0,
  muted: 0xa29d86,
  dim: 0x77735f,
  iconTone: 0xd0c8a8,
  soft: 0xb8b298,
  /** Full-screen menu background. */
  night: 0x141510,
  hud: 0x1c1d19,
  hudLine: 0x3a3a30,
  panel: 0x181914,
  card: 0x1e2018,
  tile: 0x202219,
  raised: 0x26281e,
  chip: 0x12130f,
  line: 0x33352a,
  lineSoft: 0x3a3c30,
  lineStrong: 0x55554a,
  lineReward: 0x5a5a44,
  track: 0x2e3026,
  brass: 0xd3a948,
  gold: 0xf0cf6a,
  star: 0xf0c860,
  ok: 0x93c36c,
  green: 0xa8e090,
  health: 0x6fb04a,
  buyFill: 0x253019,
  buyLine: 0x5fae3c,
  threat: 0xc8e070,
  bad: 0xd65c3e,
  red: 0xff8a6a,
  goFill: 0x3a1f19,
  goLine: 0xc84030,
  dot: 0xd84030,
  cash: 0xcfe0a0,
} as const;

export const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

type Add = Phaser.GameObjects.GameObject;

export interface TextStyle {
  size: number;
  color?: number;
  font?: string;
  bold?: boolean;
  spacing?: number;
  wrap?: number;
  align?: 'left' | 'center' | 'right';
  /** Hard black drop shadow, for big titles over the battlefield. */
  shadow?: number;
}

/** Plain text in one of the three faces. Origin is top left unless set. */
export function text(scene: Phaser.Scene, x: number, y: number, s: string, st: TextStyle): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, s, {
    fontFamily: st.font ?? MONO,
    fontSize: `${st.size}px`,
    color: css(st.color ?? C.text),
    fontStyle: st.bold ? 'bold' : 'normal',
    align: st.align ?? 'left',
    wordWrap: st.wrap ? { width: st.wrap } : undefined,
    padding: { x: 0, y: 2 },
  });
  if (st.spacing) t.setLetterSpacing(st.spacing);
  if (st.shadow) t.setShadow(0, st.shadow, '#000000', 0, false, true);
  return t;
}

/** A flat box with an optional border; origin top left. */
export function box(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: number, line?: number, lineWidth = 2, alpha = 1,
): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(x, y, w, h, fill, alpha).setOrigin(0);
  if (line !== undefined) r.setStrokeStyle(lineWidth, line);
  return r;
}

/** A dashed border, drawn into `g`. */
export function dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, width = 2): void {
  g.lineStyle(width, color, 1);
  const dash = 7, gap = 5;
  for (let i = 0; i < w; i += dash + gap) {
    const len = Math.min(dash, w - i);
    g.lineBetween(x + i, y, x + i + len, y).lineBetween(x + i, y + h, x + i + len, y + h);
  }
  for (let i = 0; i < h; i += dash + gap) {
    const len = Math.min(dash, h - i);
    g.lineBetween(x, y + i, x, y + i + len).lineBetween(x + w, y + i, x + w, y + i + len);
  }
}

// ------------------------------------------------------------ chips

export type Tone = 'plain' | 'gold' | 'green' | 'red' | 'muted';

export const TONE: Record<Tone, number> = {
  plain: C.text, gold: C.gold, green: C.green, red: C.red, muted: C.dim,
};

export interface ChipOptions {
  icon?: IconName;
  /** Defaults to the text colour. */
  iconColor?: number;
  text?: string;
  tone?: Tone;
  /** Font size; everything else scales from it (24 is the battle size). */
  size?: number;
  /** Wave pips: `n` circles, the first `on` filled. */
  pips?: { n: number; on: number };
  dashed?: boolean;
  /** Background opacity (0.82 over the battlefield). */
  alpha?: number;
}

export interface Part {
  c: Phaser.GameObjects.Container;
  w: number;
  h: number;
}

/** An icon and a word or number on a dark plate. The container's origin is its top left. */
export function chip(scene: Phaser.Scene, o: ChipOptions): Part {
  const size = o.size ?? 22;
  const color = TONE[o.tone ?? 'plain'];
  const padX = Math.round(size * 0.62), padY = Math.round(size * 0.36), gap = Math.round(size * 0.34);
  const iconSize = Math.round(size * 1.2);
  const items: Add[] = [];
  const h = Math.max(iconSize, Math.round(size * 1.2)) + padY * 2;
  let x = padX;
  const sep = (): void => {
    if (x > padX) x += gap;
  };
  if (o.icon) {
    const w = iconWidth(o.icon, iconSize);
    items.push(icon(scene, o.icon, x + w / 2, h / 2, iconSize, o.iconColor ?? color));
    x += w;
  }
  if (o.pips) {
    sep();
    const r = Math.round(size * 0.3);
    const g = scene.add.graphics();
    for (let i = 0; i < o.pips.n; i++) {
      const cx = x + r + i * (r * 2 + 6);
      if (i < o.pips.on) g.fillStyle(color, 1).fillCircle(cx, h / 2, r);
      g.lineStyle(2, color, 1).strokeCircle(cx, h / 2, r);
    }
    items.push(g);
    x += o.pips.n * (r * 2 + 6) - 6;
  }
  if (o.text !== undefined && o.text !== '') {
    sep();
    const t = text(scene, x, h / 2, o.text, { size, color, bold: true }).setOrigin(0, 0.5);
    items.push(t);
    x += t.width;
  }
  const w = Math.ceil(x + padX);
  let plate: Add;
  if (o.dashed) {
    const g = scene.add.graphics();
    dashedRect(g, 0, 0, w, h, 0x4a4a3c, 1);
    plate = g;
  } else {
    plate = scene.add.rectangle(0, 0, w, h, C.chip, o.alpha ?? 0.82).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.14);
  }
  return { c: scene.add.container(0, 0, [plate, ...items]), w, h };
}

/** Places parts side by side from `x`, centred on `y`; returns the row's width. */
export function row(parts: Part[], x: number, y: number, gap = 8): number {
  let cx = x;
  for (const p of parts) {
    p.c.setPosition(Math.round(cx), Math.round(y - p.h / 2));
    cx += p.w + gap;
  }
  return Math.max(0, cx - x - gap);
}

/** Places parts side by side, centred on (cx, y). */
export function centreRow(parts: Part[], cx: number, y: number, gap = 8): number {
  const w = parts.reduce((s, p) => s + p.w, 0) + gap * Math.max(0, parts.length - 1);
  row(parts, cx - w / 2, y, gap);
  return w;
}

/** Places parts left to right inside `width`, wrapping; returns the height used. */
export function flowRow(parts: Part[], x: number, y: number, width: number, gap = 10): number {
  let cx = x, cy = y, line = 0;
  for (const p of parts) {
    if (cx > x && cx + p.w > x + width) {
      cx = x;
      cy += line + gap;
      line = 0;
    }
    p.c.setPosition(Math.round(cx), Math.round(cy));
    cx += p.w + gap;
    line = Math.max(line, p.h);
  }
  return cy + line - y;
}

/** A keyboard key. Origin at its top left. */
export function keycap(scene: Phaser.Scene, label: string, height = 42): Part {
  const t = text(scene, 0, 0, label, { size: Math.round(height * 0.44), bold: true }).setOrigin(0.5);
  const w = Math.max(height, Math.ceil(t.width + height * 0.5));
  const g = scene.add.graphics()
    .fillStyle(C.chip, 0.7).fillRoundedRect(0, 0, w, height, 7)
    .lineStyle(2, C.text, 1).strokeRoundedRect(1, 1, w - 2, height - 2, 7)
    .fillStyle(C.text, 1).fillRect(5, height - 7, w - 10, 5);
  t.setPosition(w / 2, height / 2 - 2);
  return { c: scene.add.container(0, 0, [g, t]), w, h: height };
}

// ------------------------------------------------------------ buttons

/** Hover and click behaviour (with sounds) for any sized game object. */
export function press(
  target: Phaser.GameObjects.Container | Phaser.GameObjects.Zone, onClick: () => void, hover?: (over: boolean) => void,
): void {
  target.on('pointerover', () => {
    hover?.(true);
    audio.play('ui_hover', { volume: 0.55 });
  });
  target.on('pointerout', () => hover?.(false));
  target.on('pointerdown', () => {
    void audio.unlock().then(() => audio.play('ui_click', { volume: 0.7 }));
    onClick();
  });
}

const lighten = (c: number): number => {
  const k = (shift: number): number => Math.min(255, ((c >> shift) & 0xff) + 18);
  return (k(16) << 16) | (k(8) << 8) | k(0);
};

export type ButtonTone = 'plain' | 'go' | 'buy' | 'brass' | 'off';

const BUTTON: Record<ButtonTone, { fill: number; line: number; ink: number }> = {
  plain: { fill: C.tile, line: C.lineStrong, ink: C.text },
  go: { fill: C.goFill, line: C.goLine, ink: C.text },
  buy: { fill: C.buyFill, line: C.buyLine, ink: C.text },
  brass: { fill: C.tile, line: C.brass, ink: C.text },
  off: { fill: 0x1a1b16, line: 0x34362c, ink: C.dim },
};

export interface ButtonOptions {
  w?: number;
  h?: number;
  label?: string;
  icon?: IconName;
  iconColor?: number;
  /** A second icon after the label (what the button leads to). */
  trail?: IconName;
  /** A small key name at the right end. */
  key?: string;
  tone?: ButtonTone;
  size?: number;
  onClick: () => void;
}

export interface Button extends Part {
  setLabel(label: string): void;
}

/** A bordered button: icon, label, optional trailing icon. The container's origin is its centre. */
export function pushButton(scene: Phaser.Scene, x: number, y: number, o: ButtonOptions): Button {
  const tone = BUTTON[o.tone ?? 'plain'];
  const h = o.h ?? 48;
  const size = o.size ?? Math.round(h * 0.46);
  const iconSize = Math.round(size * 1.1);
  const gap = Math.round(size * 0.45);
  const items: Add[] = [];
  const t = text(scene, 0, 0, o.label ?? '', { size, color: tone.ink, font: STENCIL }).setOrigin(0, 0.5);
  const lead = o.icon ? icon(scene, o.icon, 0, 0, iconSize, o.iconColor ?? tone.ink) : null;
  const trail = o.trail ? icon(scene, o.trail, 0, 0, iconSize, C.iconTone) : null;
  const leadW = o.icon ? iconWidth(o.icon, iconSize) : 0;
  const trailW = o.trail ? iconWidth(o.trail, iconSize) : 0;
  const keyT = o.key ? text(scene, 0, 0, o.key, { size: 12, color: C.muted, bold: true }).setOrigin(1, 0.5) : null;
  const content = (): number => {
    const bits = [leadW, t.text ? t.displayWidth : 0, trailW].filter((v) => v > 0);
    return bits.reduce((s, v) => s + v, 0) + gap * Math.max(0, bits.length - 1);
  };
  const w = o.w ?? Math.ceil(content() + size * 1.5 + (keyT ? keyT.width + 10 : 0));
  const bg = scene.add.rectangle(0, 0, w, h, tone.fill).setStrokeStyle(2, tone.line);
  const layout = (): void => {
    // A long label in a fixed-width button shrinks to fit.
    t.setScale(1);
    const spare = w - 24 - (leadW ? leadW + gap : 0) - (trailW ? trailW + gap : 0) - (keyT ? keyT.width + 10 : 0);
    if (o.w && t.width > spare) t.setScale(Math.max(0.5, spare / t.width));
    let cx = -content() / 2 - (keyT ? (keyT.width + 6) / 2 : 0);
    if (lead) {
      lead.x = cx + leadW / 2;
      cx += leadW + gap;
    }
    t.x = cx;
    if (t.text) cx += t.displayWidth + gap;
    if (trail) trail.x = cx + trailW / 2;
  };
  layout();
  keyT?.setPosition(w / 2 - 10, 0);
  items.push(bg, t);
  if (lead) items.push(lead);
  if (trail) items.push(trail);
  if (keyT) items.push(keyT);
  const c = scene.add.container(x, y, items).setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  press(c, o.onClick, (over) => bg.setFillStyle(over ? lighten(tone.fill) : tone.fill));
  return {
    c, w, h,
    setLabel: (label: string) => {
      t.setText(label);
      layout();
    },
  };
}

/** A big square choice: icon, name and its key. Origin at its centre. */
export function actionCard(
  scene: Phaser.Scene, x: number, y: number,
  o: { icon: IconName; label: string; key: string | null; primary?: boolean; onClick: () => void },
): Part {
  const t = text(scene, 0, 0, o.label, { size: 30, font: STENCIL }).setOrigin(0.5);
  const w = Math.max(210, Math.ceil(t.width + 60));
  const cap = o.key ? keycap(scene, o.key, 40) : null;
  const h = cap ? 184 : 134;
  const bg = scene.add.rectangle(0, 0, w, h, C.chip, 0.88).setStrokeStyle(2, o.primary ? C.health : C.lineStrong);
  const pic = icon(scene, o.icon, 0, -h / 2 + 52, 60, C.text);
  t.setPosition(0, -h / 2 + 108);
  const items: Add[] = [bg, pic, t];
  if (cap) {
    cap.c.setPosition(-cap.w / 2, h / 2 - cap.h - 12);
    items.push(cap.c);
  }
  const c = scene.add.container(x, y, items).setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  press(c, o.onClick, (over) => bg.setFillStyle(over ? 0x2a2c22 : C.chip, over ? 0.96 : 0.88));
  return { c, w, h };
}

// ------------------------------------------------------------ meters, rings, portraits

/** A flat bar filled to `frac`, drawn into `g`. */
export function meter(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, track: number = C.track,
): void {
  g.fillStyle(track, 1).fillRect(x, y, w, h);
  g.fillStyle(color, 1).fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
}

/** A progress ring of outer radius `r`, drawn into `g`. */
export function ring(
  g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, thickness: number, frac: number, color: number,
): void {
  const mid = r - thickness / 2;
  g.lineStyle(thickness, C.track, 1).strokeCircle(cx, cy, mid);
  const f = Phaser.Math.Clamp(frac, 0, 1);
  if (f <= 0) return;
  // Filled as one band: a thick stroked arc leaves notches at its ends.
  const steps = Math.max(2, Math.ceil(96 * f));
  const point = (radius: number, i: number): Phaser.Math.Vector2 => {
    const a = -Math.PI / 2 + (Math.PI * 2 * f * i) / steps;
    return new Phaser.Math.Vector2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  };
  g.fillStyle(color, 1);
  for (let i = 0; i < steps; i++) {
    g.fillPoints([point(r, i), point(r, i + 1), point(r - thickness, i + 1), point(r - thickness, i)], true);
  }
}

/** A speaker's round portrait: a head against their colour, in a brass ring. */
export function portraitTexture(scene: Phaser.Scene, who: string, size: number): string {
  const key = `face_${who}_${size}`;
  if (scene.textures.exists(key)) return key;
  const s = size * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const { skin, body } = portraitColours(who);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.38, s * 0.205, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = css(C.brass);
  ctx.stroke();
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** A radio line: portrait, name, one short line, brass bar on the left. Origin top left. */
export function radioChip(scene: Phaser.Scene, who: string, line: string, wrap: number): Part {
  const face = scene.add.image(0, 0, portraitTexture(scene, who, 60)).setScale(0.5).setOrigin(0, 0.5);
  const textX = 6 + 10 + 60 + 13;
  const name = text(scene, textX, 0, who, { size: 15, color: C.brass, bold: true, spacing: 2 });
  const body = text(scene, textX, 0, line, { size: 22, font: BODY, wrap });
  const h = Math.max(80, name.height + body.height + 16);
  const w = Math.ceil(textX + Math.max(name.width, body.width) + 18);
  const top = (h - name.height - body.height) / 2;
  name.y = top;
  body.y = top + name.height;
  face.setPosition(16, h / 2);
  const bg = scene.add.rectangle(0, 0, w, h, C.chip, 0.85).setOrigin(0);
  const bar = scene.add.rectangle(0, 0, 6, h, C.brass).setOrigin(0);
  return { c: scene.add.container(0, 0, [bg, bar, face, name, body]), w, h };
}
