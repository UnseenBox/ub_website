import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { goalText } from '../data/goals';
import { depositName } from '../data/deposits';
import { ALL_TOOLS } from '../data/store';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

const CARD_W = 480;
const PAD = 22;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';

/**
 * Goals card: your level and XP, the three active goals with their rewards and
 * a peek at the next thing a level unlocks in the store. Pauses the game like the store.
 */
export class GoalsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 400;
  private pausedKey: string | null = null;
  private closing = false;

  constructor() {
    super('Goals');
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
    this.buildCard();
    this.fit();
    const scale = this.card.scale;
    this.card.setAlpha(0).setScale(scale * 0.9);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 260, ease: 'Back.easeOut' });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    const content = this.add.container(0, 0);
    this.card.add([panel, content]);
    let y = 6;

    const title = this.add.text(CARD_W / 2, 36, 'GOALS', outlinedStyle(34)).setOrigin(0.5);
    const rw = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 16, rw, 52, 14);
    ribbon.fillStyle(0x4fb0ff).fillRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 14, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    content.add([ribbon, title]);
    y = 86;

    // Level + XP.
    const lp = state.progress.levelProgress;
    content.add(this.add.text(PAD, y + 12, `Prospector level ${lp.level}`, textStyle(22, INK)).setOrigin(0, 0.5));
    content.add(this.add.text(CARD_W - PAD, y + 12, `${lp.into} / ${lp.need} XP`, textStyle(16, SOFT_INK)).setOrigin(1, 0.5));
    const xp = this.add.graphics();
    xp.fillStyle(0x3b2616, 0.18).fillRoundedRect(PAD, y + 30, CARD_W - PAD * 2, 14, 7);
    xp.fillStyle(PALETTE.gold).fillRoundedRect(PAD, y + 30, Math.max(14, (CARD_W - PAD * 2) * lp.fraction), 14, 7);
    xp.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(PAD, y + 30, CARD_W - PAD * 2, 14, 7);
    content.add(xp);
    y += 54;
    content.add(
      this.add
        .text(PAD, y + 4, `Deposit ${state.progress.deposit}: ${depositName(state.progress.deposit)}`, textStyle(16, '#2a8a3a'))
        .setOrigin(0, 0.5),
    );
    y += 28;

    // Goals.
    for (const goal of state.progress.goals) {
      const rowH = 84;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.1).fillRoundedRect(PAD, y + 4, CARD_W - PAD * 2, rowH - 8, 14);
      g.fillStyle(0xf1dcb8).fillRoundedRect(PAD, y, CARD_W - PAD * 2, rowH - 8, 14);
      g.lineStyle(2, 0x3b2616, 0.22).strokeRoundedRect(PAD, y, CARD_W - PAD * 2, rowH - 8, 14);
      const f = Phaser.Math.Clamp(goal.progress / goal.target, 0, 1);
      const bw = CARD_W - PAD * 2 - 32;
      g.fillStyle(0x3b2616, 0.18).fillRoundedRect(PAD + 16, y + 40, bw, 14, 7);
      if (f > 0) g.fillStyle(0x5fcf5c).fillRoundedRect(PAD + 16, y + 40, Math.max(14, bw * f), 14, 7);
      g.lineStyle(2, 0x3b2616, 0.4).strokeRoundedRect(PAD + 16, y + 40, bw, 14, 7);
      content.add(g);
      content.add(this.add.text(PAD + 16, y + 18, goalText(goal), textStyle(19, INK)).setOrigin(0, 0.5));
      const prog = goal.metric === 'earn' ? `$${Math.floor(goal.progress)} / $${goal.target}` : `${Math.floor(goal.progress)} / ${goal.target}`;
      content.add(this.add.text(CARD_W - PAD - 16, y + 18, prog, textStyle(15, SOFT_INK)).setOrigin(1, 0.5));
      content.add(this.add.text(PAD + 16, y + 64, `Reward:  ${formatMoney(goal.cash)}  +  ${goal.xp} XP`, textStyle(13, '#2a8a3a')).setOrigin(0, 0.5));
      y += rowH;
    }

    // What is next in the store.
    const next = ALL_TOOLS.filter((t) => !t.placeholder && !state.progress.owns(t.id) && t.minLevel > lp.level).sort((a, b) => a.minLevel - b.minLevel)[0];
    y += 4;
    const hint = next ? `Level ${next.minLevel} unlocks the ${next.name} in the store!` : 'Every tool is unlocked. Keep digging for the big finds!';
    content.add(this.add.text(CARD_W / 2, y + 12, hint, { ...textStyle(15, SOFT_INK), align: 'center', wordWrap: { width: CARD_W - PAD * 2 } }).setOrigin(0.5, 0));
    y += 48;

    const ok = new Button(this, { width: 220, height: 56, label: 'KEEP DIGGING', fontSize: 22, colors: BUTTON_COLORS.orange, onClick: () => this.close() });
    ok.setPosition(CARD_W / 2, y + 30);
    content.add(ok);
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

  private insideCard(p: Phaser.Input.Pointer): boolean {
    const s = this.card.scaleX;
    return p.x >= this.card.x && p.x <= this.card.x + CARD_W * s && p.y >= this.card.y && p.y <= this.card.y + this.cardH * s;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
