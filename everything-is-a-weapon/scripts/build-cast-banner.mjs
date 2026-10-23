/**
 * Builds the lobby cast strip from the four production character portraits.
 *   node scripts/build-cast-banner.mjs
 *
 * The strip is a row of tilted 3:4 portrait cards, so the menu cast uses the
 * exact same art as the character-select screen instead of a second set of
 * mascots. Cards keep a transparent surround; the lobby's CSS drop-shadow
 * follows each card edge.
 *
 * Uses sharp, which is installed transitively by @capacitor/assets. If it is
 * ever removed, install it in the project before running this helper.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = path.join(ROOT, 'src', 'ui-kit', 'bonk2', 'assets', 'icons');
const OUT = path.join(ROOT, 'src', 'ui-kit', 'bonk2', 'assets', 'banners', 'bonk-cast@2x.png');

const CARD_W = 336;
const CARD_H = 448;
const FRAME = 13;
const CARD_OUT_W = CARD_W + FRAME * 2;
const CARD_OUT_H = CARD_H + FRAME * 2;
const CANVAS_W = 1560;
const CANVAS_H = 600;
const INK = '#221b36';
const CREAM = '#fff3d6';

const cards = [
  { file: 'character-violet@2x.png', angle: -2.2, centerX: 221 },
  { file: 'character-teal@2x.png', angle: 1.4, centerX: 601 },
  { file: 'character-rose@2x.png', angle: -1.2, centerX: 981 },
  { file: 'character-lime@2x.png', angle: 2.0, centerX: 1361 },
];

const frameSvg = Buffer.from(`
  <svg width="${CARD_OUT_W}" height="${CARD_OUT_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${CARD_OUT_W - 4}" height="${CARD_OUT_H - 4}" rx="18"
      fill="${CREAM}" stroke="${INK}" stroke-width="4"/>
  </svg>
`);

const innerBorderSvg = Buffer.from(`
  <svg width="${CARD_OUT_W}" height="${CARD_OUT_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${FRAME - 1}" y="${FRAME - 1}" width="${CARD_W + 2}" height="${CARD_H + 2}" rx="11"
      fill="none" stroke="${INK}" stroke-width="2"/>
  </svg>
`);

const portraitMask = Buffer.from(`
  <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${CARD_W}" height="${CARD_H}" rx="10" fill="#ffffff"/>
  </svg>
`);

const shadowSvg = Buffer.from(`
  <svg width="${CARD_OUT_W}" height="${CARD_OUT_H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${CARD_OUT_W - 4}" height="${CARD_OUT_H - 4}" rx="18"
      fill="#1b1424" fill-opacity="0.55"/>
  </svg>
`);

/** Rounded portrait, cream frame, inner ink hairline, then a small tilt. */
async function buildCard({ file, angle }) {
  const portrait = await sharp(path.join(ICONS, file))
    .resize(CARD_W, CARD_H, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: portraitMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const card = await sharp(frameSvg)
    .composite([
      { input: portrait, left: FRAME, top: FRAME },
      { input: innerBorderSvg, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  const rotated = await sharp(card)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(rotated).metadata();

  const shadow = await sharp(shadowSvg).blur(10).png().toBuffer();
  const shadowRotated = await sharp(shadow)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const shadowMeta = await sharp(shadowRotated).metadata();

  return {
    card: rotated,
    cardW: meta.width ?? CARD_OUT_W,
    cardH: meta.height ?? CARD_OUT_H,
    shadow: shadowRotated,
    shadowW: shadowMeta.width ?? CARD_OUT_W,
    shadowH: shadowMeta.height ?? CARD_OUT_H,
  };
}

const built = await Promise.all(cards.map(buildCard));
const shadows = [];
const portraits = [];

built.forEach((entry, index) => {
  const centerX = cards[index].centerX;
  const centerY = CANVAS_H / 2;
  shadows.push({
    input: entry.shadow,
    left: Math.round(centerX - entry.shadowW / 2 + 8),
    top: Math.round(centerY - entry.shadowH / 2 + 12),
  });
  portraits.push({
    input: entry.card,
    left: Math.round(centerX - entry.cardW / 2),
    top: Math.round(centerY - entry.cardH / 2),
  });
});

await sharp({
  create: {
    width: CANVAS_W,
    height: CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([...shadows, ...portraits])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(OUT);

console.log(`WROTE ${path.relative(ROOT, OUT)}`);
