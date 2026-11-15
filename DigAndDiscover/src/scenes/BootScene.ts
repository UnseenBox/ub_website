import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { createStoreTextures, loadStoreOverrides } from '../art/StoreArt';
import { createIconTextures } from '../art/IconArt';
import { paintUiIcons } from '../art/UiIcons';
import coinUrl from '../assets/ui/coin.png';
import aboveSurfaceUrl from '../assets/world/above-surface.jpg';
import { loadShovelImages } from '../art/ShovelArt';
import storeIconUrl from '../assets/ui/icons/store.png';
import goalsIconUrl from '../assets/ui/icons/goals.png';
import workshopIconUrl from '../assets/ui/icons/workshop.png';
import pauseIconUrl from '../assets/ui/icons/pause.png';
import workshopBgUrl from '../assets/world/workshop-bg.jpg';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // The supplied pickaxe coin replaces the painted one (see TextureFactory).
    this.load.image('coin', coinUrl);
    loadShovelImages(this.load);
    // Supplied icons replace the painted ones of the same name (ui-store, ui-target) and add two more.
    this.load.image('ui-store', storeIconUrl);
    this.load.image('ui-target', goalsIconUrl);
    this.load.image('ui-workshop', workshopIconUrl);
    this.load.image('ui-pause', pauseIconUrl);
    this.load.image('workshop-bg', workshopBgUrl);
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
