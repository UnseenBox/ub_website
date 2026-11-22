import { sfx } from '../audio/Sfx';
import { portal } from '../ads/Portal';
import { shouldPlayDream } from './DreamScene';
import { state } from '../core/GameState';
import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { ensureRockTextures } from '../art/RockArt';
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
    portal.loadingStart();
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
    portal.onMuteForced(() => sfx.applyMasterGain());
    portal.loadingStop();
    // The animated loading screen of the retention update fades out now that the game is drawn.
    (window as unknown as { __hideLoading?: () => void }).__hideLoading?.();
    // The dream: the real game with everything maxed out for a short while (see DreamScene).
    const dream = shouldPlayDream();
    if (dream) {
      state.beginDream();
      // The dream's bag rocks were not dug up by the dig scene, so their pictures are painted here.
      for (let i = 0; i < state.inventory.capacity; i++) {
        const rock = state.inventory.get(i);
        if (rock) ensureRockTextures(this.textures, rock);
      }
    }
    this.scene.start('Dig');
    this.scene.launch('Hud');
    if (dream) this.scene.launch('Dream');
  }
}
