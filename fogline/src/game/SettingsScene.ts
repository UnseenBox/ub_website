import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { profile } from '../systems/Profile';
import { slider, toggleFullscreen } from '../ui/widgets';
import { C, STENCIL, box, pushButton, text } from '../ui/kit';
import { icon } from '../ui/icons';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import { isTouchDevice } from './touchControls';

/** Menu-only settings: volume and fullscreen. The game is not running yet. */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create(): void {
    this.scene.pause('Menu');
    this.input.setDefaultCursor('default');
    backdrop(this, 0x000000, 0.7).setInteractive();

    const w = 460, h = 400;
    const x0 = (VIEW.width - w) / 2;
    const y0 = (VIEW.height - h) / 2;
    box(this, x0, y0, w, h, C.night, C.lineStrong);
    icon(this, 'gear', VIEW.centerX - 108, y0 + 42, 36, C.text);
    text(this, VIEW.centerX + 22, y0 + 42, 'SETTINGS', { size: 40, font: STENCIL, color: C.title }).setOrigin(0.5);

    const save = profile.get();
    const set = (key: 'master' | 'sfx' | 'music', value: number): void => {
      audio.setVolumes({ [key]: value });
      profile.update((d) => { d.volumes[key] = value; });
    };
    const sx = x0 + 60;
    slider(this, sx, y0 + 110, 280, 'MASTER', save.volumes.master, (v) => set('master', v), 5);
    slider(this, sx, y0 + 162, 280, 'EFFECTS', save.volumes.sfx, (v) => set('sfx', v), 5);
    slider(this, sx, y0 + 214, 280, 'MUSIC', save.volumes.music, (v) => set('music', v), 5);

    const touch = isTouchDevice();
    pushButton(this, VIEW.centerX, y0 + 278, { w: 340, h: 50, size: 24, icon: 'plus', label: 'FULLSCREEN', key: touch ? undefined : 'F', onClick: () => toggleFullscreen(this) });
    pushButton(this, VIEW.centerX, y0 + 342, { w: 340, h: 50, size: 24, icon: 'back', label: 'BACK', key: touch ? undefined : 'ESC', onClick: () => this.close() });

    this.input.keyboard!.on('keydown-F', () => toggleFullscreen(this));
    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume('Menu');
  }
}
