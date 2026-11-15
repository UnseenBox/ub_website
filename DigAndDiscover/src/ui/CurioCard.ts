import Phaser from 'phaser';
import { PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { CURIO_CATEGORIES, type CurioDef } from '../data/curios';
import { ICON_STAR } from './../art/IconArt';
import { curioKey } from '../art/CurioArt';
import { formatMoney } from './MoneyCounter';

const CARD_H = 112;
const INK = '#3b2616';

/**
 * The "what did I just dig up?!" card. It slides in over the top of the play area,
 * never pauses the game, and goes away by itself (or on a tap).
 */
export class CurioCard extends Phaser.GameObjects.Container {
  private hideTimer: Phaser.Time.TimerEvent | null = null;
  private inner: Phaser.GameObjects.Container | null = null;
  private baseY = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setVisible(false).setDepth(45);
  }

  place(x: number, y: number): void {
    this.baseY = y;
    this.setPosition(x, y);
  }

  show(curio: CurioDef, first: boolean, value: number, maxWidth: number): void {
    this.hideTimer?.remove();
    this.scene.tweens.killTweensOf(this);
    this.inner?.destroy();
    this.removeAll(true);

    const w = Math.min(390, maxWidth);
    const cat = CURIO_CATEGORIES[curio.category];
    const inner = this.scene.add.container(0, 0);
    this.inner = inner;
    this.add(inner);

    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 3, 9, w, CARD_H, 20);
    g.fillStyle(0xfff3dc).fillRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(5, cat.color).strokeRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(-w / 2 - 2, -2, w + 4, CARD_H + 4, 22);
    inner.add(g);

    // Rarity as stars on the frame - no words.
    const n = curio.tier + 1;
    for (let i = 0; i < n; i++) {
      inner.add(this.scene.add.image(w / 2 - 22 - (n - 1 - i) * 21, 24, ICON_STAR).setDisplaySize(26, 26));
    }

    // Sticker.
    const icon = this.scene.add.image(-w / 2 + 62, CARD_H / 2 + 4, curioKey(curio.id));
    icon.setScale(96 / Math.max(icon.width, icon.height, 1));
    inner.add(icon);

    const textX = -w / 2 + 122;
    const textW = w - 122 - 18;
    const name = this.scene.add.text(textX, 30, curio.name, { ...textStyle(22, INK), wordWrap: { width: textW } }).setOrigin(0, 0);
    const pay = this.scene.add.text(textX, CARD_H - 30, `+${formatMoney(value)}`, outlinedStyle(22, PALETTE.money)).setOrigin(0, 0.5);
    inner.add([name, pay]);
    if (first) {
      const nb = this.scene.add.text(w / 2 - 20, CARD_H - 30, '\u2728 x2', outlinedStyle(18, '#8dff9a')).setOrigin(1, 0.5);
      inner.add(nb);
      this.scene.tweens.add({ targets: nb, scale: { from: 1, to: 1.18 }, duration: 380, yoyo: true, repeat: -1 });
    }

    // Tap to dismiss.
    this.setSize(w, CARD_H);
    this.removeInteractive();
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, 0, w, CARD_H), Phaser.Geom.Rectangle.Contains);
    this.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.hide());

    this.setVisible(true).setAlpha(0).setPosition(this.x, this.baseY - 40);
    this.setScale(0.85);
    this.scene.tweens.add({ targets: this, alpha: 1, y: this.baseY, scale: 1, duration: 320, ease: 'Back.easeOut' });
    // A little jiggle on the sticker so it feels alive.
    this.scene.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 420, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    this.hideTimer = this.scene.time.delayedCall(curio.tier >= 3 ? 4200 : 3000, () => this.hide());
  }

  hide(): void {
    this.hideTimer?.remove();
    if (!this.visible) return;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, alpha: 0, y: this.baseY - 24, duration: 240, ease: 'Quad.easeIn',
      onComplete: () => this.setVisible(false),
    });
    this.disableInteractive();
  }
}
