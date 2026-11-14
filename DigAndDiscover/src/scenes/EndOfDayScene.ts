import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state, type DaySummary } from '../core/GameState';
import { pickDayMessage } from '../data/dayMessages';
import { paintFamilyPhoto } from '../art/FamilyPhoto';
import { makeCanvasTexture } from '../art/paint';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

/** The card is laid out once in this design space, then scaled to fit the screen. */
const CARD_W = 460;
const PAD = 26;
const PHOTO_KEY = 'family-photo';
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';

type FadeItem = Phaser.GameObjects.Text | Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

interface StatRow {
  label: string;
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

    // Ribbon title.
    const title = this.add.text(CARD_W / 2, 0, `DAY ${s.day} COMPLETE`, outlinedStyle(34)).setOrigin(0.5);
    const ribbonW = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 8, ribbonW, 52, 14);
    ribbon.fillStyle(0xff8a3d).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2 + 8, 6, ribbonW - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - ribbonW / 2, 2, ribbonW, 52, 14);
    title.setY(28);
    content.add([ribbon, title]);
    y = 78;

    const hours = Number.isInteger(s.hoursWorked) ? `${s.hoursWorked}` : s.hoursWorked.toFixed(1);
    content.add(this.add.text(CARD_W / 2, y, `${s.startLabel} - ${s.endLabel}   |   ${hours} hours worked`, textStyle(16, SOFT_INK)).setOrigin(0.5, 0));
    y += 38;

    // Family photo and a warm line.
    if (!this.textures.exists(PHOTO_KEY)) makeCanvasTexture(this.textures, PHOTO_KEY, 400, 300, (ctx, tw, th) => paintFamilyPhoto(ctx, tw, th));
    const photo = this.add.image(PAD, y, PHOTO_KEY).setOrigin(0, 0).setDisplaySize(150, 112).setAngle(-3);
    photo.setPosition(PAD + 6, y + 6);
    content.add(photo);
    const message = this.add
      .text(PAD + 176, y + 56, pickDayMessage(s.moneyEarned, s.day), {
        ...textStyle(17, INK),
        wordWrap: { width: CARD_W - PAD * 2 - 182 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0.5);
    content.add(message);
    y += 132;

    // Stat rows.
    const rows: StatRow[] = [
      { label: 'Rocks discovered', value: s.rocksDiscovered, format: (v) => `${Math.round(v)}`, color: INK },
      { label: 'Rocks processed', value: s.rocksProcessed, format: (v) => `${Math.round(v)}`, color: INK },
      { label: 'Money earned', value: s.moneyEarned, format: (v) => `+${formatMoney(Math.round(v))}`, color: '#1f9a3b' },
      { label: 'Total discoveries', value: s.totalDiscoveries, format: (v) => `${Math.round(v)}`, color: INK },
    ];
    const rowTexts: Array<{ items: FadeItem[]; value: Phaser.GameObjects.Text; row: StatRow }> = [];
    rows.forEach((row, i) => {
      const line = this.add.graphics();
      line.lineStyle(2, 0x7a5a3a, 0.14).lineBetween(PAD, y + 34, CARD_W - PAD, y + 34);
      const label = this.add.text(PAD, y + 16, row.label, textStyle(19, SOFT_INK)).setOrigin(0, 0.5);
      const value = this.add.text(CARD_W - PAD, y + 16, row.format(0), outlinedStyle(22, row.color === INK ? '#ffffff' : '#8dff9a')).setOrigin(1, 0.5);
      value.setStroke('#3b2616', 4);
      content.add([line, label, value]);
      rowTexts.push({ items: [line, label, value], value, row });
      y += 38;
      if (i === rows.length - 1) y += 4;
    });

    // Underground progress.
    content.add(this.add.text(PAD, y + 14, 'Underground', textStyle(19, SOFT_INK)).setOrigin(0, 0.5));
    const depthValue = this.add.text(CARD_W - PAD, y + 14, `${s.maxDepthMeters.toFixed(1)} m`, outlinedStyle(22)).setOrigin(1, 0.5);
    content.add(depthValue);
    y += 36;
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
    content.add(this.add.text(PAD, y + 24, `${s.layerName}  -  layer ${s.layerIndex} of ${s.layerCount}`, textStyle(15, SOFT_INK)).setOrigin(0, 0.5));
    content.add(this.add.text(CARD_W - PAD, y + 24, `Savings: ${formatMoney(s.totalMoney)}`, textStyle(15, SOFT_INK)).setOrigin(1, 0.5));
    y += 56;

    // Button.
    this.startBtn = new Button(this, {
      width: 330, height: 64, label: 'START NEXT DAY', fontSize: 26, colors: BUTTON_COLORS.orange,
      onClick: () => this.startNextDay(),
    });
    this.startBtn.setPosition(CARD_W / 2, y + 36).setPulse(true);
    content.add(this.startBtn);
    y += 84;

    // Paper panel sized to the content.
    this.cardH = y + 6;
    const panelH = this.cardH - 22;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(-CARD_W / 2 + 4, 40 + 8, CARD_W, panelH, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(-CARD_W / 2, 40, CARD_W, panelH, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(-CARD_W / 2 + 8, 48, CARD_W - 16, panelH - 16, 18);
    this.card.sendToBack(panel);

    this.animateIn(content, rowTexts, [photo, message], [depthValue, bar]);
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

  private startNextDay(): void {
    if (this.activated) return;
    this.activated = true;
    sfx.click();
    state.startNextDay();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.85, duration: 240, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 300, onComplete: () => this.scene.stop() });
  }
}
