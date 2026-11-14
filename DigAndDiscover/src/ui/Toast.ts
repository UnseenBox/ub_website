import Phaser from 'phaser';
import { PALETTE, textStyle } from '../config/Theme';

/** A single reusable message bubble. */
export class Toast extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private baseY = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', textStyle(18)).setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.setAlpha(0).setVisible(false);
    scene.add.existing(this);
  }

  place(x: number, y: number, fontSize: number): void {
    this.baseY = y;
    this.setPosition(x, y);
    this.text.setFontSize(fontSize);
  }

  show(message: string, durationMs = 1800): void {
    const repeat = this.visible && this.text.text === message;
    this.text.setText(message);
    const w = this.text.width + 36;
    const h = this.text.height + 16;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, h / 2);
    this.bg.fillStyle(PALETTE.tray, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.bg.lineStyle(2, PALETTE.gold, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.scene.tweens.killTweensOf(this);
    this.setVisible(true);
    if (repeat) {
      this.setAlpha(1).setY(this.baseY);
      this.scene.tweens.add({ targets: this, scale: { from: 1.1, to: 1 }, duration: 200 });
    } else {
      this.setScale(1).setY(this.baseY - 12).setAlpha(0);
      this.scene.tweens.add({ targets: this, y: this.baseY, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    }
    this.hideTimer?.remove();
    this.hideTimer = this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 250, onComplete: () => this.setVisible(false) });
    });
  }
}
