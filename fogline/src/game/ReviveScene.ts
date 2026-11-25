import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { REVIVE_SHARE } from '../portal/adRules';
import { portal } from '../portal/Portal';
import { MONO, STENCIL, button } from '../ui/widgets';
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
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x1a0000, 0.75).setOrigin(0).setInteractive();
    this.add.rectangle(VIEW.centerX, VIEW.height / 2, 640, 300, 0x1c1d1a, 0.98).setStrokeStyle(2, 0xc84030);
    this.add.text(VIEW.centerX, VIEW.height / 2 - 104, 'THE WALL IS DOWN', { fontFamily: STENCIL, fontSize: '40px', color: '#d84030', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.add.text(VIEW.centerX, VIEW.height / 2 - 50,
      `Kestrel can drop reinforcements: watch an ad to restore ${Math.round(REVIVE_SHARE * 100)}% of the bunker\nand keep fighting. Once per mission.`, {
        fontFamily: MONO, fontSize: '15px', color: '#d0ccb4', align: 'center', lineSpacing: 4,
      }).setOrigin(0.5, 0);
    button(this, VIEW.centerX - 150, VIEW.height / 2 + 90, 270, 50, 'REINFORCE  ▶ AD', () => {
      if (this.busy) return;
      this.busy = true;
      const ok = portal.rewarded(() => audio.play('buy', { volume: 0.8 }), (granted) => close(granted));
      if (!ok) close(false);
    }, 10, 0x4a8ac8);
    button(this, VIEW.centerX + 150, VIEW.height / 2 + 90, 270, 50, 'GIVE UP', () => {
      if (this.busy) return;
      this.busy = true;
      close(false);
    }, 10, 0x8a4a40);
  }
}
