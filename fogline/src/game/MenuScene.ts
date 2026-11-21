import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { MONO, button, toggleFullscreen } from '../ui/widgets';
import { VIEW } from './config';
import { isTestMode } from './testMode';
import { MENU_BG_TEXTURE } from './textureKeys';
import { keyHint } from './touchControls';

/** Title screen. The DEPLOY click is also the user gesture that unlocks audio. */
export class MenuScene extends Phaser.Scene {
  private wind: LoopHandle | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.add.image(0, 0, MENU_BG_TEXTURE).setOrigin(0).setDisplaySize(VIEW.width, VIEW.height);
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.25).setOrigin(0);

    button(this, VIEW.centerX, 320, 280, 58, 'DEPLOY', () => this.deploy(), 10);
    button(this, VIEW.centerX, 392, 280, 42, keyHint('FULLSCREEN', 'F'), () => toggleFullscreen(this), 10, 0x6a7a8a);
    if (isTestMode()) {
      this.add.text(VIEW.centerX, 430, 'TEST MODE — ALL WEAPONS & GEAR UNLOCKED', {
        fontFamily: MONO, fontSize: '12px', color: '#c8a040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    const save = SaveManager.load();
    if (save.bestWave > 0) {
      this.add.text(VIEW.centerX, 610, `BEST: WAVE ${save.bestWave}  ·  ${save.bestKills} KILLS`, {
        fontFamily: MONO, fontSize: '14px', color: '#8a8a76',
      }).setOrigin(0.5);
    }
    this.add.text(VIEW.width - 12, VIEW.height - 10, 'original prototype · supplied art and audio', {
      fontFamily: MONO, fontSize: '11px', color: '#5a5a50',
    }).setOrigin(1, 1);

    // Synthesize the sound bank while the player reads the title screen.
    this.time.delayedCall(120, () => audio.prepare());
    this.input.keyboard!.on('keydown-ENTER', () => this.deploy());
    this.input.keyboard!.on('keydown-F', () => toggleFullscreen(this));
    this.input.once('pointerdown', () => {
      audio.unlock();
      if (!this.wind) this.wind = audio.loop('wind_loop', 0.5, 'music', 1.5);
    });
    this.events.once('shutdown', () => {
      this.wind?.stop(0.5);
      this.wind = null;
    });
  }

  override update(_t: number, dms: number): void {
    const c = this.children.getByName('clouds') as Phaser.GameObjects.TileSprite | null;
    if (c) c.tilePositionX += (dms / 1000) * 4;
  }

  private deploy(): void {
    audio.unlock();
    audio.play('radio', { volume: 0.6 });
    this.scene.start('Game');
  }
}
