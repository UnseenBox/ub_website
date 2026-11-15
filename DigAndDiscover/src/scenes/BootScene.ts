import Phaser from 'phaser';
import { createSharedTextures } from '../art/TextureFactory';
import { createStoreTextures, loadStoreOverrides } from '../art/StoreArt';
import { createIconTextures } from '../art/IconArt';
import { paintUiIcons } from '../art/UiIcons';
import coinUrl from '../assets/ui/coin.png';
import aboveSurfaceUrl from '../assets/world/above-surface.jpg';
import { loadShovelImages } from '../art/ShovelArt';
import { loadRockSprites } from '../art/RockSprites';
import storeIconUrl from '../assets/ui/icons/store.png';
import goalsIconUrl from '../assets/ui/icons/goals.png';
import workshopIconUrl from '../assets/ui/icons/workshop.png';
import pauseIconUrl from '../assets/ui/icons/pause.png';
import ledgerIconUrl from '../assets/ui/icons/ledger.png';
import albumIconUrl from '../assets/ui/icons/album.png';
import playIconUrl from '../assets/ui/icons/play.png';
import refillIconUrl from '../assets/ui/icons/refill.png';
import returnIconUrl from '../assets/ui/icons/return.png';
import crossIconUrl from '../assets/ui/icons/cross.png';
import collectIconUrl from '../assets/ui/icons/collect.png';
import workshopBgUrl from '../assets/world/workshop-bg.jpg';
import trayUrl from '../assets/ui/rocks-tray.png';
import machineUrl from '../assets/workshop/machine.png';
import sawUrl from '../assets/workshop/saw.png';

/** Paints every shared texture once, then drops straight into gameplay. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // The supplied pickaxe coin replaces the painted one (see TextureFactory).
    this.load.image('coin', coinUrl);
    loadShovelImages(this.load);
    loadRockSprites(this.load);
    // Supplied icons replace the painted ones of the same name (ui-store, ui-target) and add two more.
    this.load.image('ui-store', storeIconUrl);
    this.load.image('ui-target', goalsIconUrl);
    this.load.image('ui-workshop', workshopIconUrl);
    this.load.image('ui-pause', pauseIconUrl);
    this.load.image('ui-ledger', ledgerIconUrl);
    this.load.image('ui-album', albumIconUrl);
    // Every play triangle in the game is this wooden one.
    this.load.image('ui-play', playIconUrl);
    this.load.image('ui-refill', refillIconUrl);
    // Back to the dig site, cancel (every X in the game) and "collect the money" in the workshop.
    this.load.image('ui-return', returnIconUrl);
    this.load.image('ui-cross', crossIconUrl);
    this.load.image('ui-collect', collectIconUrl);
    this.load.image('workshop-bg', workshopBgUrl);
    // The bag panel: stamina bar, five slots and the plank that holds the rock count.
    this.load.image('rocks-tray', trayUrl);
    // The saw machine: the wooden frame and the circular blade are separate pictures.
    this.load.image('machine-art', machineUrl);
    this.load.image('saw-art', sawUrl);
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
