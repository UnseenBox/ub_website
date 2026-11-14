import Phaser from 'phaser';
import { PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { CURIO_CATEGORIES, CURIO_TIER_LABELS, type CurioDef } from '../data/curios';
import { RARITIES } from '../data/rarities';
import { curioKey } from '../art/CurioArt';
import { formatMoney } from './MoneyCounter';

const CARD_H = 138;
const INK = '#3b2616';
const SOFT = '#7a5a3a';

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
    const tierColor = RARITIES[Math.min(curio.tier, 4)].color;
    const inner = this.scene.add.container(0, 0);
    this.inner = inner;
    this.add(inner);

    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 3, 9, w, CARD_H, 20);
    g.fillStyle(0xfff3dc).fillRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(5, cat.color).strokeRoundedRect(-w / 2, 0, w, CARD_H, 20);
    g.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(-w / 2 - 2, -2, w + 4, CARD_H + 4, 22);
    inner.add(g);

    // Category + tier tags sit on the top edge.
    const tag = this.scene.add.text(0, 0, cat.label, outlinedStyle(14, '#ffffff')).setOrigin(0, 0.5);
    tag.setStroke(cat.css, 4);
    const tagBg = this.scene.add.graphics();
    const tw = tag.width + 22;
    tagBg.fillStyle(parseInt(cat.css.slice(1), 16)).fillRoundedRect(-w / 2 + 16, -13, tw, 26, 13);
    tagBg.lineStyle(2, 0x3b2616, 0.7).strokeRoundedRect(-w / 2 + 16, -13, tw, 26, 13);
    tag.setPosition(-w / 2 + 27, 0);
    const tierTxt = this.scene.add.text(0, 0, CURIO_TIER_LABELS[curio.tier].toUpperCase(), outlinedStyle(13, '#ffffff')).setOrigin(1, 0.5);
    tierTxt.setStroke(RARITIES[Math.min(curio.tier, 4)].css, 4);
    const tierBg = this.scene.add.graphics();
    const tbw = tierTxt.width + 22;
    tierBg.fillStyle(tierColor).fillRoundedRect(w / 2 - 16 - tbw, -13, tbw, 26, 13);
    tierBg.lineStyle(2, 0x3b2616, 0.7).strokeRoundedRect(w / 2 - 16 - tbw, -13, tbw, 26, 13);
    tierTxt.setPosition(w / 2 - 27, 0);
    inner.add([tagBg, tag, tierBg, tierTxt]);

    // Sticker.
    const icon = this.scene.add.image(-w / 2 + 62, CARD_H / 2 + 4, curioKey(curio.id));
    icon.setScale(96 / Math.max(icon.width, icon.height, 1));
    inner.add(icon);

    const textX = -w / 2 + 122;
    const textW = w - 122 - 18;
    const name = this.scene.add.text(textX, 28, curio.name, { ...textStyle(22, INK), wordWrap: { width: textW } }).setOrigin(0, 0);
    const line = this.scene.add.text(textX, 28 + name.height + 2, curio.line, { ...textStyle(14, SOFT), wordWrap: { width: textW }, lineSpacing: 1 }).setOrigin(0, 0);
    const pay = this.scene.add.text(textX, CARD_H - 30, `+${formatMoney(value)}`, outlinedStyle(22, PALETTE.money)).setOrigin(0, 0.5);
    inner.add([name, line, pay]);
    if (first) {
      const nb = this.scene.add.text(w / 2 - 20, CARD_H - 30, 'NEW!  x2', outlinedStyle(18, '#8dff9a')).setOrigin(1, 0.5);
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
