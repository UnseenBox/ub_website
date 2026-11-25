import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { profile } from '../systems/Profile';
import { MONO, STENCIL, button, slider, toggleFullscreen } from '../ui/widgets';
import { VIEW } from './config';

/** Menu-only settings: volume and fullscreen. The game is not running yet. */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    this.scene.pause('Menu');
    this.input.setDefaultCursor('default');
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.7).setOrigin(0).setInteractive();

    const w = 520, h = 380;
    const x0 = (VIEW.width - w) / 2;
    const y0 = (VIEW.height - h) / 2;
    this.add.rectangle(x0, y0, w, h, 0x1c1d1c, 0.97).setOrigin(0).setStrokeStyle(2, 0x050505);
    this.add.rectangle(x0, y0, w, 4, 0x5a5c58).setOrigin(0);
    this.add.text(VIEW.centerX, y0 + 34, 'SETTINGS', {
      fontFamily: STENCIL, fontSize: '38px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    const save = profile.get();
    const set = (key: 'master' | 'sfx' | 'music', value: number): void => {
      audio.setVolumes({ [key]: value });
      profile.update((d) => { d.volumes[key] = value; });
    };
    const sx = x0 + 70;
    slider(this, sx, y0 + 108, 300, 'MASTER VOLUME', save.volumes.master, (v) => set('master', v), 5);
    slider(this, sx, y0 + 158, 300, 'SFX VOLUME', save.volumes.sfx, (v) => set('sfx', v), 5);
    slider(this, sx, y0 + 208, 300, 'MUSIC / AMBIENCE', save.volumes.music, (v) => set('music', v), 5);

    button(this, VIEW.centerX, y0 + 268, 300, 40, 'FULLSCREEN  [F]', () => toggleFullscreen(this), 10);
    button(this, VIEW.centerX, y0 + 322, 300, 38, 'BACK  [ESC]', () => this.close(), 10, 0x6a7a8a);
    this.add.text(VIEW.centerX, y0 + h + 18, 'Volume changes apply immediately.', {
      fontFamily: MONO, fontSize: '12px', color: '#8a8a76',
    }).setOrigin(0.5);

    this.input.keyboard!.on('keydown-F', () => toggleFullscreen(this));
    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Menu');
  }
}
