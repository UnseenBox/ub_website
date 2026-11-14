import Phaser from 'phaser';
import { PALETTE, outlinedStyle } from '../config/Theme';

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Money pill with a smoothly counting value. */
export class MoneyCounter extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly counter = { value: 0 };
  private countTween: Phaser.Tweens.Tween | null = null;
  private h = 44;
  private drawnWidth = 0;

  constructor(scene: Phaser.Scene, initial: number) {
    super(scene, 0, 0);
    this.counter.value = initial;
    this.bg = scene.add.graphics();
    this.coin = scene.add.image(0, 0, 'coin');
    this.text = scene.add.text(0, 0, formatMoney(initial), outlinedStyle(22, PALETTE.money)).setOrigin(0, 0.5);
    this.add([this.bg, this.coin, this.text]);
    scene.add.existing(this);
  }

  layout(x: number, y: number, h: number): void {
    this.h = h;
    this.setPosition(x, y);
    this.coin.setScale((h * 0.9) / 52).setPosition(h * 0.5, 0);
    this.text.setFontSize(Math.round(h * 0.52)).setPosition(h * 0.98, -1);
    this.drawnWidth = 0;
    this.redrawBg();
  }

  /** Screen position where flying coins should land. */
  get coinTarget(): { x: number; y: number } {
    return { x: this.x + this.coin.x, y: this.y + this.coin.y };
  }

  countTo(value: number, delay: number, duration: number): void {
    this.countTween?.remove();
    this.countTween = this.scene.tweens.add({
      targets: this.counter,
      value,
      delay,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.text.setText(formatMoney(this.counter.value));
        this.redrawBg();
      },
    });
  }

  pulse(): void {
    this.scene.tweens.add({ targets: this.coin, scale: { from: (this.h * 1.15) / 52, to: (this.h * 0.9) / 52 }, duration: 160 });
    this.scene.tweens.add({ targets: this.text, scale: { from: 1.12, to: 1 }, duration: 160 });
  }

  private redrawBg(): void {
    const w = Math.max(this.h * 3, this.text.x + this.text.width + this.h * 0.4);
    if (Math.abs(w - this.drawnWidth) < 1) return;
    this.drawnWidth = w;
    const h = this.h;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25).fillRoundedRect(0, -h / 2 + 3, w, h, h / 2);
    this.bg.fillStyle(PALETTE.tray, 0.85).fillRoundedRect(0, -h / 2, w, h, h / 2);
    this.bg.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(0, -h / 2, w, h, h / 2);
  }
}
