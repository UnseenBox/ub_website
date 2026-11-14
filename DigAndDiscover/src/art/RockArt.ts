import type Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { mulberry32 } from '../core/Random';
import type { Rock } from '../core/types';
import { INTERIOR_PAINTERS } from './InteriorArt';
import { TAU, blobPath, blobPoints, css, darken, ellipse, makeCanvasTexture, mix, star } from './paint';

/** Rock textures are painted at 2x so they stay crisp when scaled up. */
export const ART_RES = 2;

const OUTLINE = 'rgba(45,28,16,0.6)';

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

function rockShape(rock: Rock) {
  const rng = mulberry32(rock.seed);
  const pts = blobPoints(rng, 11, rock.exterior.bumpiness + 0.05, rock.exterior.squash);
  return { rng, pts };
}

function drawOutside(ctx: CanvasRenderingContext2D, rock: Rock, size: number): void {
  const R = rockRadiusPx(rock);
  const c = size / 2;
  const ex = rock.exterior;
  const { rng, pts } = rockShape(rock);
  const path = blobPath(pts, c, c, R);

  const body = ctx.createRadialGradient(c - R * 0.35, c - R * 0.45, R * 0.05, c, c, R * 1.1);
  body.addColorStop(0, css(ex.light));
  body.addColorStop(0.5, css(ex.base));
  body.addColorStop(1, css(ex.shade));
  ctx.fillStyle = body;
  ctx.fill(path);

  ctx.save();
  ctx.clip(path);
  // Soft shade along the bottom for a rounded, weighty look.
  ctx.fillStyle = css(darken(ex.shade, 0.2), 0.35);
  ellipse(ctx, c + R * 0.15, c + R * 0.95, R * 1.15, R * 0.55);
  // Lumps.
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU;
    const d = rng() * 0.55 * R;
    ctx.fillStyle = css(ex.light, 0.16);
    ellipse(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.2 + rng() * 0.2), R * (0.12 + rng() * 0.12), rng() * TAU);
  }
  // Pits with a lit lower lip.
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU;
    const d = rng() * 0.65 * R;
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const pr = R * (0.04 + rng() * 0.07);
    ctx.fillStyle = css(darken(ex.shade, 0.15), 0.5);
    ellipse(ctx, x, y, pr, pr * 0.75);
    ctx.fillStyle = css(ex.light, 0.45);
    ellipse(ctx, x + pr * 0.2, y + pr * 0.5, pr * 0.7, pr * 0.28);
  }
  // Speckles.
  for (let i = 0; i < 34; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * 0.9 * R;
    ctx.fillStyle = css(ex.speckle, 0.35 + rng() * 0.35);
    ellipse(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.012 + rng() * 0.02), R * (0.01 + rng() * 0.015));
  }
  // Highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ellipse(ctx, c - R * 0.36, c - R * 0.42, R * 0.32, R * 0.16, -0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(ctx, c - R * 0.5, c - R * 0.5, R * 0.07, R * 0.045, -0.6);
  if (rock.sparkly) {
    for (let i = 0; i < 5; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * 0.7 * R;
      star(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.05 + rng() * 0.06), 'rgba(255,255,255,0.95)');
    }
  }
  ctx.restore();

  ctx.lineWidth = 2.4 * ART_RES;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke(path);
}

function drawInside(ctx: CanvasRenderingContext2D, rock: Rock, size: number): void {
  const R = rockRadiusPx(rock);
  const c = size / 2;
  const ex = rock.exterior;
  const { rng, pts } = rockShape(rock);

  const outer = blobPath(pts, c, c, R);
  ctx.fillStyle = css(darken(ex.shade, 0.1));
  ctx.fill(outer);
  const rind = blobPath(pts, c, c, R * 0.9);
  ctx.fillStyle = css(mix(ex.base, ex.light, 0.35));
  ctx.fill(rind);

  const innerR = R * 0.8;
  const inner = blobPath(pts, c, c, innerR);
  ctx.save();
  ctx.clip(inner);
  INTERIOR_PAINTERS[rock.mineral.style](ctx, rng, c, c, innerR, rock.mineral);
  ctx.restore();

  ctx.lineWidth = R * 0.04;
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.stroke(inner);

  // Polished-face sheen.
  ctx.save();
  ctx.clip(rind);
  const sheen = ctx.createLinearGradient(c - R, c - R, c + R, c + R);
  sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.lineWidth = 2.4 * ART_RES;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke(outer);
}

/** Paints the rock's outside and cross-section textures if they don't exist yet. */
export function ensureRockTextures(textures: Phaser.Textures.TextureManager, rock: Rock): RockTextureKeys {
  const keys = rockKeys(rock);
  const size = Math.ceil(rockRadiusPx(rock) * 2.25);
  if (!textures.exists(keys.outside)) makeCanvasTexture(textures, keys.outside, size, size, (ctx) => drawOutside(ctx, rock, size));
  if (!textures.exists(keys.inside)) makeCanvasTexture(textures, keys.inside, size, size, (ctx) => drawInside(ctx, rock, size));
  return keys;
}

export function releaseRockTextures(textures: Phaser.Textures.TextureManager, rock: Rock): void {
  const keys = rockKeys(rock);
  if (textures.exists(keys.outside)) textures.remove(keys.outside);
  if (textures.exists(keys.inside)) textures.remove(keys.inside);
}
