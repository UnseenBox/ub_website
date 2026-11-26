// The Act 1 map is a supplied painting. It is cropped to fill the map area (the same
// shape as the map screen) and stored as the map texture the map screen already uses.

import Phaser from 'phaser';
import { MAP_VALLEY_ART, MAP_VALLEY_TEXTURE } from '../game/textureKeys';
import { makeCanvas } from './CanvasUtil';

/** Size of the map area on the map screen, in game pixels. */
export const MAP_AREA = { width: 930, height: 720 } as const;

/** Crops the supplied painting to the map area, centred, and registers it as the Act 1 map. */
export function buildValleyMap(scene: Phaser.Scene): void {
  if (scene.textures.exists(MAP_VALLEY_TEXTURE) || !scene.textures.exists(MAP_VALLEY_ART)) return;
  const src = scene.textures.get(MAP_VALLEY_ART).getSourceImage() as HTMLImageElement;
  const { canvas, ctx } = makeCanvas(MAP_AREA.width, MAP_AREA.height);
  // Cover: scale until the area is full, then trim the overflow equally from both sides.
  const k = Math.max(MAP_AREA.width / src.width, MAP_AREA.height / src.height);
  const w = src.width * k, h = src.height * k;
  ctx.drawImage(src, (MAP_AREA.width - w) / 2, (MAP_AREA.height - h) / 2, w, h);
  scene.textures.addCanvas(MAP_VALLEY_TEXTURE, canvas);
}
