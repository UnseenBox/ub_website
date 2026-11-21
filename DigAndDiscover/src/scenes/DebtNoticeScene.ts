import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

const CARD_W = 460;
const PAD = 24;
const INK = '#3b2616';
const SOFT = '#7a5a3a';
const RED = '#c0392b';
const ORANGE = '#d9822b';
const GREEN = '#2a8a3a';

/** Why the card opens: at the start of a month, or because the deadline is getting close. */
export type DebtNoticeKind = 'start' | 'warn';

/**
 * "The bank is waiting" card (retention update). The player never noticed the debt, so this card tells them in
 * plain words how much has to be paid, by which day, and how many days are left. It opens on the first day of every
 * month and again when 7, 3 and 1 days are left (see HudScene.maybeShowDebtNotice). Pauses the game like the Goals card.
 */
export class DebtNoticeScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 400;
  private pausedKey: string | null = null;
  private closing = false;
  private kind: DebtNoticeKind = 'start';

  constructor() {
    super('DebtNotice');
  }

  init(data: { kind?: DebtNoticeKind }): void {
    this.closing = false;
    this.kind = data?.kind === 'warn' ? 'warn' : 'start';
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.pausedKey = state.mode === 'dig' ? 'Dig' : 'Workshop';
    if (this.scene.isActive(this.pausedKey)) this.scene.pause(this.pausedKey);
    else this.pausedKey = null;

    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.7, duration: 220 });

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.9);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 260, ease: 'Back.easeOut' });
    if (this.kind === 'warn') sfx.denied();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });
  }

  private buildCard(): void {
    const v = state.ledger;
    const panel = this.add.graphics();
    const content = this.add.container(0, 0);
    this.card.add([panel, content]);

    const urgent = v.daysToPayment <= 3;
    const accent = this.kind === 'warn' ? (urgent ? 0xe5533d : 0xffb627) : 0x4fb0ff;

    // Title ribbon.
    const title = this.add
      .text(CARD_W / 2, 36, this.kind === 'warn' ? 'Payment due soon!' : 'The bank is waiting', textStyle(28, '#ffffff', { fontStyle: '700' }))
      .setOrigin(0.5)
      .setStroke('#3b2616', 6);
    const rw = title.width + 80;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 16, rw, 52, 14);
    ribbon.fillStyle(accent).fillRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 14, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    content.add([ribbon, title]);
    let y = 84;

    // Story line.
    let story: string;
    if (this.kind === 'start') {
      story =
        v.monthNumber === 1
          ? `Dad owes the bank ${formatMoney(v.debtRemaining)}. Every month a payment is due, and if it is missed the family loses everything.`
          : `A new month begins. The bank wants this month's payment, and it does not wait.`;
    } else {
      story = urgent
        ? 'The deadline is almost here. Cut and sell rocks now, or the family loses everything.'
        : 'The deadline is getting close. Keep digging, cutting and selling.';
    }
    const storyText = this.add
      .text(CARD_W / 2, y, story, textStyle(18, INK, { align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }))
      .setOrigin(0.5, 0);
    content.add(storyText);
    y += storyText.height + 16;

    // The amount.
    content.add(this.add.image(CARD_W / 2 - 150, y + 36, uiIcon('ledger')).setDisplaySize(54, 54));
    content.add(this.add.text(CARD_W / 2 + 18, y + 8, 'Payment due', textStyle(16, SOFT)).setOrigin(0.5, 0));
    const left = Math.max(0, v.paymentLeft);
    content.add(
      this.add
        .text(CARD_W / 2 + 18, y + 28, formatMoney(left > 0 ? left : v.monthlyPayment), textStyle(44, left > 0 ? RED : GREEN, { fontStyle: '700' }))
        .setOrigin(0.5, 0),
    );
    y += 90;
    if (left <= 0) {
      content.add(this.add.text(CARD_W / 2, y, 'This month is already covered. Well done!', textStyle(18, GREEN)).setOrigin(0.5, 0));
      y += 30;
    }

    // The deadline and the player's cash.
    const days = v.daysToPayment;
    const dayColor = days <= 3 ? RED : days <= 7 ? ORANGE : INK;
    const timeLeft = days <= 1 ? 'Today!' : days + ' days';
    const rowY = y;
    const rows = this.add.graphics();
    rows.fillStyle(0xf1dcb8).fillRoundedRect(PAD, rowY, CARD_W - PAD * 2, 116, 14);
    rows.lineStyle(2, 0x3b2616, 0.22).strokeRoundedRect(PAD, rowY, CARD_W - PAD * 2, 116, 14);
    content.add(rows);
    const line = (i: number, icon: Parameters<typeof uiIcon>[0], label: string, value: string, color: string): void => {
      const ly = rowY + 22 + i * 36;
      content.add(this.add.image(PAD + 28, ly, uiIcon(icon)).setDisplaySize(28, 28));
      content.add(this.add.text(PAD + 54, ly, label, textStyle(17, SOFT)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD - 16, ly, value, textStyle(22, color)).setOrigin(1, 0.5));
    };
    line(0, 'calendar', 'Pay by the end of day', String(state.ledger.monthDays), INK);
    line(1, 'clock', 'Time left', timeLeft, dayColor);
    line(2, 'cash', 'Your cash', formatMoney(state.economy.money), GREEN);
    y += 128;

    const hint = this.add
      .text(CARD_W / 2, y, 'Tip: you can pay early at any time from the bank icon.', textStyle(14, SOFT, { align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }))
      .setOrigin(0.5, 0);
    content.add(hint);
    y += hint.height + 12;

    // Buttons.
    const canPay = state.economy.money > 0 && left > 0;
    const ok = new Button(this, { width: canPay ? 170 : 240, height: 56, label: 'Got it', fontSize: 24, colors: BUTTON_COLORS.orange, onClick: () => this.close() });
    if (canPay) {
      const pay = new Button(this, { width: 200, height: 56, label: 'Pay now', fontSize: 22, colors: BUTTON_COLORS.green, onClick: () => this.close(true) });
      pay.setPosition(CARD_W / 2 - 96, y + 30);
      ok.setPosition(CARD_W / 2 + 118, y + 30);
      content.add([pay, ok]);
    } else {
      ok.setPosition(CARD_W / 2, y + 30);
      content.add(ok);
    }
    y += 72;

    this.cardH = y + 10;
    const ph = this.cardH - 8;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
    this.card.sendToBack(panel);
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

  private close(openLedger = false): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({
      targets: this.dim,
      fillAlpha: 0,
      duration: 180,
      onComplete: () => {
        this.scene.stop();
        if (openLedger && !this.scene.isActive('Ledger')) this.scene.launch('Ledger');
      },
    });
  }
}
