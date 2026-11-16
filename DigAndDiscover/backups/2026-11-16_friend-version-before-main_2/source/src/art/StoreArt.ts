import type Phaser from 'phaser';
import { FONT_FAMILY } from '../config/Theme';
import { TOOL_SECTIONS, UPGRADE_SECTIONS, type IconStyle, type UpgradeGlyph } from '../data/store';
import { TAU, css, darken, lighten, makeCanvasTexture, roundRect } from './paint';

const SIZE = 128;

export const STORE_ICON_PREFIX = 'store-icon-';
export const storeIconKey = (id: string): string => `${STORE_ICON_PREFIX}${id}`;

/**
 * Optional art overrides. Any `src/assets/store/<item id>.png` is picked up
 * at build time and used instead of the painted icon.
 */
const OVERRIDES = import.meta.glob('../assets/store/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Queue every override image for loading (call from a scene's preload). */
export function loadStoreOverrides(load: Phaser.Loader.LoaderPlugin): void {
  for (const [path, url] of Object.entries(OVERRIDES)) {
    const id = path.split('/').pop()?.replace(/\.png$/i, '');
    if (id) load.image(storeIconKey(id), url);
  }
}

/** Paints a texture for every catalogue item that has no PNG override. */
export function createStoreTextures(T: Phaser.Textures.TextureManager): void {
  const paint = (id: string, style: IconStyle): void => {
    const key = storeIconKey(id);
    if (T.exists(key)) return; // an override was loaded
    makeCanvasTexture(T, key, SIZE, SIZE, (ctx) => paintIcon(ctx, style));
  };
  for (const section of TOOL_SECTIONS) for (const item of section.items) paint(item.id, item.icon);
  for (const section of UPGRADE_SECTIONS) for (const item of section.items) paint(item.id, item.icon);
}

function paintIcon(ctx: CanvasRenderingContext2D, style: IconStyle): void {
  switch (style.kind) {
    case 'shovel':
      return paintShovel(ctx, style.blade, style.shine, style.handle ?? 0x7a5330);
    case 'placeholder':
      return paintPlaceholder(ctx);
    case 'glyph':
      return paintGlyph(ctx, style.glyph, style.color);
  }
}

/** A tilted shovel; `blade` is the metal colour so each tier reads at a glance. */
function paintShovel(ctx: CanvasRenderingContext2D, blade: number, shine: number, handle: number): void {
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.PI / 4);
  ctx.lineJoin = 'round';
  const outline = '#2b1c0e';

  // Handle.
  ctx.fillStyle = css(handle);
  roundRect(ctx, -5, -52, 10, 76, 4);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 3;
  ctx.stroke();
  // D-grip.
  ctx.fillStyle = css(darken(handle, 0.15));
  roundRect(ctx, -17, -58, 34, 14, 7);
  ctx.fill();
  ctx.stroke();

  // Blade.
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(8, 18);
  ctx.lineTo(22, 34);
  ctx.quadraticCurveTo(20, 56, 0, 66);
  ctx.quadraticCurveTo(-20, 56, -22, 34);
  ctx.closePath();
  const g = ctx.createLinearGradient(-22, 0, 22, 0);
  g.addColorStop(0, css(darken(blade, 0.2)));
  g.addColorStop(0.45, css(blade));
  g.addColorStop(1, css(darken(blade, 0.3)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  // Shine.
  ctx.strokeStyle = css(shine, 0.85);
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, 32);
  ctx.quadraticCurveTo(-12, 46, -4, 55);
  ctx.stroke();
  // Collar.
  ctx.fillStyle = css(lighten(blade, 0.1));
  roundRect(ctx, -9, 14, 18, 8, 3);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** Dashed empty frame with a question mark: "art goes here". */
function paintPlaceholder(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(122,90,58,0.10)';
  roundRect(ctx, 10, 10, SIZE - 20, SIZE - 20, 18);
  ctx.fill();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(122,90,58,0.55)';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(122,90,58,0.6)';
  ctx.font = `700 64px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', SIZE / 2, SIZE / 2 + 4);
}

function paintGlyph(ctx: CanvasRenderingContext2D, glyph: UpgradeGlyph, color: number): void {
  const c = SIZE / 2;
  // Round badge.
  ctx.fillStyle = css(darken(color, 0.35));
  ctx.beginPath();
  ctx.arc(c, c + 4, 54, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 10, 0, SIZE - 10);
  g.addColorStop(0, css(lighten(color, 0.25)));
  g.addColorStop(1, css(color));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, 54, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2b1c0e';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (glyph) {
    case 'bolt':
      poly(ctx, [[72, 22], [40, 70], [60, 70], [52, 106], [88, 54], [66, 54]]);
      break;
    case 'refill':
      ctx.beginPath();
      ctx.arc(c, c, 26, -0.4, TAU - 1.2);
      ctx.stroke();
      poly(ctx, [[c + 22, c - 38], [c + 44, c - 8], [c + 10, c - 8]]);
      break;
    case 'efficiency':
      // Leaf: "less effort".
      ctx.beginPath();
      ctx.moveTo(34, 94);
      ctx.quadraticCurveTo(30, 36, 94, 34);
      ctx.quadraticCurveTo(98, 98, 34, 94);
      ctx.fill();
      ctx.strokeStyle = css(darken(color, 0.3));
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(40, 88);
      ctx.lineTo(80, 48);
      ctx.stroke();
      break;
    case 'damage':
      // Impact burst.
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU - Math.PI / 2;
        const r = i % 2 === 0 ? 34 : 17;
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'speed':
      for (const dx of [-18, 8]) {
        ctx.beginPath();
        ctx.moveTo(c + dx - 8, 38);
        ctx.lineTo(c + dx + 18, c);
        ctx.lineTo(c + dx - 8, 90);
        ctx.stroke();
      }
      break;
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}
