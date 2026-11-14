import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { createStoreTextures, loadStoreOverrides } from '../art/StoreArt';
import { createCurioTextures, loadCurioOverrides } from '../art/CurioArt';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Optional PNGs from src/assets/store/ replace painted store icons.
    loadStoreOverrides(this.load);
    loadCurioOverrides(this.load);
  }

  create(): void {
    createSharedTextures(this.textures);
    createStoreTextures(this.textures);
    createCurioTextures(this.textures);
    this.scene.start('Dig');
    this.scene.launch('Hud');
  }
}
