// The analog-screen look for the title menu: scan lines, a rolling interference band, a
// flicker of brightness, a vignette and an iris that opens like a lens coming into focus.
// Everything is painted once into small textures, so it costs little per frame.

import Phaser from 'phaser';
import { VIEW } from '../game/config';
import { BLEED, MAX_SCREEN } from '../game/screen';
import { makeCanvas } from './CanvasUtil';

export const FX = {
  scan: 'fx_scanlines',
  vignette: 'fx_vignette',
} as const;

/** Paints the textures once. Safe to call every time a menu opens. */
export function buildScreenFx(scene: Phaser.Scene): void {
  if (!scene.textures.exists(FX.scan)) {
    // Two rows: one faint dark line every other pixel row, like a tube's raster.
    const { canvas, ctx } = makeCanvas(4, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 4, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, 2, 4, 2);
    scene.textures.addCanvas(FX.scan, canvas);
  }
  if (!scene.textures.exists(FX.vignette)) {
    const { canvas, ctx } = makeCanvas(VIEW.width, VIEW.height);
    const g = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.4, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.66);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    scene.textures.addCanvas(FX.vignette, canvas);
  }
}

/** The scan lines, the rolling band, the noise and the flicker, drawn over the whole screen. */
export class ScreenOverlay {
  private readonly scan: Phaser.GameObjects.TileSprite;
  private readonly noise: Phaser.GameObjects.TileSprite;
  private readonly band: Phaser.GameObjects.Graphics;
  private readonly flicker: Phaser.GameObjects.Rectangle;
  private bandY = -200;
  private bandWait = 1.5;
  private flickerLeft = 0;
  private nextFlicker = 2.5;

  constructor(scene: Phaser.Scene, depth: number) {
    const x = -BLEED.x, y = -BLEED.y, w = MAX_SCREEN.width, h = MAX_SCREEN.height;
    scene.add.image(x, y, FX.vignette).setOrigin(0).setDisplaySize(w, h).setDepth(depth);
    this.scan = scene.add.tileSprite(x, y, w, h, FX.scan).setOrigin(0).setAlpha(0.75).setDepth(depth + 1);
    this.band = scene.add.graphics().setDepth(depth + 2);
    this.noise = scene.add.tileSprite(x, y, w, h, 'grain').setOrigin(0).setAlpha(0.09).setDepth(depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.flicker = scene.add.rectangle(x, y, w, h, 0x9ad0ff, 0).setOrigin(0).setDepth(depth + 4);
  }

  update(dt: number): void {
    // The raster drifts, and the noise shakes a little every frame.
    this.scan.tilePositionY += dt * 7;
    this.noise.tilePositionX = Math.random() * 512;
    this.noise.tilePositionY = Math.random() * 512;

    // A band of brighter, slightly distorted lines rolls down the screen every few seconds.
    if (this.bandWait > 0) {
      this.bandWait -= dt;
    } else {
      this.bandY += dt * 190;
      if (this.bandY > VIEW.height + 60) {
        this.bandY = -140;
        this.bandWait = 2.5 + Math.random() * 4;
      }
    }
    this.band.clear();
    if (this.bandWait <= 0) {
      this.band.fillStyle(0xffffff, 0.035).fillRect(-BLEED.x, this.bandY, MAX_SCREEN.width, 110);
      this.band.fillStyle(0xffffff, 0.07).fillRect(-BLEED.x, this.bandY + 34, MAX_SCREEN.width, 6);
      this.band.fillStyle(0x000000, 0.2).fillRect(-BLEED.x, this.bandY + 80, MAX_SCREEN.width, 4);
    }

    // The picture's brightness wavers now and then, as a tube does.
    this.nextFlicker -= dt;
    if (this.nextFlicker <= 0) {
      this.flickerLeft = 0.06 + Math.random() * 0.05;
      this.nextFlicker = 2 + Math.random() * 5;
    }
    if (this.flickerLeft > 0) {
      this.flickerLeft -= dt;
      this.flicker.setAlpha(0.07);
    } else {
      this.flicker.setAlpha(0);
    }
  }
}
