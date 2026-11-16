import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

const CARD_W = 420;
const PAD = 24;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';

/**
 * The end of the run. A full screen dim blocks everything below it, the card
 * explains why the run ended and the only way out is the Restart button.
 * There is deliberately no keyboard shortcut, so Restart can never be hit by
 * accident with Space or Enter.
 */
export class GameOverScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private cardH = 420;

  constructor() {
    super('GameOver');
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.78, duration: 260 });
    // Swallow every click so nothing below the overlay can be used.
    this.dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.block(p);
    });
    this.dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      this.block(p);
    });

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.92);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 280, ease: 'Back.easeOut' });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  /** Keeps the pointer from reaching the scenes underneath. */
  private block(p: Phaser.Input.Pointer): void {
    const event = p.event as unknown as { stopPropagation?: () => void } | undefined;
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    this.content = this.add.container(0, 0);
    this.card.add([panel, this.content]);
    let y = 6;

    const title = this.add.text(CARD_W / 2, 40, 'Game Over', outlinedStyle(36)).setOrigin(0.5);
    const rw = title.width + 60;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 20, rw, 54, 14);
    ribbon.fillStyle(0xc0392b).fillRoundedRect(CARD_W / 2 - rw / 2, 14, rw, 54, 14);
    ribbon.fillStyle(0xffffff, 0.22).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 18, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 14, rw, 54, 14);
    this.content.add([ribbon, title]);
    y = 92;

    const reason = state.finance.gameOver ?? 'The month ran out before the debt did.';
    const reasonText = this.add
      .text(CARD_W / 2, y, reason, textStyle(18, INK, { align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }))
      .setOrigin(0.5, 0);
    this.content.add(reasonText);
    // Rows start below however many lines the reason wrapped into.
    y += Math.ceil(reasonText.height) + 22;

    const finance = state.finance;
    y = this.row(y, 'Days survived', `${finance.daysSurvived}`);
    y = this.row(y, 'Months completed', `${finance.monthsCompleted}`);
    y = this.row(y, 'Total debt paid', formatMoney(finance.paidTotal));
    y += 14;

    const restart = new Button(this, {
      width: 220,
      height: 64,
      label: 'Restart',
      fontSize: 26,
      colors: BUTTON_COLORS.orange,
      onClick: () => this.restart(),
    });
    restart.setPosition(CARD_W / 2, y + 32);
    this.content.add(restart);
    y += 80;

    this.cardH = y + 10;
    const ph = this.cardH - 8;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
    this.card.sendToBack(panel);
  }

  /** One label/value row. Returns the next free y. */
  private row(y: number, label: string, value: string): number {
    this.content.add(this.add.text(PAD, y, label, textStyle(16, SOFT_INK)).setOrigin(0, 0.5));
    this.content.add(this.add.text(CARD_W - PAD, y, value, textStyle(19, INK)).setOrigin(1, 0.5));
    return y + 30;
  }

  /** Starts the whole run from scratch and leaves the screen. */
  private restart(): void {
    sfx.click();
    state.resetRun();
    this.scene.stop();
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
}
