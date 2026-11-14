import Phaser from 'phaser';
import { PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { goalText } from '../data/goals';
import { state } from '../core/GameState';

/**
 * Under the top bar: the prospector level (badge ringed by an XP arc) and the
 * goal that is closest to done, with its progress bar. Tapping opens the goals card.
 */
export class GoalPill extends Phaser.GameObjects.Container {
  private readonly inner: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly counter: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private pw = 240;
  private ph = 50;
  private shown = '';

  constructor(scene: Phaser.Scene, onPress: () => void) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.levelText = scene.add.text(0, 0, '1', outlinedStyle(20, '#ffffff')).setOrigin(0.5);
    this.title = scene.add.text(0, 0, '', textStyle(14, '#fff6e6')).setOrigin(0, 0.5);
    this.counter = scene.add.text(0, 0, '', textStyle(13, PALETTE.goldText)).setOrigin(1, 0.5);
    this.bar = scene.add.graphics();
    this.inner = scene.add.container(0, 0, [this.bg, this.ring, this.levelText, this.title, this.counter, this.bar]);
    this.add(this.inner);
    scene.add.existing(this);
    this.setSize(this.pw, this.ph); // a container needs a size before it can take input
    this.setInteractive({ useHandCursor: true });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onPress);
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

  /** The goal that is furthest along (ties go to the first). */
  private topGoal() {
    return state.progress.goals.reduce((a, b) => (b.progress / b.target > a.progress / a.target ? b : a), state.progress.goals[0]);
  }

  refresh(): void {
    const { pw: w, ph: h } = this;
    const lp = state.progress.levelProgress;
    const goal = this.topGoal();
    const sig = `${lp.level}:${lp.into}:${goal?.metric}:${goal?.target}:${goal?.progress}:${w}`;
    if (sig === this.shown) return;
    this.shown = sig;

    const r = h * 0.4;
    const cx = h * 0.5;
    const cy = h / 2;
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.22).fillRoundedRect(0, 3, w, h, h / 2);
    g.fillStyle(PALETTE.tray, 0.88).fillRoundedRect(0, 0, w, h, h / 2);
    g.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(0, 0, w, h, h / 2);

    // Level badge with an XP ring.
    const ring = this.ring;
    ring.clear();
    ring.fillStyle(0x6a4a1c).fillCircle(cx, cy, r);
    ring.lineStyle(4, 0xffffff, 0.15).beginPath().arc(cx, cy, r, 0, Math.PI * 2).strokePath();
    if (lp.fraction > 0.01) {
      ring.lineStyle(4, PALETTE.gold).beginPath().arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lp.fraction).strokePath();
    }
    this.levelText.setText(`${lp.level}`).setFontSize(Math.round(h * 0.4)).setPosition(cx, cy);

    const textX = h * 0.98;
    const barW = w - textX - h * 0.4;
    this.title.setFontSize(Math.round(h * 0.28)).setPosition(textX, h * 0.32);
    this.counter.setFontSize(Math.round(h * 0.26)).setPosition(w - h * 0.4, h * 0.32);
    this.bar.clear();
    if (goal) {
      const label = goalText(goal);
      this.title.setText(label);
      this.counter.setText(goal.metric === 'earn' ? `$${Math.floor(goal.progress)}/${goal.target}` : `${Math.floor(goal.progress)}/${goal.target}`);
      // Never let the text run into the counter.
      let t = label;
      while (this.title.width > barW - this.counter.width - 8 && t.length > 6) {
        t = t.slice(0, -2);
        this.title.setText(`${t}...`);
      }
      const by = h * 0.62;
      const bh = Math.max(6, h * 0.16);
      this.bar.fillStyle(0xffffff, 0.14).fillRoundedRect(textX, by, barW, bh, bh / 2);
      const f = Phaser.Math.Clamp(goal.progress / goal.target, 0, 1);
      if (f > 0) this.bar.fillStyle(0x5fcf5c).fillRoundedRect(textX, by, Math.max(bh, barW * f), bh, bh / 2);
    } else {
      this.title.setText('');
      this.counter.setText('');
    }
  }

  /** A small pop when a goal moves forward. */
  bump(): void {
    this.scene.tweens.add({ targets: this, scale: { from: 1.08, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }
}
