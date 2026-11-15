import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { mulberry32 } from '../core/Random';
import type { Rock } from '../core/types';
import { INTERIOR_PAINTERS } from './InteriorArt';
import { TAU, css, darken, makeCanvasTexture, mix, star } from './paint';

/** Rock textures are painted at 2x so they stay crisp when scaled up. */
export const ART_RES = 2;

export interface RockTextureKeys {
  outside: string;
  inside: string;
}

export function rockKeys(rock: Rock): RockTextureKeys {
  return { outside: `${rock.id}-out`, inside: `${rock.id}-in` };
}

/** Radius of the rock in texture pixels. */
export function rockRadiusPx(rock: Rock): number {
  return GAME_CONFIG.rock.baseRadius * rock.size * ART_RES;
}

/** Display scale that makes a size-1.0 rock this many screen pixels in diameter. */
export function iconScale(diameter: number): number {
  return diameter / (2 * GAME_CONFIG.rock.baseRadius * ART_RES * 1.12);
}

type RockPicture = HTMLImageElement | HTMLCanvasElement;

/** Where the rock's picture goes on its square texture: as wide as the old rock, centred. */
function pictureBox(rock: Rock, img: RockPicture, size: number): { x: number; y: number; w: number; h: number; R: number; c: number } {
  const R = rockRadiusPx(rock);
  const w = 2 * R * 1.06;
  const h = (w * img.height) / img.width;
  return { x: (size - w) / 2, y: (size - h) / 2, w, h, R, c: size / 2 };
}

/** The outside of a rock: its painted picture, with glitter on top when it is a sparkly one. */
export function drawOutside(ctx: CanvasRenderingContext2D, rock: Rock, size: number, img: RockPicture): void {
  const { x, y, w, h, c } = pictureBox(rock, img, size);
  ctx.drawImage(img, x, y, w, h);
  if (rock.sparkly) {
    const rng = mulberry32(rock.seed);
    for (let i = 0; i < 5; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * 0.7;
      star(ctx, c + Math.cos(a) * d * (w / 2), c + Math.sin(a) * d * (h / 2), (w / 2) * (0.05 + rng() * 0.06), 'rgba(255,255,255,0.95)');
    }
  }
}

/**
 * The cut face of a rock: the picture's own silhouette filled with a rind, and the mineral's
 * painting inside it. (The mineral painters draw a disc; the silhouette trims it to the rock.)
 */
export function drawInside(ctx: CanvasRenderingContext2D, rock: Rock, size: number, img: RockPicture): void {
  const { w, h, R, c } = pictureBox(rock, img, size);
  const ex = rock.exterior;
  const rng = mulberry32(rock.seed);
  const silhouette = (scale: number, fill: string): HTMLCanvasElement => {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const g = cv.getContext('2d')!;
    g.drawImage(img, c - (w * scale) / 2, c - (h * scale) / 2, w * scale, h * scale);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = fill;
    g.fillRect(0, 0, size, size);
    return cv;
  };

  ctx.drawImage(silhouette(1.035, 'rgb(45,28,16)'), 0, 0);
  ctx.drawImage(silhouette(1, css(darken(ex.shade, 0.1))), 0, 0);
  ctx.drawImage(silhouette(0.93, css(mix(ex.base, ex.light, 0.35))), 0, 0);

  // The mineral's painting, trimmed to the inner part of the silhouette.
  const inner = document.createElement('canvas');
  inner.width = size;
  inner.height = size;
  const ig = inner.getContext('2d')!;
  INTERIOR_PAINTERS[rock.mineral.style](ig, rng, c, c, R * 0.92, rock.mineral);
  ig.globalCompositeOperation = 'destination-in';
  ig.drawImage(silhouette(0.84, '#000'), 0, 0);
  ctx.drawImage(inner, 0, 0);

  // Polished-face sheen, only where there is rock.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sheen = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
  sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

/** Paints the rock's outside and cross-section textures if they don't exist yet. */
export function ensureRockTextures(textures: Phaser.Textures.TextureManager, rock: Rock): RockTextureKeys {
  const keys = rockKeys(rock);
  const size = Math.ceil(rockRadiusPx(rock) * 2.25);
  const img = textures.get(rock.exterior.sprite).getSourceImage() as RockPicture;
  if (!textures.exists(keys.outside)) makeCanvasTexture(textures, keys.outside, size, size, (ctx) => drawOutside(ctx, rock, size, img));
  if (!textures.exists(keys.inside)) makeCanvasTexture(textures, keys.inside, size, size, (ctx) => drawInside(ctx, rock, size, img));
  return keys;
}

export function releaseRockTextures(textures: Phaser.Textures.TextureManager, rock: Rock): void {
  const keys = rockKeys(rock);
  if (textures.exists(keys.outside)) textures.remove(keys.outside);
  if (textures.exists(keys.inside)) textures.remove(keys.inside);
}
