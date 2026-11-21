import Phaser from 'phaser';
import { PALETTE, outlinedStyle } from '../config/Theme';
import { FEATURES } from '../config/features';
import { state } from '../core/GameState';
import { uiIcon } from '../art/UiIcons';

/**
 * Small HUD chip beside the level/goal pill: "Daily 1/3".
 *
 * It is deliberately narrow so it fits next to the existing HUD on a 360 px
 * phone. Tapping it opens the goals card, where the three goals are explained.
 */
export class DailyGoalChip extends Phaser.GameObjects.Container {
  private readonly inner: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly check: Phaser.GameObjects.Image;
  private pw = 108;
  private ph = 34;
  private shown = '';
  /** The HUD hides the chip while it is not important (phone workshop). */
  quiet = false;

  constructor(scene: Phaser.Scene, onPress: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(0, 0, uiIcon('target')).setOrigin(0.5);
    this.label = scene.add.text(0, 0, '', outlinedStyle(12, PALETTE.goldText)).setOrigin(0, 0.5);
    this.check = scene.add.image(0, 0, uiIcon('check')).setOrigin(0.5).setVisible(false);
    this.inner = scene.add.container(0, 0, [this.bg, this.icon, this.label, this.check]);
    this.add(this.inner);
    scene.add.existing(this);
    this.setSize(this.pw, this.ph); // a container needs a size before it can take input
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onPress);
    this.setVisible(false);
  }

  layout(x: number, y: number, w: number, h: number): void {
    this.pw = w;
    this.ph = h;
    // x, y is the centre; everything inside is drawn from the top-left corner.
    this.setPosition(x, y);
    this.inner.setPosition(-w / 2, -h / 2);
    this.setSize(w, h);
    (this.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.shown = '';
    this.refresh();
  }

  refresh(): void {
    const daily = state.daily;
    const visible = FEATURES.v2 && daily.total > 0 && !this.quiet;
    this.setVisible(visible);
    if (!visible) return;

    const { pw: w, ph: h } = this;
    const done = daily.done;
    const sig = `${daily.completedCount}/${daily.total}:${done}:${w}:${h}`;
    if (sig === this.shown) return;
    this.shown = sig;

    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.22).fillRoundedRect(0, 3, w, h, h / 2);
    g.fillStyle(PALETTE.tray, 0.88).fillRoundedRect(0, 0, w, h, h / 2);
    g.lineStyle(2, done ? PALETTE.gold : 0xffffff, done ? 0.9 : 0.12).strokeRoundedRect(0, 0, w, h, h / 2);

    const cy = h / 2;
    const iconX = h * 0.55;
    const iconSize = Math.round(h * 0.5);
    this.icon.setDisplaySize(iconSize, iconSize).setPosition(iconX, cy);

    const textX = iconX + h * 0.38;
    this.label
      .setFontSize(Math.max(10, Math.round(h * 0.32)))
      .setPosition(textX, cy)
      .setText(`Daily ${daily.completedCount}/${daily.total}`);
    // The text must stay inside the pill (and clear of the check mark): shrink it until it fits.
    const room = w - textX - h * (done ? 0.75 : 0.3);
    for (let size = Math.round(this.label.style.fontSize as unknown as number) || 12; size > 8 && this.label.width > room; size--) {
      this.label.setFontSize(size);
    }

    this.check
      .setDisplaySize(Math.round(h * 0.36), Math.round(h * 0.36))
      .setPosition(w - h * 0.36, cy)
      .setVisible(done);
  }

  /** A small pop when a daily goal completes. */
  bump(): void {
    this.scene.tweens.add({ targets: this, scale: { from: 1.08, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }
}
