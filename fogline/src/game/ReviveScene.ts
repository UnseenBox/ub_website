import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { REVIVE_SHARE } from '../portal/adRules';
import { portal } from '../portal/Portal';
import { C, STENCIL, box, centreRow, chip, pushButton, text } from '../ui/kit';
import { icon } from '../ui/icons';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import type { GameScene } from './GameScene';

/**
 * "Last-second reinforcements": the bunker just fell, and a rewarded ad can bring half of
 * it back, once per mission. Only offered in a CrazyGames build with ads switched on.
 */
export class ReviveScene extends Phaser.Scene {
  private busy = false;

  constructor() {
    super('Revive');
  }

  create(): void {
    this.busy = false;
    this.input.setDefaultCursor('default');
    const game = this.scene.get('Game') as GameScene;
    const close = (restored: boolean): void => {
      this.scene.stop();
      game.reviveResult(restored);
    };
    backdrop(this, 0x1a0000, 0.75).setInteractive();
    const cy = VIEW.height / 2;
    box(this, VIEW.centerX - 300, cy - 170, 600, 340, C.night, C.goLine);
    text(this, VIEW.centerX, cy - 122, 'THE WALL IS DOWN', { size: 44, font: STENCIL, color: C.red }).setOrigin(0.5);
    icon(this, 'shield', VIEW.centerX, cy - 36, 84, C.health);
    // What the reinforcements bring: half the bunker back, once.
    centreRow([
      chip(this, { icon: 'shield', text: `+${Math.round(REVIVE_SHARE * 100)}%`, tone: 'green', size: 22 }),
      chip(this, { icon: 'replay', text: '×1', size: 22 }),
    ], VIEW.centerX, cy + 40);
    pushButton(this, VIEW.centerX - 140, cy + 112, {
      w: 250, h: 58, size: 24, icon: 'play', label: 'REINFORCE ▶ AD', tone: 'buy',
      onClick: () => {
        if (this.busy) return;
        this.busy = true;
        const ok = portal.rewarded(() => audio.play('buy', { volume: 0.8 }), (granted) => close(granted));
        if (!ok) close(false);
      },
    });
    pushButton(this, VIEW.centerX + 140, cy + 112, {
      w: 250, h: 58, size: 24, icon: 'cross', label: 'GIVE UP',
      onClick: () => {
        if (this.busy) return;
        this.busy = true;
        close(false);
      },
    });
  }
}
