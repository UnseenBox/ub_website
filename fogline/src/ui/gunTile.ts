// A gun's picture in a square screen: in colour once the gun is unlocked, grey while it is
// still locked, and both behind the title menu's analog look (scan lines, a rolling wave
// that bends the picture, grain and flicker). Each gun's picture is painted once.

import Phaser from 'phaser';
import { makeCanvas } from '../rendering/CanvasUtil';
import { FX, buildScreenFx } from '../rendering/ScreenFx';
import { WAVE, flickerAt, gunCrop, toGrey, waveAt } from './gunTileMath';

/** Pixels a side of the painted picture. */
const BAKE = 384;
/** Slices of the picture the wave pushes sideways: where in the wave, and how far. */
const SLICES = [{ at: 0.12, push: 5 }, { at: 0.42, push: -4 }, { at: 0.74, push: 3 }];
/** How tall a slice is, as a share of the tile. */
const SLICE_H = 0.035;

/** The texture for a gun tile, painting it the first time it is asked for. */
function gunArt(scene: Phaser.Scene, id: string, source: string, locked: boolean): string {
  const key = `gunart:${source}:${locked ? 'off' : 'on'}`;
  if (scene.textures.exists(key)) return key;
  const frame = scene.textures.get(source).get();
  const crop = gunCrop(id, frame.cutWidth, frame.cutHeight);
  const { canvas, ctx } = makeCanvas(BAKE, BAKE);
  // A lamp behind the gun, so dark metal still reads against the screen.
  const glow = ctx.createRadialGradient(BAKE * 0.5, BAKE * 0.42, 0, BAKE * 0.5, BAKE * 0.42, BAKE * 0.75);
  glow.addColorStop(0, '#626249');
  glow.addColorStop(1, '#17180f');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, BAKE, BAKE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    frame.source.image as CanvasImageSource,
    frame.cutX + crop.x, frame.cutY + crop.y, crop.side, crop.side, 0, 0, BAKE, BAKE,
  );
  if (locked) {
    const pixels = ctx.getImageData(0, 0, BAKE, BAKE);
    toGrey(pixels.data);
    ctx.putImageData(pixels, 0, 0);
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

export class GunTile {
  /** Everything the tile draws, with its top left corner at the position given. */
  readonly c: Phaser.GameObjects.Container;
  private readonly slices: Phaser.GameObjects.Image[] = [];
  private readonly scan: Phaser.GameObjects.TileSprite;
  private readonly noise: Phaser.GameObjects.TileSprite;
  private readonly wave: Phaser.GameObjects.Graphics;
  private readonly flicker: Phaser.GameObjects.Rectangle;

  /** `gun` is null for a tile with no picture, which still has the screen's effect. */
  constructor(
    scene: Phaser.Scene, x: number, y: number, private readonly size: number,
    gun: { id: string; source: string } | null, locked: boolean, private readonly seed: number,
  ) {
    buildScreenFx(scene);
    const parts: Phaser.GameObjects.GameObject[] = [scene.add.rectangle(0, 0, size, size, 0x23241a).setOrigin(0)];
    if (gun) {
      const key = gunArt(scene, gun.id, gun.source, locked);
      parts.push(scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(size, size));
      for (let i = 0; i < SLICES.length; i++) {
        const slice = scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(size, size).setVisible(false);
        this.slices.push(slice);
        parts.push(slice);
      }
    }
    this.scan = scene.add.tileSprite(0, 0, size, size, FX.scan).setOrigin(0).setAlpha(0.7);
    this.wave = scene.add.graphics();
    this.noise = scene.add.tileSprite(0, 0, size, size, 'grain').setOrigin(0).setAlpha(0.13).setBlendMode(Phaser.BlendModes.ADD);
    const vignette = scene.add.image(0, 0, FX.vignette).setOrigin(0).setDisplaySize(size, size).setAlpha(0.6);
    this.flicker = scene.add.rectangle(0, 0, size, size, 0x9ad0ff, 0).setOrigin(0);
    parts.push(this.scan, this.wave, this.noise, vignette, this.flicker);
    this.c = scene.add.container(x, y, parts);
    this.update(scene.time.now / 1000);
  }

  /** Moves the effect on to `time`, in seconds. */
  update(time: number): void {
    const size = this.size;
    this.scan.tilePositionY = time * 7;
    this.noise.tilePositionX = Math.random() * 512;
    this.noise.tilePositionY = Math.random() * 512;
    this.flicker.setAlpha(flickerAt(time, this.seed) ? 0.09 : 0);

    const top = waveAt(time, this.seed, size);
    const band = size * WAVE.height;
    const g = this.wave;
    g.clear();
    if (top !== null) {
      // Only the part of each stripe that is on the tile is drawn.
      const stripe = (y: number, h: number, color: number, alpha: number): void => {
        const from = Math.max(0, y), to = Math.min(size, y + h);
        if (to > from) g.fillStyle(color, alpha).fillRect(0, from, size, to - from);
      };
      stripe(top, band, 0xffffff, 0.07);
      stripe(top + band * 0.32, 3, 0xffffff, 0.2);
      stripe(top + band * 0.75, 2, 0x000000, 0.4);
    }
    const toTex = BAKE / size;
    this.slices.forEach((slice, i) => {
      const h = size * SLICE_H;
      const y = top === null ? -1 : top + band * SLICES[i].at;
      const on = y >= 0 && y + h <= size;
      slice.setVisible(on);
      if (!on) return;
      // The slice is cut short on the side it is pushed toward, so it never leaves the tile.
      const push = SLICES[i].push + (Math.random() - 0.5) * 2;
      slice.x = push;
      slice.setCrop(Math.max(0, -push) * toTex, y * toTex, BAKE - Math.abs(push) * toTex, h * toTex);
    });
  }
}
