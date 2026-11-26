import Phaser from 'phaser';
import m1aViewUrl from '../assets/m1a-view.webp';
import m4ViewUrl from '../assets/m4-view.webp';
import m249ViewUrl from '../assets/m249-view.webp';
import m32ViewUrl from '../assets/m32-view.webp';
import shotgunViewUrl from '../assets/shotgun-view.webp';
import m82ViewUrl from '../assets/m82-view.webp';
import menuBgUrl from '../assets/main-menu.webp';
import mapValleyUrl from '../assets/map-valley.webp';
import menuButtonsUrl from '../assets/menu-buttons.webp';
import zombieSheetUrl from '../assets/zombie-parts.webp';
import bruteSheetUrl from '../assets/brute-parts.webp';
import { audio } from '../audio/AudioManager';
import { buildEnvironmentTextures } from '../rendering/EnvironmentArt';
import { buildFxTextures } from '../rendering/FxArt';
import { buildAct3Textures } from '../rendering/Act3Art';
import { buildAct4Textures } from '../rendering/Act4Art';
import { portal } from '../portal/Portal';
import { loadGameFonts } from '../ui/fonts';
import { buildLocationTextures } from '../rendering/LocationArt';
import { buildWeaponTextures } from '../rendering/WeaponArt';
import { ZOMBIE_ATLAS, buildZombieAtlas } from '../rendering/ZombieArt';
import { FIGURES } from '../rendering/figures';
import { CREATURES, atlasKey } from '../puppet/index';
import { profile } from '../systems/Profile';
import { VIEW } from './config';
import { MAP_VALLEY_ART, MENU_BG_TEXTURE, MENU_BUTTON_FRAMES, MENU_BUTTONS_TEXTURE } from './textureKeys';
import { buildValleyMap } from '../rendering/ValleyMap';

/** The creature part atlases, by file path. */
const puppetAtlases = import.meta.glob('../assets/puppets/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Paints every procedural texture and synthesizes the sound bank. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Supplied bitmaps; everything else is generated below.
    this.load.image('view_service_photo', m1aViewUrl);
    this.load.image('view_m4_photo', m4ViewUrl);
    this.load.image('view_m249_photo', m249ViewUrl);
    this.load.image('view_m32_photo', m32ViewUrl);
    this.load.image('view_shotgun_photo', shotgunViewUrl);
    this.load.image('view_m82_photo', m82ViewUrl);
    this.load.image(MENU_BG_TEXTURE, menuBgUrl);
    this.load.image(MAP_VALLEY_ART, mapValleyUrl);
    this.load.image(MENU_BUTTONS_TEXTURE, menuButtonsUrl);
    this.load.image(FIGURES.shambler.texture, zombieSheetUrl);
    this.load.image(FIGURES.brute.texture, bruteSheetUrl);
    for (const look of Object.keys(CREATURES)) this.load.image(atlasKey(look), puppetAtlases[`../assets/puppets/${look}.webp`]);
  }

  create(): void {
    portal.loadingStart();
    const t = this.add.text(VIEW.centerX, VIEW.height / 2, 'ESTABLISHING PERIMETER…', {
      fontFamily: '"Saira", sans-serif', fontSize: '18px', color: '#9a9a86',
    }).setOrigin(0.5);
    // let the loading text render before the heavy synchronous work
    // The fonts are loaded before any text or canvas label is drawn, so none falls back.
    void loadGameFonts().then(() => this.time.delayedCall(40, () => {
      const t0 = performance.now();
      buildEnvironmentTextures(this);
      buildValleyMap(this);
      buildLocationTextures(this);
      buildAct3Textures(this);
      buildAct4Textures(this);
      buildWeaponTextures(this);
      buildFxTextures(this);
      const z = buildZombieAtlas();
      const tex = this.textures.addCanvas(ZOMBIE_ATLAS, z.canvas)!;
      for (const f of z.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
      for (const fig of Object.values(FIGURES)) {
        const figTex = this.textures.get(fig.texture);
        for (const f of Object.values(fig.parts)) figTex.add(f.name, 0, f.x, f.y, f.w, f.h);
      }

      // Crop the supplied button sheet into five frames. The labels are baked
      // into the art; artButton() draws the slices without any text overlay.
      const buttons = this.textures.get(MENU_BUTTONS_TEXTURE);
      buttons.add(MENU_BUTTON_FRAMES.continue, 0, 266, 50, 1002, 168);
      buttons.add(MENU_BUTTON_FRAMES.newGame, 0, 266, 269, 1002, 157);
      buttons.add(MENU_BUTTON_FRAMES.armory, 0, 266, 458, 1002, 136);
      buttons.add(MENU_BUTTON_FRAMES.settings, 0, 263, 630, 1005, 130);
      buttons.add(MENU_BUTTON_FRAMES.store, 0, 263, 790, 1005, 128);

      // Build the audio graph and decode the supplied recordings while the
      // loading screen is up; playback still waits for the first gesture.
      audio.preload();
      console.info(`[fogline] assets generated in ${Math.round(performance.now() - t0)} ms`);
      audio.setVolumes(profile.get().volumes);
      t.destroy();
      portal.loadingStop();
      this.scene.start('Menu');
    }));
  }
}
