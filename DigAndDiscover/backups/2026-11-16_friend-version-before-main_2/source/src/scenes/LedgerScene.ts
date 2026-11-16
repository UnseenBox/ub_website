import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { sfx } from '../audio/Sfx';
import { uiIcon } from '../art/UiIcons';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

const CARD_W = 480;
const PAD = 22;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';
const WARN = '#c0392b';
const GOOD = '#2a8a3a';

/**
 * The household ledger card: what is owed, what is overdue, what is due next
 * and two simple buttons to pay the bank. Pauses the game like the store and
 * never pauses the end-of-day overlay.
 */
export class LedgerScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Graphics;
  private content!: Phaser.GameObjects.Container;
  private cardH = 420;
  private pausedKey: string | null = null;
  private closing = false;

  constructor() {
    super('Ledger');
  }

  init(): void {
    this.closing = false;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.pausedKey = state.mode === 'dig' ? 'Dig' : 'Workshop';
    if (this.scene.isActive(this.pausedKey)) this.scene.pause(this.pausedKey);
    else this.pausedKey = null;

    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.66, duration: 220 });
    this.dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!this.insideCard(p)) this.close();
    });

    this.card = this.add.container(0, 0);
    this.panel = this.add.graphics();
    this.content = this.add.container(0, 0);
    this.card.add([this.panel, this.content]);
    this.render();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** Rebuilds the rows and the buttons from the current ledger state. */
  private render(): void {
    this.content.removeAll(true);
    const view = state.ledger;
    const money = state.economy.money;
    let y = 6;

    // Title ribbon.
    const title = this.add.text(CARD_W / 2, 36, 'Debt', outlinedStyle(34)).setOrigin(0.5);
    const rw = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 16, rw, 52, 14);
    ribbon.fillStyle(0x4fb0ff).fillRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 14, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    this.content.add([ribbon, title]);
    y = 86;

    y = this.row(y, 'Debt remaining', formatMoney(view.debtRemaining), INK);
    y = this.row(y, 'Weekly payment', formatMoney(view.installment), INK);
    y = this.row(y, 'Paid so far', formatMoney(view.paidTotal), INK);
    y = this.row(y, 'Overdue', formatMoney(view.overdue), view.overdue > 0 ? WARN : INK);
    const next =
      view.nextInstallmentDay === null
        ? 'None'
        : `Day ${view.nextInstallmentDay} (in ${view.daysUntilNextInstallment} days)`;
    y = this.row(y, 'Next payment', next, INK);
    y = this.row(y, 'Month deadline', `Month ${view.monthNumber}: ${view.daysLeftInMonth} days left`, INK);
    if (view.billsOutstanding > 0) {
      y = this.row(y, 'Household bills owed', formatMoney(view.billsOutstanding), WARN);
    }
    y = this.row(y, 'Your money', formatMoney(money), GOOD);
    y += 10;

    if (view.debtFree) {
      this.content.add(
        this.add
          .text(CARD_W / 2, y + 18, 'Debt free. The bank is off your back.', textStyle(20, GOOD))
          .setOrigin(0.5),
      );
      y += 46;
    } else {
      const owes = view.overdue > 0 || view.billsOutstanding > 0;
      const due = new Button(this, {
        width: 200,
        height: 54,
        label: owes ? 'Pay what is due' : 'Pay ahead',
        fontSize: 18,
        colors: BUTTON_COLORS.green,
        onClick: () => this.payDue(),
      });
      due.setPosition(CARD_W / 2 - 106, y + 30);
      due.setEnabled(money > 0 && (view.installment > 0 || view.billsOutstanding > 0));
      this.content.add(due);

      const all = new Button(this, {
        width: 200,
        height: 54,
        label: 'Pay all I can',
        fontSize: 18,
        colors: BUTTON_COLORS.orange,
        onClick: () => this.payAll(),
      });
      all.setPosition(CARD_W / 2 + 106, y + 30);
      all.setEnabled(money > 0);
      this.content.add(all);
      y += 72;
    }

    // A clear way out on a phone, where the dim area around the card is only a thin strip.
    const done = new Button(this, { width: 150, height: 56, label: '', icon: uiIcon('play'), ghost: true, iconScale: 1.25, fontSize: 30, colors: BUTTON_COLORS.green, onClick: () => this.close() });
    done.setPosition(CARD_W / 2, y + 34);
    this.content.add(done);
    y += 70;

    this.cardH = y + 10;
    this.drawPanel();
    this.fit();
  }

  /** One label/value row. Returns the next free y. */
  private row(y: number, label: string, value: string, color: string): number {
    this.content.add(this.add.text(PAD, y, label, textStyle(16, SOFT_INK)).setOrigin(0, 0.5));
    this.content.add(this.add.text(CARD_W - PAD, y, value, textStyle(19, color)).setOrigin(1, 0.5));
    return y + 30;
  }

  /** The paper panel behind the rows. */
  private drawPanel(): void {
    const ph = this.cardH - 8;
    this.panel.clear();
    this.panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    this.panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    this.panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    this.panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
  }

  /** Pays the bills carried forward and the overdue debt, or the next instalment ahead of time. */
  private payDue(): void {
    const paid = state.payDebtDue();
    if (paid > 0) {
      sfx.coin();
      this.render();
    }
  }

  /** Pays everything the player can afford. */
  private payAll(): void {
    const paid = state.payDebt(Infinity);
    if (paid > 0) {
      sfx.coin();
      this.render();
    }
  }

  private fit(): void {
    const { width: w, height: h } = this.scale;
    const s = Math.min(1.15, (w - 16) / CARD_W, (h - 16) / this.cardH);
    this.card.setScale(s);
    this.card.setPosition((w - CARD_W * s) / 2, (h - this.cardH * s) / 2);
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.dim.setSize(w, h);
    (this.dim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.fit();
  }

  private insideCard(p: Phaser.Input.Pointer): boolean {
    const s = this.card.scaleX;
    return (
      p.x >= this.card.x &&
      p.x <= this.card.x + CARD_W * s &&
      p.y >= this.card.y &&
      p.y <= this.card.y + this.cardH * s
    );
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
