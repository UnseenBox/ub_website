// Paints the icon set (iconPaths.ts) into textures: any icon, size and colour, drawn once
// and cached. Painted at twice the size and shown at half, so it stays sharp when the
// canvas is scaled up.

import Phaser from 'phaser';
import { ICONS, type IconName } from './iconPaths';

export type { IconName } from './iconPaths';
export { ITEM_ICON, WEAPON_ICON } from './iconPaths';

const SS = 2;

export interface IconStyle {
  /** Solid shape in this colour (a filled star), outlined in `color`. */
  fill?: number;
  /** Stroke width in grid units. */
  stroke?: number;
}

const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** The texture key for an icon `size` pixels tall, painting it on first use. */
export function iconTexture(scene: Phaser.Scene, name: IconName, size: number, color: number, style: IconStyle = {}): string {
  const h = Math.round(size);
  const stroke = style.stroke ?? 2;
  const key = `fi_${name}_${h}_${color}_${style.fill ?? 'n'}_${stroke}`;
  if (scene.textures.exists(key)) return key;
  const def = ICONS[name];
  const unit = (h * SS) / 24;
  const pad = 3 * SS;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(def.w * unit) + pad * 2;
  canvas.height = h * SS + pad * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(pad, pad);
  ctx.scale(unit, unit);
  ctx.lineWidth = stroke;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = new Path2D(def.d);
  if (style.fill !== undefined) {
    ctx.fillStyle = css(style.fill);
    ctx.fill(path);
  }
  ctx.strokeStyle = css(color);
  ctx.stroke(path);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** An icon `size` pixels tall, centred on (x, y). */
export function icon(
  scene: Phaser.Scene, name: IconName, x: number, y: number, size: number, color: number, style: IconStyle = {},
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, iconTexture(scene, name, size, color, style)).setScale(1 / SS);
}

/** The width an icon takes at `size` pixels tall. */
export function iconWidth(name: IconName, size: number): number {
  return (ICONS[name].w / 24) * size;
}
