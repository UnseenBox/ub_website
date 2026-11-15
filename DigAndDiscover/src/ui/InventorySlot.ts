import Phaser from 'phaser';
import { PALETTE, outlinedStyle } from '../config/Theme';
import { iconScale, rockKeys } from '../art/RockArt';
import type { Rock } from '../core/types';

export interface SlotDisplay {
  rock: Rock | null;
  /** Rock is still flying toward the slot: keep the icon hidden. */
  incoming: boolean;
  /** Rock is currently on the cutting bench. */
  onBench: boolean;
}

/** One bag slot: rounded card, rock icon, "?" badge for uncut rocks, rarity tag once cut. */
export class InventorySlot extends Phaser.GameObjects.Container {
  private readonly lift: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly tag: Phaser.GameObjects.Text;
  private size = 64;
  private display: SlotDisplay = { rock: null, incoming: false, onBench: false };
  private idleTween: Phaser.Tweens.Tween | null = null;
  /** Rock objects are mutated when cut, so the cut flag is tracked separately. */
  private shownCut = false;

  constructor(scene: Phaser.Scene, onPress: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.badge = scene.add.text(0, 0, '?', outlinedStyle(16, PALETTE.goldText)).setOrigin(0.5);
    this.tag = scene.add.text(0, 0, '', outlinedStyle(11)).setOrigin(0.5);
    this.lift = scene.add.container(0, 0, [this.bg, this.icon, this.badge, this.tag]);
    this.add(this.lift);
    scene.add.existing(this);
    this.setSize(this.size, this.size);
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onPress);
  }

  resizeSlot(size: number): void {
    this.size = size;
    this.setSize(size, size);
    (this.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, size, size);
    this.badge.setFontSize(Math.round(size * 0.26));
    this.tag.setFontSize(Math.max(10, Math.round(size * 0.16)));
    this.redraw();
  }

  show(display: SlotDisplay): void {
    const prev = this.display;
    const cut = !!display.rock?.cut;
    this.display = display;
    if (prev.rock !== display.rock || prev.incoming !== display.incoming || prev.onBench !== display.onBench || cut !== this.shownCut) {
      this.shownCut = cut;
      this.redraw();
    }
  }

  /** Squash-and-stretch when a rock lands. */
  bump(): void {
    this.scene.tweens.add({
      targets: this.lift,
      scaleX: { from: 1.25, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      duration: 380,
      ease: 'Elastic.easeOut',
      easeParams: [1.2, 0.5],
    });
  }

  wiggle(): void {
    this.scene.tweens.add({ targets: this.lift, angle: { from: -8, to: 0 }, duration: 300, ease: 'Elastic.easeOut' });
  }

  private redraw(): void {
    const s = this.size;
    const r = s * 0.22;
    const { rock, incoming, onBench } = this.display;
    const g = this.bg;
    g.clear();
    this.idleTween?.remove();
    this.idleTween = null;
    this.icon.setAngle(0);

    if (!rock) {
      g.fillStyle(0x000000, 0.28).fillRoundedRect(-s / 2, -s / 2, s, s, r);
      g.lineStyle(2, 0xffffff, 0.16).strokeRoundedRect(-s / 2, -s / 2, s, s, r);
      g.fillStyle(0xffffff, 0.08).fillCircle(0, 0, s * 0.16);
      this.icon.setVisible(false).setTexture('__DEFAULT');
      this.badge.setVisible(false);
      this.tag.setVisible(false);
      this.lift.y = 0;
      return;
    }

    const border = onBench ? PALETTE.gold : rock.cut ? rock.rarity.color : 0xd9b98f;
    this.lift.y = onBench ? -5 : 0;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-s / 2, -s / 2 + 4, s, s, r);
    g.fillStyle(PALETTE.cream).fillRoundedRect(-s / 2, -s / 2, s, s, r);
    g.fillStyle(PALETTE.creamShade).fillRoundedRect(-s / 2 + 4, -s / 2 + s * 0.55, s - 8, s * 0.45 - 4, r * 0.7);
    if (rock.cut) g.fillStyle(rock.rarity.color, 0.25).fillRoundedRect(-s / 2, -s / 2, s, s, r);
    g.lineStyle(onBench ? 4 : 3, border).strokeRoundedRect(-s / 2, -s / 2, s, s, r);

    const keys = rockKeys(rock);
    this.icon
      .setTexture(rock.cut ? keys.inside : keys.outside)
      .setScale(iconScale(s * 0.74))
      .setPosition(0, rock.cut ? -s * 0.06 : 0)
      .setAlpha(onBench ? 0.45 : 1)
      .setVisible(!incoming);
    if (!incoming && !onBench && !rock.cut) {
      this.idleTween = this.scene.tweens.add({
        targets: this.icon,
        angle: { from: -3, to: 3 },
        duration: 1400 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.badge.setVisible(!rock.cut && !incoming && !onBench).setPosition(s * 0.3, -s * 0.3);
    if (onBench) {
      this.tag.setText('ON BENCH').setColor(PALETTE.goldText).setPosition(0, s * 0.34).setVisible(true);
    } else if (rock.cut) {
      this.tag.setText(rock.rarity.label.toUpperCase()).setColor('#ffffff').setPosition(0, s * 0.34).setVisible(true);
      this.tag.setStroke(rock.rarity.css, Math.max(3, Math.round(s * 0.05)));
    } else {
      this.tag.setVisible(false);
    }
    if (!onBench && !rock.cut) this.tag.setStroke(PALETTE.ink, 3);
  }
}
