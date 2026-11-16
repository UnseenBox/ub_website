import Phaser from 'phaser';
import { PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { CATEGORY_STYLE, CONDITIONS, type FindDef } from '../data/finds';
import type { FindItem } from '../systems/FindSystem';
import { ensureFindTexture } from '../art/FindArt';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { formatMoney } from './MoneyCounter';

const CARD_H = 112;
const INK = '#3b2616';

/**
 * The "what did I just dig up?!" card. It slides in over the top of the play area,
 * never pauses the game, and goes away by itself (or on a tap).
 *
 * It only ever NAMES a find. Nothing is paid: an artifact shows what it would sell
 * for, but the money only arrives when the player sells it from the Finds screen.
 */
export class FindCard extends Phaser.GameObjects.Container {
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

  show(def: FindDef, item: FindItem, first: boolean, maxWidth: number): void {
    this.hideTimer?.remove();
    this.scene.tweens.killTweensOf(this);
    this.inner?.destroy();
    this.removeAll(true);

    const scene = this.scene;
    const w = Math.min(390, maxWidth);
    const cat = CATEGORY_STYLE[def.category];
    const inner = scene.add.container(0, 0);
    this.inner = inner;
    this.add(inner);

    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 3, 9, w, CARD_H, 20);
    g.fillStyle(0xfff3dc).fillRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(5, cat.color).strokeRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(-w / 2 - 2, -2, w + 4, CARD_H + 4, 22);
    inner.add(g);

    // Rarity as stars on the frame - no words. Rubbish has no rarity.
    if (def.category !== 'junk') {
      const n = def.tier + 1;
      for (let i = 0; i < n; i++) {
        inner.add(scene.add.image(w / 2 - 20 - (n - 1 - i) * 19, 20, ICON_STAR).setDisplaySize(22, 22));
      }
    }

    // The picture.
    const icon = scene.add.image(-w / 2 + 62, CARD_H / 2 + 4, ensureFindTexture(scene.textures, def));
    icon.setScale(92 / Math.max(icon.width, icon.height, 1));
    inner.add(icon);

    // Name: one line, shrunk to fit when it is long.
    const textX = -w / 2 + 122;
    const textW = w - 122 - 18;
    const name = scene.add.text(textX, 50, def.name, textStyle(21, INK)).setOrigin(0, 0.5);
    if (name.width > textW) name.setScale(textW / name.width);
    inner.add(name);

    // Bottom row: the category chip, then what matters for this kind of find.
    const rowY = CARD_H - 24;
    const chipText = scene.add.text(0, rowY, cat.label, textStyle(11, INK)).setOrigin(0, 0.5);
    const chipW = chipText.width + 16;
    const chip = scene.add.graphics();
    chip.fillStyle(cat.color).fillRoundedRect(textX, rowY - 10, chipW, 20, 10);
    chip.lineStyle(2, 0x3b2616, 0.6).strokeRoundedRect(textX, rowY - 10, chipW, 20, 10);
    chipText.setPosition(textX + 8, rowY);
    inner.add([chip, chipText]);

    if (def.category === 'artifact') {
      // Condition, and what it would fetch when sold (it is NOT paid now).
      inner.add(scene.add.text(textX + chipW + 10, rowY, CONDITIONS[item.condition].label, textStyle(15, INK)).setOrigin(0, 0.5));
      const price = scene.add.text(w / 2 - 20, rowY, formatMoney(item.value), outlinedStyle(20, PALETTE.money)).setOrigin(1, 0.5);
      const coin = scene.add.image(price.x - price.width - 14, rowY, uiIcon('cash')).setDisplaySize(22, 22);
      inner.add([coin, price]);
    } else if (def.category === 'collection' && first) {
      const mark = scene.add.container(w / 2 - 20, rowY);
      const label = scene.add.text(0, 0, 'NEW', outlinedStyle(16, '#8dff9a')).setOrigin(1, 0.5);
      const star = scene.add.image(-label.width - 16, 0, uiIcon('sparkle')).setDisplaySize(20, 20);
      mark.add([star, label]);
      inner.add(mark);
      scene.tweens.add({ targets: mark, scale: { from: 1, to: 1.14 }, duration: 380, yoyo: true, repeat: -1 });
    }

    // Tap to dismiss.
    this.setSize(w, CARD_H);
    this.removeInteractive();
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, 0, w, CARD_H), Phaser.Geom.Rectangle.Contains);
    this.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.hide());

    this.setVisible(true).setAlpha(0).setPosition(this.x, this.baseY - 40);
    this.setScale(0.85);
    scene.tweens.add({ targets: this, alpha: 1, y: this.baseY, scale: 1, duration: 320, ease: 'Back.easeOut' });
    // A little jiggle on the picture so it feels alive.
    scene.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 420, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    this.hideTimer = scene.time.delayedCall(def.category !== 'junk' && def.tier >= 3 ? 4200 : 3000, () => this.hide());
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
