import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { goalIcon } from '../data/goals';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button, type ButtonColors } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';
import { FEATURES } from '../config/features';
import { dailyGoalIcon, dailyGoalText } from '../data/dailyGoals';

const CARD_W = 480;
const PAD = 22;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';
const START_OVER_COLORS: ButtonColors = { face: 0xd9453a, lip: 0x9a2a22, text: '#ffffff' };

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
  }

  private buildCard(): void {
    const panel = this.add.graphics();
    const content = this.add.container(0, 0);
    this.card.add([panel, content]);
    let y = 6;

    const title = this.add.image(CARD_W / 2, 36, uiIcon('target')).setDisplaySize(44, 44).setOrigin(0.5);
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
    content.add(this.add.image(PAD + 18, y + 12, ICON_STAR).setDisplaySize(40, 40));
    content.add(this.add.text(PAD + 46, y + 12, `${lp.level}`, textStyle(28, INK)).setOrigin(0, 0.5));
    content.add(this.add.text(CARD_W - PAD, y + 12, `${lp.into} / ${lp.need}`, textStyle(16, SOFT_INK)).setOrigin(1, 0.5));
    const xp = this.add.graphics();
    xp.fillStyle(0x3b2616, 0.18).fillRoundedRect(PAD, y + 30, CARD_W - PAD * 2, 14, 7);
    xp.fillStyle(PALETTE.gold).fillRoundedRect(PAD, y + 30, Math.max(14, (CARD_W - PAD * 2) * lp.fraction), 14, 7);
    xp.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(PAD, y + 30, CARD_W - PAD * 2, 14, 7);
    content.add(xp);
    y += 54;
    content.add(this.add.image(PAD, y + 8, uiIcon('flag')).setDisplaySize(24, 24).setOrigin(0, 0.5));
    content.add(this.add.text(PAD + 28, y + 8, `${state.progress.deposit}`, textStyle(24, '#2a8a3a')).setOrigin(0, 0.5));
    y += 28;

    // daily goals: today's three small goals, above the long-term goals.
    if (FEATURES.v2 && state.daily.total > 0) {
      const daily = state.daily;
      content.add(this.add.image(PAD + 12, y + 10, uiIcon('target')).setDisplaySize(24, 24).setOrigin(0, 0.5));
      content.add(this.add.text(PAD + 32, y + 10, "Today's goals", textStyle(20, INK)).setOrigin(0, 0.5));
      content.add(
        this.add
          .text(CARD_W - PAD, y + 10, `${daily.completedCount}/${daily.total}`, textStyle(14, daily.done ? '#2a8a3a' : SOFT_INK))
          .setOrigin(1, 0.5),
      );
      y += 30;

      for (const goal of daily.goals) {
        const rowH = 66;
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.1).fillRoundedRect(PAD, y + 4, CARD_W - PAD * 2, rowH - 8, 12);
        g.fillStyle(goal.done ? 0xdff0cf : 0xf1dcb8).fillRoundedRect(PAD, y, CARD_W - PAD * 2, rowH - 8, 12);
        g.lineStyle(2, 0x3b2616, 0.22).strokeRoundedRect(PAD, y, CARD_W - PAD * 2, rowH - 8, 12);
        const f = Phaser.Math.Clamp(goal.progress / goal.target, 0, 1);
        const barX = PAD + 44;
        const barW = CARD_W - PAD * 2 - 44 - 76;
        g.fillStyle(0x3b2616, 0.18).fillRoundedRect(barX, y + 40, barW, 10, 5);
        if (f > 0) g.fillStyle(0x5fcf5c).fillRoundedRect(barX, y + 40, Math.max(10, barW * f), 10, 5);
        g.lineStyle(2, 0x3b2616, 0.35).strokeRoundedRect(barX, y + 40, barW, 10, 5);
        content.add(g);

        content.add(this.add.image(PAD + 14, y + 16, dailyGoalIcon(goal.metric)).setDisplaySize(24, 24).setOrigin(0, 0.5));
        content.add(this.add.text(PAD + 44, y + 16, dailyGoalText(goal), textStyle(15, INK)).setOrigin(0, 0.5));

        const rewardX = goal.done ? CARD_W - PAD - 34 : CARD_W - PAD - 14;
        content.add(this.add.text(rewardX, y + 16, `+${formatMoney(goal.cash)}`, textStyle(13, '#2a8a3a')).setOrigin(1, 0.5));
        if (goal.done) {
          content.add(this.add.image(CARD_W - PAD - 14, y + 16, uiIcon('check')).setDisplaySize(18, 18).setOrigin(1, 0.5));
        }
        content.add(
          this.add
            .text(CARD_W - PAD - 14, y + 40, `${Math.floor(goal.progress)}/${goal.target}`, textStyle(12, SOFT_INK))
            .setOrigin(1, 0.5),
        );
        y += rowH;
      }

      content.add(this.add.image(PAD + 12, y + 10, uiIcon('sparkle')).setDisplaySize(18, 18).setOrigin(0, 0.5));
      const bonus = daily.done ? `All three done: +${formatMoney(daily.bonus)} paid` : `All three: +${formatMoney(daily.bonus)} bonus`;
      content.add(this.add.text(PAD + 30, y + 10, bonus, textStyle(14, daily.done ? '#2a8a3a' : SOFT_INK)).setOrigin(0, 0.5));
      y += 30;

      const divider = this.add.graphics();
      divider.lineStyle(2, 0x3b2616, 0.18).lineBetween(PAD, y, CARD_W - PAD, y);
      content.add(divider);
      y += 14;
    }

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
      const goalIconKey = goalIcon(goal.metric);
      content.add(this.add.image(PAD + 16, y + 18, goalIconKey).setDisplaySize(28, 28).setOrigin(0, 0.5));
      const prog = goal.metric === 'earn' ? `$${Math.floor(goal.progress)} / $${goal.target}` : `${Math.floor(goal.progress)} / ${goal.target}`;
      content.add(this.add.text(CARD_W - PAD - 16, y + 18, prog, textStyle(15, SOFT_INK)).setOrigin(1, 0.5));
      // Reward line: [cash] $30   [sparkle] 25. Goals that pay no cash show only the XP.
      let rx = PAD + 16;
      if (goal.cash > 0) {
        const cashIcon = this.add.image(rx, y + 64, uiIcon('cash')).setDisplaySize(18, 18).setOrigin(0, 0.5);
        const cashText = this.add.text(rx + 22, y + 64, formatMoney(goal.cash), textStyle(13, '#2a8a3a')).setOrigin(0, 0.5);
        content.add([cashIcon, cashText]);
        rx = cashText.x + cashText.width + 14;
      }
      const sparkleIcon = this.add.image(rx, y + 64, uiIcon('sparkle')).setDisplaySize(18, 18).setOrigin(0, 0.5);
      const xpText = this.add.text(rx + 22, y + 64, `${goal.xp}`, textStyle(13, '#2a8a3a')).setOrigin(0, 0.5);
      content.add([sparkleIcon, xpText]);
      y += rowH;
    }


    const ok = new Button(this, { width: 220, height: 56, label: '', fontSize: 30, colors: BUTTON_COLORS.orange, icon: uiIcon('play'), onClick: () => this.close() });
    ok.setPosition(CARD_W / 2, y + 30);
    content.add(ok);
    y += 72;

    // "Start over" is deliberately small and red; it only opens a confirmation card.
    const startOver = new Button(this, { width: 190, height: 40, label: 'Start over', fontSize: 18, colors: START_OVER_COLORS, onClick: () => this.openReset() });
    startOver.setPosition(CARD_W / 2, y + 18);
    content.add(startOver);
    y += 50;

    // Which build is this? (the name and the build time; the same text is in the page's script, so it proves what loaded)
    const label = typeof __BUILD_LABEL__ === 'string' ? __BUILD_LABEL__ : 'main_2';
    content.add(this.add.text(CARD_W / 2, y - 4, label, textStyle(12, SOFT_INK)).setOrigin(0.5, 0));
    y += 20;

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

  private openReset(): void {
    if (this.closing || this.scene.isActive('Reset')) return;
    sfx.click();
    this.scene.launch('Reset');
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
