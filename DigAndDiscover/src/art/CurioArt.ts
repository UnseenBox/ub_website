import type Phaser from 'phaser';
import { CURIOS, CURIO_CATEGORIES, type CurioDef } from '../data/curios';
import { TAU, css, darken, lighten, makeCanvasTexture } from './paint';

const SIZE = 160;
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

export const curioKey = (id: string): string => `curio-${id}`;

/** Optional art overrides: any `src/assets/curios/<curio id>.png` replaces the emoji sticker. */
const OVERRIDES = import.meta.glob('../assets/curios/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function loadCurioOverrides(load: Phaser.Loader.LoaderPlugin): void {
  for (const [path, url] of Object.entries(OVERRIDES)) {
    const id = path.split('/').pop()?.replace(/\.png$/i, '');
    if (id) load.image(curioKey(id), url);
  }
}

/** Paints a sticker for every curio that has no PNG override. */
export function createCurioTextures(T: Phaser.Textures.TextureManager): void {
  for (const curio of CURIOS) {
    const key = curioKey(curio.id);
    if (T.exists(key)) continue;
    makeCanvasTexture(T, key, SIZE, SIZE, (ctx) => paintSticker(ctx, curio));
  }
}

/** Round sticker: category colour glow, white rim, the emoji big in the middle. */
function paintSticker(ctx: CanvasRenderingContext2D, curio: CurioDef): void {
  const color = CURIO_CATEGORIES[curio.category].color;
  const c = SIZE / 2;
  // Soft glow.
  const glow = ctx.createRadialGradient(c, c, 20, c, c, c - 2);
  glow.addColorStop(0, css(lighten(color, 0.35), 0.95));
  glow.addColorStop(0.75, css(color, 0.9));
  glow.addColorStop(1, css(darken(color, 0.25), 0.95));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(59,38,22,0.55)';
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, TAU);
  ctx.stroke();

  // Keep each emoji's colour-presentation selector attached to it.
  const glyphs: string[] = [];
  for (const g of Array.from(curio.icon)) {
    if (g === String.fromCharCode(0xfe0f) && glyphs.length > 0) glyphs[glyphs.length - 1] += g;
    else if (g.trim() !== '') glyphs.push(g);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  if (glyphs.length <= 1) {
    ctx.font = `92px ${EMOJI_FONT}`;
    ctx.fillText(glyphs[0] ?? '?', c, c + 6);
  } else {
    ctx.font = `66px ${EMOJI_FONT}`;
    ctx.fillText(glyphs[0], c - 24, c + 4);
    ctx.font = `62px ${EMOJI_FONT}`;
    ctx.fillText(glyphs[1], c + 28, c + 12);
  }
}
