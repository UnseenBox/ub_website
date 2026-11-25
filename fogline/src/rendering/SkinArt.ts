// Weapon skins: repaints a weapon's view model or icon in a skin's colours.
//
// Grey metal and polymer take the paint; saturated pixels (gloves, hands, brass,
// sights) keep most of their own colour, and the original shading shows through.
// Textures are built once, the first time a skin is needed.

import Phaser from 'phaser';
import { SKINS, SkinId } from '../data/retention';

const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** Texture key of `baseKey` painted in `skin` (built on first use). Falls back to the base key. */
export function skinTexture(scene: Phaser.Scene, baseKey: string, skin: SkinId | ''): string {
  if (!skin || !scene.textures.exists(baseKey)) return baseKey;
  const key = `${baseKey}__${skin}`;
  if (scene.textures.exists(key)) return key;
  const frame = scene.textures.get(baseKey).get();
  const w = Math.max(1, Math.round(frame.cutWidth));
  const h = Math.max(1, Math.round(frame.cutHeight));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return baseKey;
  ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return baseKey;
  }
  const def = SKINS[skin];
  const main = hex(def.color);
  const camo = def.camo ? hex(def.camo) : null;
  const shine = skin === 'gold';
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const weight = def.strength * Math.min(1, Math.max(0, 1 - sat * 2.4));
      if (weight <= 0.01) continue;
      const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      // Blotchy camo: two layers of soft waves, in texture-relative units so icons and view models match.
      const u = x / w;
      let paint = main;
      if (camo) {
        const n = Math.sin(u * 23 + Math.sin(v * 9) * 2.2) + Math.sin(v * 17 + u * 7 + Math.sin(u * 31) * 0.8);
        if (n > 0.55) paint = camo;
      }
      const shade = shine ? 0.2 + 1.25 * lum + lum * lum * 0.6 : 0.3 + 0.95 * lum;
      for (let c = 0; c < 3; c++) {
        const painted = Math.min(255, paint[c] * shade);
        d[i + c] = Math.round(d[i + c] * (1 - weight) + painted * weight);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, canvas);
  return key;
}
