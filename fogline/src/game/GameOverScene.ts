import Phaser from 'phaser';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';
import type { RunSummary } from './GameScene';

/** Defeat / victory overlay with run stats and a restart. */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: RunSummary): void {
    this.input.setDefaultCursor('default');
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, data.victory ? 0x000000 : 0x1a0000, 0.72).setOrigin(0).setInteractive();
    this.add.text(VIEW.centerX, 170, data.victory ? 'THE LINE HELD' : 'BUNKER OVERRUN', {
      fontFamily: STENCIL, fontSize: '78px', color: data.victory ? '#d8e0b0' : '#d84030', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);
    this.add.text(VIEW.centerX, 236, data.victory ? 'All eight waves repelled. The fog thins — for now.' : `The dead broke through on wave ${data.wave}.`, {
      fontFamily: MONO, fontSize: '16px', color: '#b8b4a0',
    }).setOrigin(0.5);
    const rows = [
      ['WAVE REACHED', `${data.wave} / 8`],
      ['KILLS', `${data.kills}`],
      ['HEADSHOT KILLS', `${data.headshots}`],
      ['ACCURACY', `${Math.round(data.accuracy * 100)}%`],
      ['CASH EARNED', `$${data.earned.toLocaleString('en-US')}`],
    ];
    this.add.rectangle(VIEW.centerX, 370, 420, 180, 0x0c0d0c, 0.85).setStrokeStyle(1, 0x4a4c48);
    rows.forEach(([k, v], i) => {
      this.add.text(VIEW.centerX - 180, 296 + i * 30, k, { fontFamily: MONO, fontSize: '16px', color: '#9a9a86' });
      this.add.text(VIEW.centerX + 180, 296 + i * 30, v, { fontFamily: MONO, fontSize: '16px', color: '#e0dcc0' }).setOrigin(1, 0);
    });
    const restart = () => {
      this.scene.stop('Game');
      this.scene.stop();
      this.scene.start('Game');
    };
    button(this, VIEW.centerX, 510, 300, 50, 'REDEPLOY  [ENTER]', restart, 10, 0xc84030);
    button(this, VIEW.centerX, 568, 300, 38, 'MAIN MENU', () => {
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, 10, 0x5a5a50);
    this.input.keyboard!.on('keydown-ENTER', restart);
  }
}
