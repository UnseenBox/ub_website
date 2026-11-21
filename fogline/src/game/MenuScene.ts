import Phaser from 'phaser';
import { audio, LoopHandle } from '../audio/AudioManager';
import { SaveManager } from '../systems/SaveManager';
import { MONO, STENCIL, button, toggleFullscreen } from '../ui/widgets';
import { VIEW } from './config';
import { isTestMode } from './testMode';

/** Title screen. The DEPLOY click is also the user gesture that unlocks audio. */
export class MenuScene extends Phaser.Scene {
  private wind: LoopHandle | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.add.image(0, 0, 'backdrop').setOrigin(0);
    this.add.tileSprite(0, 0, VIEW.width, 190, 'clouds').setOrigin(0).setName('clouds');
    this.add.image(0, VIEW.horizonY, 'ground').setOrigin(0);
    this.add.image(0, VIEW.wallTop - 26, 'parapet').setOrigin(0);
    this.add.image(0, 0, 'frame').setOrigin(0);
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.45).setOrigin(0);

    this.add.text(VIEW.centerX, 150, 'FOGLINE', {
      fontFamily: STENCIL, fontSize: '112px', color: '#d8d4bc', stroke: '#0a0a0a', strokeThickness: 10,
    }).setOrigin(0.5).setShadow(0, 6, '#000', 12, true, true);
    this.add.text(VIEW.centerX, 226, 'HOLD THE BUNKER  ·  EIGHT NIGHTS OF THE DEAD', {
      fontFamily: MONO, fontSize: '16px', color: '#a8a48c', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    button(this, VIEW.centerX, 320, 280, 58, 'DEPLOY', () => this.deploy(), 10);
    button(this, VIEW.centerX, 392, 280, 42, 'FULLSCREEN  [F]', () => toggleFullscreen(this), 10, 0x6a7a8a);
    if (isTestMode()) {
      this.add.text(VIEW.centerX, 430, 'TEST MODE — ALL WEAPONS & GEAR UNLOCKED', {
        fontFamily: MONO, fontSize: '12px', color: '#c8a040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    const controls = [
      'MOUSE          aim  ·  LMB fire  ·  RMB / R reload',
      '1 2 3 4        weapons          5 6 7 8   ammo mods',
      'A S D          gunship · orbital · nuke',
      'W E            repair crew · blast shutters',
      'SPACE          armory (pauses)    ENTER  next wave',
      'ESC / P        pause & settings   F      fullscreen',
    ];
    this.add.rectangle(VIEW.centerX, 520, 620, 150, 0x0c0d0c, 0.75).setStrokeStyle(1, 0x4a4c48);
    this.add.text(VIEW.centerX - 290, 452, controls.join('\n'), {
      fontFamily: MONO, fontSize: '14px', color: '#c8c8b0', lineSpacing: 6,
    });
    const save = SaveManager.load();
    if (save.bestWave > 0) {
      this.add.text(VIEW.centerX, 610, `BEST: WAVE ${save.bestWave}  ·  ${save.bestKills} KILLS`, {
        fontFamily: MONO, fontSize: '14px', color: '#8a8a76',
      }).setOrigin(0.5);
    }
    this.add.text(VIEW.width - 12, VIEW.height - 10, 'original prototype · all art and audio procedurally generated', {
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
