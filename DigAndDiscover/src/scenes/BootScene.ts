import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { createStoreTextures, loadStoreOverrides } from '../art/StoreArt';
import { createIconTextures } from '../art/IconArt';
import { paintUiIcons } from '../art/UiIcons';
import coinUrl from '../assets/ui/coin.png';
import aboveSurfaceUrl from '../assets/world/above-surface.jpg';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // The supplied pickaxe coin replaces the painted one (see TextureFactory).
    this.load.image('coin', coinUrl);
    // The painted scene above the ground.
    this.load.image('above-surface', aboveSurfaceUrl);
    // Optional PNGs from src/assets/store/ replace painted store icons.
    loadStoreOverrides(this.load);
  }

  create(): void {
    createSharedTextures(this.textures);
    createIconTextures(this.textures);
    paintUiIcons(this.textures);
    createStoreTextures(this.textures);
    this.scene.start('Dig');
    this.scene.launch('Hud');
  }
}
