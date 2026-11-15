import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { EVT, state, subscribe, type DaySummary } from '../core/GameState';
import { paintFamilyPhoto } from '../art/FamilyPhoto';
import { makeCanvasTexture } from '../art/paint';
import { sfx } from '../audio/Sfx';
import { portal } from '../ads/Portal';
import { ICON_SAW } from '../art/IconArt';
import { uiIcon, type UiIconKey } from '../art/UiIcons';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

/** The card is laid out once in this design space, then scaled to fit the screen. */
const CARD_W = 460;
const PAD = 26;
const PHOTO_KEY = 'family-photo';
const INK = '#3b2616';
const SOFT = '#7a5a3a';
const RED = '#c4361f';
const GREEN = '#1f9a3b';

/** Icon of each household bill line. */
const EXPENSE_ICON: Record<string, UiIconKey> = { food: 'food', water: 'water', power: 'power', other: 'house' };

type FadeItem = Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

interface StatRow {
  icon: string;
  value: number;
  format: (v: number) => string;
  color: string;
}

/**
 * End-of-day summary: a paper card over a dimmed game with the day's numbers, the
 * itemised household bill, the state of the debt, the family photo and the
 * START NEXT DAY button. The bill was already taken from the player's money when the
 * summary opened (see GameState.settleFinance); this screen only shows it.
 */
export class EndOfDayScene extends Phaser.Scene {
  private summary!: DaySummary;
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 0;
  private startBtn!: Button;
  private doubleBtn: Button | null = null;
  private activated = false;
  /** Texts that change when the player pays the bank from this screen. */
  private moneyText: Phaser.GameObjects.Text | null = null;
  private debtText: Phaser.GameObjects.Text | null = null;
  private overdueText: Phaser.GameObjects.Text | null = null;
  private deadlineText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('EndOfDay');
  }

  init(data: DaySummary): void {
    this.summary = data;
    this.activated = false;
    this.moneyText = null;
    this.debtText = null;
    this.overdueText = null;
    this.deadlineText = null;
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.66, duration: 300 });

    this.card = this.add.container(0, 0);
    this.buildCard();
    this.fit();
    this.card.setAlpha(0);
    const scale = this.card.scale;
    this.card.setScale(scale * 0.82);
    this.tweens.add({ targets: this.card, alpha: 1, scale, duration: 380, ease: 'Back.easeOut', delay: 120 });
    this.time.delayedCall(160, () => sfx.dayEnd());

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
    subscribe(this, EVT.financeChanged, () => this.refreshFinance());
    const start = () => {
      // The ledger can be open on top of this card: do not start the day behind it.
      if (this.scene.isActive('Ledger')) return;
      this.startNextDay();
    };
    this.input.keyboard?.on('keydown-ENTER', start);
    this.input.keyboard?.on('keydown-SPACE', start);
  }

  // ---------- construction ----------

  private buildCard(): void {
    const s = this.summary;
    const f = s.finance;
    const panel = this.add.graphics();
    const content = this.add.container(-CARD_W / 2, 0);
    this.card.add([panel, content]);
    let y = 0;

    // Ribbon: a sun and the day number.
    const sun = this.add.image(0, 0, uiIcon('sun')).setDisplaySize(46, 46);
    const title = this.add.text(0, 0, `${s.day}`, outlinedStyle(40)).setOrigin(0.5);
    const ribbonW = title.width + 46 + 90;
    sun.setPosition(CARD_W / 2 - title.width / 2 - 8, 30);
    title.setPosition(CARD_W / 2 + 28, 30);
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 8, ribbonW, 56, 14);
    ribbon.fillStyle(0xff8a3d).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 56, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2 + 8, 6, ribbonW - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 56, 14);
    content.add([ribbon, sun, title]);
    y = 78;

    // The family photo on the left, the day's three numbers on the right.
    if (!this.textures.exists(PHOTO_KEY)) makeCanvasTexture(this.textures, PHOTO_KEY, 400, 300, (ctx, tw, th) => paintFamilyPhoto(ctx, tw, th));
    const photo = this.add.image(PAD + 80, y + 62, PHOTO_KEY).setDisplaySize(150, 112).setAngle(-2);
    content.add(photo);

    const rows: StatRow[] = [
      { icon: uiIcon('rock'), value: s.rocksDiscovered, format: (v) => `${Math.round(v)}`, color: INK },
      { icon: ICON_SAW, value: s.rocksProcessed, format: (v) => `${Math.round(v)}`, color: INK },
      { icon: uiIcon('cash'), value: s.moneyEarned, format: (v) => `+${formatMoney(Math.round(v))}`, color: GREEN },
    ];
    const rowTexts: Array<{ items: FadeItem[]; value: Phaser.GameObjects.Text; row: StatRow }> = [];
    const colX = PAD + 176;
    rows.forEach((row, i) => {
      const ry = y + 22 + i * 40;
      const line = this.add.graphics();
      line.lineStyle(2, 0x7a5a3a, 0.14).lineBetween(colX, ry + 18, CARD_W - PAD, ry + 18);
      const icon = this.add.image(colX + 16, ry, row.icon).setDisplaySize(34, 34);
      const value = this.add.text(CARD_W - PAD, ry, row.format(0), outlinedStyle(24, row.color === INK ? '#ffffff' : '#8dff9a')).setOrigin(1, 0.5);
      value.setStroke('#3b2616', 4);
      content.add([line, icon, value]);
      rowTexts.push({ items: [line, icon, value], value, row });
    });
    y += 138;

    // How deep: a ruler, the metres and the layer bar.
    const rulerIcon = this.add.image(PAD + 16, y + 14, uiIcon('ruler')).setDisplaySize(30, 30);
    const depthValue = this.add.text(CARD_W - PAD, y + 14, `${Math.round(s.maxDepthMeters)} m`, outlinedStyle(24)).setOrigin(1, 0.5);
    content.add([rulerIcon, depthValue]);
    y += 36;
    const barW = CARD_W - PAD * 2;
    const bar = this.add.graphics();
    let bx = PAD;
    state.layers.forEach((layer, i) => {
      const segW = (layer.thickness / state.dig.totalDepthUnits) * barW;
      bar.fillStyle(layer.look.gauge, i < s.layerIndex ? 1 : 0.35).fillRect(bx, y, Math.max(1, segW - 2), 12);
      bx += segW;
    });
    bar.lineStyle(3, 0x3b2616, 0.8).strokeRoundedRect(PAD - 2, y - 2, barW + 4, 16, 6);
    const markX = PAD + barW * s.depthFraction;
    bar.fillStyle(0xffffff).fillTriangle(markX - 7, y - 10, markX + 7, y - 10, markX, y);
    bar.lineStyle(2, 0x3b2616).strokeTriangle(markX - 7, y - 10, markX + 7, y - 10, markX, y);
    content.add(bar);
    y += 34;

    // The household bill, itemised: what the family cost today.
    const bill = this.add.graphics();
    bill.fillStyle(0xf1dcb8).fillRoundedRect(PAD - 10, y - 4, CARD_W - PAD * 2 + 20, 0, 12); // sized below
    content.add(bill);
    const billTop = y;
    y += 4;
    content.add(this.add.text(PAD, y + 11, 'Household bills', textStyle(16, SOFT)).setOrigin(0, 0.5));
    y += 28;
    for (const item of f.items) {
      content.add(this.add.image(PAD + 12, y + 11, uiIcon(EXPENSE_ICON[item.id] ?? 'house')).setDisplaySize(24, 24));
      content.add(this.add.text(PAD + 32, y + 11, item.label, textStyle(17, INK)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD, y + 11, formatMoney(item.amount), textStyle(17, INK)).setOrigin(1, 0.5));
      y += 26;
    }
    if (f.carriedIn > 0) {
      content.add(this.add.image(PAD + 12, y + 11, uiIcon('warning')).setDisplaySize(24, 24));
      content.add(this.add.text(PAD + 32, y + 11, 'Unpaid from before', textStyle(17, RED)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD, y + 11, formatMoney(f.carriedIn), textStyle(17, RED)).setOrigin(1, 0.5));
      y += 26;
    }
    const sep = this.add.graphics();
    sep.lineStyle(2, 0x7a5a3a, 0.3).lineBetween(PAD, y + 3, CARD_W - PAD, y + 3);
    content.add(sep);
    y += 8;
    content.add(this.add.text(PAD, y + 12, 'Total today', textStyle(19, INK, { fontStyle: '700' })).setOrigin(0, 0.5));
    content.add(this.add.text(CARD_W - PAD, y + 12, formatMoney(f.due), textStyle(21, INK, { fontStyle: '700' })).setOrigin(1, 0.5));
    y += 30;
    if (f.carriedOut > 0) {
      content.add(this.add.image(PAD + 12, y + 11, uiIcon('warning')).setDisplaySize(24, 24));
      content.add(this.add.text(PAD + 32, y + 11, `Paid ${formatMoney(f.paid)}. Owed tomorrow:`, textStyle(15, RED)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD, y + 11, formatMoney(f.carriedOut), textStyle(17, RED)).setOrigin(1, 0.5));
    } else {
      content.add(this.add.image(PAD + 12, y + 11, uiIcon('check')).setDisplaySize(24, 24));
      content.add(this.add.text(PAD + 32, y + 11, 'All bills paid', textStyle(15, GREEN)).setOrigin(0, 0.5));
    }
    y += 28;
    bill.clear();
    bill.fillStyle(0xf1dcb8).fillRoundedRect(PAD - 10, billTop, CARD_W - PAD * 2 + 20, y - billTop, 12);
    bill.lineStyle(2, 0x3b2616, 0.2).strokeRoundedRect(PAD - 10, billTop, CARD_W - PAD * 2 + 20, y - billTop, 12);
    y += 14;

    // The debt: how much is left, what is due, and how long until the monthly deadline.
    content.add(this.add.image(PAD + 14, y + 13, uiIcon('ledger')).setDisplaySize(30, 30));
    this.debtText = this.add.text(CARD_W - PAD, y + 13, '', textStyle(20, INK, { fontStyle: '700' })).setOrigin(1, 0.5);
    content.add(this.debtText);
    content.add(this.add.text(PAD + 36, y + 13, 'Debt', textStyle(17, SOFT)).setOrigin(0, 0.5));
    y += 30;
    if (f.installmentIssued > 0) {
      content.add(this.add.image(PAD + 14, y + 11, uiIcon('warning')).setDisplaySize(24, 24));
      content.add(this.add.text(PAD + 36, y + 11, 'Payment due', textStyle(16, INK)).setOrigin(0, 0.5));
      content.add(this.add.text(CARD_W - PAD, y + 11, formatMoney(f.installmentIssued), textStyle(18, INK)).setOrigin(1, 0.5));
      y += 26;
    }
    this.overdueText = this.add.text(PAD + 36, y + 11, '', textStyle(16, RED, { fontStyle: '700' })).setOrigin(0, 0.5);
    content.add(this.overdueText);
    y += 26;
    content.add(this.add.image(PAD + 14, y + 12, uiIcon('calendar')).setDisplaySize(26, 26));
    this.deadlineText = this.add.text(PAD + 36, y + 12, '', textStyle(15, SOFT, { wordWrap: { width: CARD_W - PAD * 2 - 36 } })).setOrigin(0, 0.5);
    content.add(this.deadlineText);
    y += 34;
    this.moneyText = this.add.text(CARD_W - PAD, y + 12, '', outlinedStyle(22, '#8dff9a')).setOrigin(1, 0.5).setStroke('#3b2616', 4);
    content.add(this.add.image(PAD + 16, y + 12, uiIcon('cash')).setDisplaySize(30, 30));
    content.add(this.moneyText);
    y += 38;

    // Two buttons: pay the bank, and play (next day).
    const payBtn = new Button(this, {
      width: 150, height: 66, label: '', icon: uiIcon('ledger'), fontSize: 30, colors: BUTTON_COLORS.blue,
      onClick: () => this.scene.launch('Ledger'),
    });
    payBtn.setPosition(PAD + 75, y + 36);
    this.startBtn = new Button(this, {
      width: 238, height: 66, label: '', icon: uiIcon('play'), fontSize: 38, colors: BUTTON_COLORS.orange,
      onClick: () => this.startNextDay(),
    });
    this.startBtn.setPosition(CARD_W - PAD - 119, y + 36).setPulse(true);
    content.add([payBtn, this.startBtn]);
    y += 78;

    // Rewarded ad: a second paycheque for today.
    this.doubleBtn = null;
    if (s.moneyEarned > 0 && portal.rewardedReady) {
      const bonus = Math.round(s.moneyEarned);
      const btn = new Button(this, {
        width: 200, height: 52, label: '2x', icon: uiIcon('watch'), fontSize: 24, colors: BUTTON_COLORS.blue,
        onClick: () => this.doubleEarnings(bonus),
      });
      btn.setPosition(CARD_W / 2, y + 26);
      content.add(btn);
      this.doubleBtn = btn;
      y += 62;
    }

    // Paper panel sized to the content.
    this.cardH = y + 6;
    const panelH = this.cardH - 22;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(-CARD_W / 2 + 4, 40 + 8, CARD_W, panelH, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(-CARD_W / 2 + 8, 48, CARD_W - 16, panelH - 16, 18);
    this.card.sendToBack(panel);

    this.refreshFinance();
    this.animateIn(content, rowTexts, [photo], [depthValue, bar]);
  }

  /** Debt, overdue amount, deadline text and money: refreshed after the player pays the bank. */
  private refreshFinance(): void {
    if (!this.debtText || !this.overdueText || !this.deadlineText || !this.moneyText) return;
    const v = state.ledger;
    this.debtText.setText(formatMoney(v.debtRemaining));
    if (v.overdue > 0) this.overdueText.setText(`Overdue ${formatMoney(v.overdue)}`).setVisible(true);
    else this.overdueText.setVisible(false);
    const f = this.summary.finance;
    let message: string;
    let color = SOFT;
    if (v.debtFree) {
      message = 'The debt is paid. The family is safe.';
      color = GREEN;
    } else if (f.isMonthEnd) {
      if (v.overdue > 0) {
        message = `Last day of the month. Pay ${formatMoney(v.overdue)} or the run ends.`;
        color = RED;
      } else {
        message = 'Month cleared. A new month starts tomorrow.';
        color = GREEN;
      }
    } else {
      message = `Month ${v.monthNumber}: ${f.daysLeftInMonth} day${f.daysLeftInMonth === 1 ? '' : 's'} left`;
    }
    this.deadlineText.setText(message).setColor(color);
    this.moneyText.setText(formatMoney(state.economy.money));
  }

  /** Rows slide in one after another while their numbers count up. */
  private animateIn(
    content: Phaser.GameObjects.Container,
    rows: Array<{ items: FadeItem[]; value: Phaser.GameObjects.Text; row: StatRow }>,
    intro: FadeItem[],
    depth: FadeItem[],
  ): void {
    const reveal = (items: FadeItem[], delay: number) => {
      for (const item of items) {
        const baseX = item.x;
        item.setAlpha(0);
        item.x = baseX - 22;
        this.tweens.add({ targets: item, alpha: 1, x: baseX, duration: 320, delay, ease: 'Cubic.easeOut' });
      }
    };
    reveal(intro, 380);
    rows.forEach(({ items, value, row }, i) => {
      const delay = 520 + i * 110;
      reveal(items, delay);
      this.tweens.addCounter({
        from: 0, to: row.value, duration: 700, delay,
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => value.setText(row.format(tw.getValue() ?? 0)),
      });
    });
    reveal(depth, 520 + rows.length * 110);
    content.setAlpha(1);
    this.startBtn.setAlpha(0);
    this.tweens.add({ targets: this.startBtn, alpha: 1, duration: 300, delay: 520 + (rows.length + 2) * 110 });
  }

  // ---------- layout ----------

  private fit(): void {
    const { width: w, height: h } = this.scale;
    // The ribbon starts at y = 2 and the paper ends at cardH + 18: that is the whole visible extent.
    const extent = this.cardH + 16;
    const scale = Math.min(1.15, (w - 24) / CARD_W, (h - 20) / extent);
    this.card.setScale(scale);
    this.card.setPosition(w / 2, (h - extent * scale) / 2 - 2 * scale);
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.dim.setSize(w, h);
    (this.dim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.fit();
  }

  // ---------- actions ----------

  private doubleEarnings(bonus: number): void {
    const btn = this.doubleBtn;
    if (!btn || !btn.isEnabled) return;
    portal.rewarded(() => {
      state.economy.grant(bonus);
      sfx.coin();
      btn.setIcon(uiIcon('check')).setLabel('').setEnabled(false);
      this.refreshFinance();
    });
  }

  private startNextDay(): void {
    if (this.activated) return;
    this.activated = true;
    sfx.click();
    // A natural pause: CrazyGames midgame ad (rate-limited, never in the first minutes).
    if (!portal.midgame(() => this.beginDay())) this.beginDay();
  }

  private beginDay(): void {
    state.startNextDay();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.85, duration: 240, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 300, onComplete: () => this.scene.stop() });
  }
}
