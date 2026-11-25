import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { profile } from '../systems/Profile';
import { MONO, STENCIL, button, slider, toggleFullscreen } from '../ui/widgets';
import { VIEW } from './config';
import type { GameScene } from './GameScene';
import { keyHint } from './touchControls';

/** Pause overlay with volume controls, fullscreen, restart and quit. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const game = this.scene.get('Game') as GameScene;
    this.input.setDefaultCursor('default');
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.6).setOrigin(0).setInteractive();
    const W = 460, H = 480, x0 = (VIEW.width - W) / 2, y0 = (VIEW.height - H) / 2;
    this.add.rectangle(x0, y0, W, H, 0x1c1d1c, 0.97).setOrigin(0).setStrokeStyle(2, 0x050505);
    this.add.rectangle(x0, y0, W, 4, 0x5a5c58).setOrigin(0);
    this.add.text(VIEW.centerX, y0 + 36, 'PAUSED', { fontFamily: STENCIL, fontSize: '38px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    const save = profile.get();
    const set = (k: 'master' | 'sfx' | 'music', v: number) => {
      audio.setVolumes({ [k]: v });
      profile.update((d) => { d.volumes[k] = v; });
    };
    slider(this, x0 + 60, y0 + 104, 280, 'MASTER VOLUME', save.volumes.master, (v) => set('master', v), 5);
    slider(this, x0 + 60, y0 + 154, 280, 'SFX VOLUME', save.volumes.sfx, (v) => { set('sfx', v); }, 5);
    slider(this, x0 + 60, y0 + 204, 280, 'MUSIC / AMBIENCE', save.volumes.music, (v) => set('music', v), 5);

    // Radio log: the last few lines in full. Everything on screen during play is shortened; this is where the rest is.
    const logLines = game.radioLog.slice(-5);
    const logParts: Phaser.GameObjects.GameObject[] = [];
    logParts.push(this.add.rectangle(x0, y0, W, H, 0x1c1d1c, 0.98).setOrigin(0).setStrokeStyle(2, 0x050505).setInteractive());
    logParts.push(this.add.text(VIEW.centerX, y0 + 30, 'RADIO LOG', { fontFamily: STENCIL, fontSize: '30px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
    logParts.push(this.add.text(x0 + 28, y0 + 74, logLines.length ? logLines.map((l) => `${l.who}: ${l.text}`).join('\n\n') : 'Nothing on the radio yet.', {
      fontFamily: MONO, fontSize: '13px', color: '#d0ccb4', wordWrap: { width: W - 56 }, lineSpacing: 2,
    }));
    logParts.push(button(this, VIEW.centerX, y0 + H - 36, 200, 36, 'BACK', () => logPanel.setVisible(false), 10, 0x6a7a8a));
    const logPanel = this.add.container(0, 0, logParts).setDepth(20).setVisible(false);
    button(this, VIEW.centerX, y0 + 262, 300, 36, 'RADIO LOG', () => logPanel.setVisible(true), 10, 0x8a6a40);

    button(this, VIEW.centerX, y0 + 310, 300, 40, keyHint('RESUME', 'ESC'), () => this.resume(), 10);
    button(this, VIEW.centerX, y0 + 358, 300, 36, keyHint('FULLSCREEN', 'F'), () => toggleFullscreen(this), 10, 0x6a7a8a);
    button(this, VIEW.centerX, y0 + 402, 300, 36, 'RESTART MISSION', () => {
      const missionId = game.mission.id;
      this.scene.stop();
      game.scene.stop();
      this.scene.start('Game', { missionId });
    }, 10, 0xc84030);
    button(this, VIEW.centerX, y0 + 446, 300, 36, 'QUIT TO MENU', () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, 10, 0x5a5a50);
    this.add.text(VIEW.centerX, y0 + H + 18, 'Volume changes apply immediately.', { fontFamily: MONO, fontSize: '12px', color: '#8a8a76' }).setOrigin(0.5);

    this.input.keyboard!.on('keydown-ESC', () => this.resume());
    this.input.keyboard!.on('keydown-P', () => this.resume());
    this.input.keyboard!.on('keydown-F', () => toggleFullscreen(this));
  }

  private resume(): void {
    const game = this.scene.get('Game') as GameScene;
    this.scene.stop();
    game.resumeFromOverlay();
    game.input.setDefaultCursor('none');
  }
}
