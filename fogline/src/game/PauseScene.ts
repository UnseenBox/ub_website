import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { profile } from '../systems/Profile';
import { slider, toggleFullscreen } from '../ui/widgets';
import { BODY, C, STENCIL, box, portraitTexture, pushButton, text } from '../ui/kit';
import { icon } from '../ui/icons';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import type { GameScene } from './GameScene';
import { isTouchDevice } from './touchControls';

/** Pause overlay with volume controls, fullscreen, restart and quit. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const game = this.scene.get('Game') as GameScene;
    this.input.setDefaultCursor('default');
    backdrop(this, 0x000000, 0.65).setInteractive();
    const W = 460, H = 560, x0 = (VIEW.width - W) / 2, y0 = (VIEW.height - H) / 2;
    box(this, x0, y0, W, H, C.night, C.lineStrong);
    icon(this, 'pause', VIEW.centerX - 96, y0 + 40, 34, C.text);
    text(this, VIEW.centerX + 16, y0 + 40, 'PAUSED', { size: 40, font: STENCIL, color: C.title }).setOrigin(0.5);

    const save = profile.get();
    const set = (k: 'master' | 'sfx' | 'music', v: number) => {
      audio.setVolumes({ [k]: v });
      profile.update((d) => { d.volumes[k] = v; });
    };
    slider(this, x0 + 60, y0 + 104, 280, 'MASTER', save.volumes.master, (v) => set('master', v), 5);
    slider(this, x0 + 60, y0 + 154, 280, 'EFFECTS', save.volumes.sfx, (v) => { set('sfx', v); }, 5);
    slider(this, x0 + 60, y0 + 204, 280, 'MUSIC', save.volumes.music, (v) => set('music', v), 5);

    // Radio log: the last few lines in full. Everything on screen during play is shortened; this is where the rest is.
    const logW = 640, lx = (VIEW.width - logW) / 2;
    const logParts: Phaser.GameObjects.GameObject[] = [];
    logParts.push(box(this, lx, y0, logW, H, C.night, C.brass).setInteractive());
    logParts.push(text(this, VIEW.centerX, y0 + 34, 'RADIO LOG', { size: 32, font: STENCIL, color: C.title }).setOrigin(0.5));
    let ly = y0 + 74;
    const lines = game.radioLog.slice(-5);
    if (!lines.length) logParts.push(icon(this, 'radio', VIEW.centerX, y0 + 240, 90, C.dim));
    for (const l of lines) {
      const who = text(this, lx + 84, ly, l.who, { size: 14, color: C.brass, bold: true, spacing: 2 });
      const said = text(this, lx + 84, ly + 18, l.text, { size: 16, font: BODY, wrap: logW - 110 });
      logParts.push(this.add.image(lx + 46, ly + 24, portraitTexture(this, l.who, 44)).setScale(0.5), who, said);
      ly += Math.max(56, said.height + 28);
    }
    logParts.push(pushButton(this, VIEW.centerX, y0 + H - 36, { w: 200, h: 46, icon: 'back', label: 'BACK', onClick: () => logPanel.setVisible(false) }).c);
    const logPanel = this.add.container(0, 0, logParts).setDepth(20).setVisible(false);

    const touch = isTouchDevice();
    const wide = 340;
    const at = (i: number): number => y0 + 268 + i * 60;
    pushButton(this, VIEW.centerX, at(0), { w: wide, h: 52, size: 26, icon: 'play', label: 'RESUME', key: touch ? undefined : 'ESC', tone: 'go', onClick: () => this.resume() });
    pushButton(this, VIEW.centerX, at(1), { w: wide, h: 48, size: 22, icon: 'radio', label: 'RADIO LOG', tone: 'brass', onClick: () => logPanel.setVisible(true) });
    pushButton(this, VIEW.centerX, at(2), { w: wide, h: 48, size: 22, icon: 'plus', label: 'FULLSCREEN', key: touch ? undefined : 'F', onClick: () => toggleFullscreen(this) });
    pushButton(this, VIEW.centerX, at(3), {
      w: wide, h: 48, size: 22, icon: 'replay', label: 'RESTART', onClick: () => {
        const missionId = game.mission.id;
        this.scene.stop();
        game.scene.stop();
        this.scene.start('Game', { missionId });
      },
    });
    pushButton(this, VIEW.centerX, at(4) - 4, {
      w: wide, h: 44, size: 20, icon: 'home', label: 'QUIT', onClick: () => {
        this.scene.stop('Game');
        this.scene.start('Menu');
      },
    });

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
