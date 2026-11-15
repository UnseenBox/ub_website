import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { createStoreTextures, loadStoreOverrides } from '../art/StoreArt';
import { createIconTextures } from '../art/IconArt';
import { paintUiIcons } from '../art/UiIcons';
import coinUrl from '../assets/ui/coin.png';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // The supplied pickaxe coin replaces the painted one (see TextureFactory).
    this.load.image('coin', coinUrl);
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
