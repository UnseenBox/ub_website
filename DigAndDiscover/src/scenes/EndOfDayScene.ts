import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle } from '../config/Theme';
import { state, type DaySummary } from '../core/GameState';
import { paintFamilyPhoto } from '../art/FamilyPhoto';
import { makeCanvasTexture } from '../art/paint';
import { sfx } from '../audio/Sfx';
import { portal } from '../ads/Portal';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

/** The card is laid out once in this design space, then scaled to fit the screen. */
const CARD_W = 460;
const PAD = 26;
const PHOTO_KEY = 'family-photo';
const INK = '#3b2616';

type FadeItem = Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

interface StatRow {
  icon: string;
  value: number;
  format: (v: number) => string;
  color: string;
}

/**
 * End-of-day summary: a paper card over a dimmed game with the day's numbers,
 * a short warm line, the family photo and the START NEXT DAY button.
 * Money, rocks and excavation progress are untouched by this screen.
 */
export class EndOfDayScene extends Phaser.Scene {
  private summary!: DaySummary;
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 0;
  private startBtn!: Button;
  private doubleBtn: Button | null = null;
  private activated = false;

  constructor() {
    super('EndOfDay');
  }

  init(data: DaySummary): void {
    this.summary = data;
    this.activated = false;
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
    const start = () => this.startNextDay();
    this.input.keyboard?.on('keydown-ENTER', start);
    this.input.keyboard?.on('keydown-SPACE', start);
  }

  // ---------- construction ----------

  private buildCard(): void {
    const s = this.summary;
    const panel = this.add.graphics();
    const content = this.add.container(-CARD_W / 2, 0);
    this.card.add([panel, content]);
    let y = 0;

    // Ribbon: a sun and the day number. No words.
    const title = this.add.text(CARD_W / 2, 0, `\u2600\uFE0F ${s.day}`, outlinedStyle(40)).setOrigin(0.5);
    const ribbonW = title.width + 80;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 8, ribbonW, 56, 14);
    ribbon.fillStyle(0xff8a3d).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 56, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2 + 8, 6, ribbonW - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 56, 14);
    title.setY(30);
    content.add([ribbon, title]);
    y = 84;

    // The family photo: the one warm touch, with nothing written on it.
    if (!this.textures.exists(PHOTO_KEY)) makeCanvasTexture(this.textures, PHOTO_KEY, 400, 300, (ctx, tw, th) => paintFamilyPhoto(ctx, tw, th));
    const photo = this.add.image(CARD_W / 2, y + 84, PHOTO_KEY).setDisplaySize(216, 162).setAngle(-2);
    content.add(photo);
    y += 176;

    // Three numbers, each with its own picture.
    const rows: StatRow[] = [
      { icon: '\u26CF\uFE0F', value: s.rocksDiscovered, format: (v) => `${Math.round(v)}`, color: INK },
      { icon: '\u2702\uFE0F', value: s.rocksProcessed, format: (v) => `${Math.round(v)}`, color: INK },
      { icon: '\u{1F4B0}', value: s.moneyEarned, format: (v) => `+${formatMoney(Math.round(v))}`, color: '#1f9a3b' },
    ];
    const rowTexts: Array<{ items: FadeItem[]; value: Phaser.GameObjects.Text; row: StatRow }> = [];
    rows.forEach((row) => {
      const line = this.add.graphics();
      line.lineStyle(2, 0x7a5a3a, 0.14).lineBetween(PAD, y + 40, CARD_W - PAD, y + 40);
      const icon = this.add.text(PAD + 4, y + 19, row.icon, outlinedStyle(26, '#ffffff', { strokeThickness: 0 })).setOrigin(0, 0.5);
      const value = this.add.text(CARD_W - PAD, y + 19, row.format(0), outlinedStyle(26, row.color === INK ? '#ffffff' : '#8dff9a')).setOrigin(1, 0.5);
      value.setStroke('#3b2616', 4);
      content.add([line, icon, value]);
      rowTexts.push({ items: [line, icon, value], value, row });
      y += 44;
    });
    y += 6;

    // How deep: a ruler, the metres and the layer bar.
    content.add(this.add.text(PAD + 4, y + 16, '\u{1F4CF}', outlinedStyle(26, '#ffffff', { strokeThickness: 0 })).setOrigin(0, 0.5));
    const depthValue = this.add.text(CARD_W - PAD, y + 16, `${Math.round(s.maxDepthMeters)} m`, outlinedStyle(26)).setOrigin(1, 0.5);
    content.add(depthValue);
    y += 44;
    const barW = CARD_W - PAD * 2;
    const bar = this.add.graphics();
    let bx = PAD;
    state.layers.forEach((layer, i) => {
      const segW = (layer.thickness / state.dig.totalDepthUnits) * barW;
      bar.fillStyle(layer.look.gauge, i < s.layerIndex ? 1 : 0.35).fillRect(bx, y, Math.max(1, segW - 2), 14);
      bx += segW;
    });
    bar.lineStyle(3, 0x3b2616, 0.8).strokeRoundedRect(PAD - 2, y - 2, barW + 4, 18, 6);
    const markX = PAD + barW * s.depthFraction;
    bar.fillStyle(0xffffff).fillTriangle(markX - 7, y - 10, markX + 7, y - 10, markX, y);
    bar.lineStyle(2, 0x3b2616).strokeTriangle(markX - 7, y - 10, markX + 7, y - 10, markX, y);
    content.add(bar);
    y += 40;

    // One big button: play.
    this.startBtn = new Button(this, {
      width: 250, height: 70, label: '\u25B6', fontSize: 38, colors: BUTTON_COLORS.orange,
      onClick: () => this.startNextDay(),
    });
    this.startBtn.setPosition(CARD_W / 2, y + 38).setPulse(true);
    content.add(this.startBtn);
    y += 90;

    // Rewarded ad: a second paycheque for today.
    this.doubleBtn = null;
    if (s.moneyEarned > 0 && portal.rewardedReady) {
      const bonus = Math.round(s.moneyEarned);
      const btn = new Button(this, {
        width: 200, height: 52, label: '2x  \u25B6', fontSize: 24, colors: BUTTON_COLORS.blue,
        onClick: () => this.doubleEarnings(bonus),
      });
      btn.setPosition(CARD_W / 2, y - 12);
      content.add(btn);
      this.doubleBtn = btn;
      y += 52;
    }

    // Paper panel sized to the content.
    this.cardH = y + 6;
    const panelH = this.cardH - 22;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(-CARD_W / 2 + 4, 40 + 8, CARD_W, panelH, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(-CARD_W / 2 + 8, 48, CARD_W - 16, panelH - 16, 18);
    this.card.sendToBack(panel);

    this.animateIn(content, rowTexts, [photo], [depthValue, bar]);
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
    const scale = Math.min(1.15, (w - 24) / CARD_W, (h - 20) / this.cardH);
    this.card.setScale(scale);
    this.card.setPosition(w / 2, (h - this.cardH * scale) / 2 - 40 * scale);
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
      btn.setLabel('\u2714\uFE0F').setEnabled(false);
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
