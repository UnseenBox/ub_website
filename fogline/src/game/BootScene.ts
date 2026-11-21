import Phaser from 'phaser';
import m1aViewUrl from '../assets/m1a-view.png';
import menuBgUrl from '../assets/main-menu.png';
import menuButtonsUrl from '../assets/menu-buttons.png';
import { audio } from '../audio/AudioManager';
import { buildEnvironmentTextures } from '../rendering/EnvironmentArt';
import { buildFxTextures } from '../rendering/FxArt';
import { buildHudTextures } from '../rendering/HudArt';
import { buildWeaponTextures } from '../rendering/WeaponArt';
import { ZOMBIE_ATLAS, buildZombieAtlas } from '../rendering/ZombieArt';
import { SaveManager } from '../systems/SaveManager';
import { VIEW } from './config';
import { MENU_BG_TEXTURE, MENU_BUTTON_FRAMES, MENU_BUTTONS_TEXTURE } from './textureKeys';

/** Paints every procedural texture and synthesizes the sound bank. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Supplied bitmaps; everything else is generated below.
    this.load.image('view_service_photo', m1aViewUrl);
    this.load.image(MENU_BG_TEXTURE, menuBgUrl);
    this.load.image(MENU_BUTTONS_TEXTURE, menuButtonsUrl);
  }

  create(): void {
    const t = this.add.text(VIEW.centerX, VIEW.height / 2, 'ESTABLISHING PERIMETER…', {
      fontFamily: 'Consolas, "Courier New", monospace', fontSize: '18px', color: '#9a9a86',
    }).setOrigin(0.5);
    // let the loading text render before the heavy synchronous work
    this.time.delayedCall(40, () => {
      const t0 = performance.now();
      buildEnvironmentTextures(this);
      buildWeaponTextures(this);
      buildFxTextures(this);
      buildHudTextures(this);
      const z = buildZombieAtlas();
      const tex = this.textures.addCanvas(ZOMBIE_ATLAS, z.canvas)!;
      for (const f of z.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);

      // Crop the supplied button sheet into five frames. The labels are baked
      // into the art; artButton() draws the slices without any text overlay.
      const buttons = this.textures.get(MENU_BUTTONS_TEXTURE);
      buttons.add(MENU_BUTTON_FRAMES.continue, 0, 266, 50, 1002, 168);
      buttons.add(MENU_BUTTON_FRAMES.newGame, 0, 266, 269, 1002, 157);
      buttons.add(MENU_BUTTON_FRAMES.armory, 0, 266, 458, 1002, 136);
      buttons.add(MENU_BUTTON_FRAMES.settings, 0, 263, 630, 1005, 130);
      buttons.add(MENU_BUTTON_FRAMES.store, 0, 263, 790, 1005, 128);

      audio.setVolumes(SaveManager.load().volumes);
      // Build the audio graph and decode the supplied recordings while the
      // loading screen is up; playback still waits for the first gesture.
      audio.preload();
      console.info(`[fogline] assets generated in ${Math.round(performance.now() - t0)} ms`);
      t.destroy();
      this.scene.start('Menu');
    });
  }
}
