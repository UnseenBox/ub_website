import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createSharedTextures(this.textures);
    this.scene.start('Dig');
    this.scene.launch('Hud');
  }
}
