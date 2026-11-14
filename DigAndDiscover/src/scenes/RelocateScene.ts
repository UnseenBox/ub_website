import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { depositName, hardnessMult, powerMult, valueMult } from '../data/deposits';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

const CARD_W = 460;
const PAD = 24;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';

/**
 * Bedrock! The deposit is dug out. This card offers a fresh one: the ground starts over,
 * a little harder and a lot richer, tools hit harder, and a cash bonus comes along.
 * Everything the digger owns - money, tools, upgrades, collection - stays with him.
 */
export class RelocateScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 460;
  private pausedKey: string | null = null;
  private closing = false;

  constructor() {
    super('Relocate');
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
    this.tweens.add({ targets: this.dim, fillAlpha: 0.7, duration: 240 });

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.85);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 320, ease: 'Back.easeOut', delay: 80 });
    sfx.surprise(3);
    sfx.haptic([30, 40, 70]);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close(false));
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    const content = this.add.container(0, 0);
    this.card.add([panel, content]);

    const cur = state.progress.deposit;
    const next = cur + 1;

    const title = this.add.text(CARD_W / 2, 38, 'BEDROCK!', outlinedStyle(36)).setOrigin(0.5);
    const rw = title.width + 80;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 18, rw, 54, 14);
    ribbon.fillStyle(0x5fcf5c).fillRoundedRect(CARD_W / 2 - rw / 2, 12, rw, 54, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 16, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 12, rw, 54, 14);
    content.add([ribbon, title]);

    let y = 88;
    const intro = `You dug Deposit ${cur} (${depositName(cur)}) all the way down!`;
    content.add(this.add.text(CARD_W / 2, y, intro, { ...textStyle(18, INK), align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }).setOrigin(0.5, 0));
    y += 56;
    content.add(this.add.text(CARD_W / 2, y, `Next: Deposit ${next} - ${depositName(next)}`, textStyle(22, '#2a8a3a')).setOrigin(0.5, 0));
    y += 42;

    const pct = (v: number) => `+${Math.round((v - 1) * 100)}%`;
    const rows: Array<[string, string, string]> = [
      ['Relocation bonus', `+${formatMoney(state.relocationBonus)}`, '#2a8a3a'],
      ['Richer finds', `${pct(valueMult(next))} value`, '#2a8a3a'],
      ['Stronger tools', `${pct(powerMult(next))} power`, '#2a8a3a'],
      ['Tougher ground', `${pct(hardnessMult(next))} harder`, '#b8501f'],
    ];
    for (const [label, value, color] of rows) {
      const g = this.add.graphics();
      g.lineStyle(2, 0x7a5a3a, 0.16).lineBetween(PAD, y + 32, CARD_W - PAD, y + 32);
      content.add(g);
      content.add(this.add.text(PAD, y + 15, label, textStyle(19, SOFT_INK)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD, y + 15, value, outlinedStyle(20, '#ffffff')).setOrigin(1, 0.5).setStroke(color === '#b8501f' ? '#b8501f' : '#2a8a3a', 5));
      y += 38;
    }
    y += 6;
    content.add(this.add.text(CARD_W / 2, y, 'Your money, tools, upgrades and collection come with you.', { ...textStyle(14, SOFT_INK), align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }).setOrigin(0.5, 0));
    y += 44;

    const go = new Button(this, { width: 380, height: 66, label: 'MOVE TO A NEW DEPOSIT', fontSize: 23, colors: BUTTON_COLORS.green, onClick: () => this.close(true) });
    go.setPosition(CARD_W / 2, y + 36).setPulse(true);
    content.add(go);
    y += 82;
    const stay = new Button(this, { width: 230, height: 46, label: 'STAY HERE', fontSize: 18, colors: BUTTON_COLORS.blue, onClick: () => this.close(false) });
    stay.setPosition(CARD_W / 2, y + 26);
    content.add(stay);
    y += 56;

    this.cardH = y + 12;
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

  /** `relocate` true moves to the new deposit; false just closes the card. */
  private close(relocate: boolean): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    if (relocate) {
      sfx.newDay();
      state.relocate();
    }
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
