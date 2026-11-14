import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { CURIOS, CURIO_CATEGORIES, CURIO_TIER_LABELS, type CurioDef } from '../data/curios';
import { curioKey } from '../art/CurioArt';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';

const CARD_W = 480;
const PAD = 22;
const COLS = 8;
const CELL = (CARD_W - PAD * 2) / COLS;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';

/**
 * The collection: every curio as a sticker (a dark silhouette until found), with the
 * joke line of the selected one underneath. Pauses the game like the store does.
 */
export class CollectionScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private cardH = 500;
  private pausedKey: string | null = null;
  private closing = false;
  private selectRing!: Phaser.GameObjects.Graphics;
  private cells: Array<{ curio: CurioDef; x: number; y: number }> = [];
  private nameText!: Phaser.GameObjects.Text;
  private metaText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;

  constructor() {
    super('Collection');
  }

  init(): void {
    this.closing = false;
    this.cells = [];
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

    const found = state.progress.curiosFound;
    const title = this.add.text(CARD_W / 2, 36, 'COLLECTION', outlinedStyle(32)).setOrigin(0.5);
    const rw = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 16, rw, 52, 14);
    ribbon.fillStyle(0xb98cff).fillRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 14, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    content.add([ribbon, title]);

    let y = 84;
    content.add(this.add.text(PAD, y + 8, `Found ${found} of ${CURIOS.length}`, textStyle(19, INK)).setOrigin(0, 0.5));
    const next = 5 * (Math.floor(found / 5) + 1);
    content.add(this.add.text(CARD_W - PAD, y + 8, found >= CURIOS.length ? 'All found!' : `Bonus at ${next}`, textStyle(15, SOFT_INK)).setOrigin(1, 0.5));
    const bar = this.add.graphics();
    bar.fillStyle(0x3b2616, 0.18).fillRoundedRect(PAD, y + 24, CARD_W - PAD * 2, 12, 6);
    bar.fillStyle(0xb98cff).fillRoundedRect(PAD, y + 24, Math.max(12, ((CARD_W - PAD * 2) * found) / CURIOS.length), 12, 6);
    bar.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(PAD, y + 24, CARD_W - PAD * 2, 12, 6);
    content.add(bar);
    y += 52;

    // Grid.
    const gridTop = y;
    this.selectRing = this.add.graphics();
    content.add(this.selectRing);
    CURIOS.forEach((curio, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = PAD + col * CELL + CELL / 2;
      const cy = gridTop + row * CELL + CELL / 2;
      const count = state.progress.curioCount(curio.id);
      const icon = this.add.image(0, 0, curioKey(curio.id));
      icon.setScale((CELL - 8) / Math.max(icon.width, icon.height, 1));
      if (count === 0) icon.setTintFill(0x3b2616).setAlpha(0.45);
      const cell = this.add.container(cx, cy, [icon]);
      if (count > 1) {
        const badge = this.add.text(CELL * 0.3, CELL * 0.3, `x${count}`, outlinedStyle(12, '#ffffff')).setOrigin(0.5);
        cell.add(badge);
      }
      cell.setSize(CELL, CELL).setInteractive({ useHandCursor: true });
      cell.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.select(curio));
      content.add(cell);
      this.cells.push({ curio, x: cx, y: cy });
    });
    const rows = Math.ceil(CURIOS.length / COLS);
    y = gridTop + rows * CELL + 10;

    // Detail panel.
    const detail = this.add.graphics();
    detail.fillStyle(0xf1dcb8).fillRoundedRect(PAD, y, CARD_W - PAD * 2, 92, 14);
    detail.lineStyle(2, 0x3b2616, 0.25).strokeRoundedRect(PAD, y, CARD_W - PAD * 2, 92, 14);
    content.add(detail);
    this.nameText = this.add.text(PAD + 14, y + 10, '', textStyle(20, INK)).setOrigin(0, 0);
    this.metaText = this.add.text(CARD_W - PAD - 14, y + 14, '', textStyle(13, SOFT_INK)).setOrigin(1, 0);
    this.lineText = this.add.text(PAD + 14, y + 40, '', { ...textStyle(15, SOFT_INK), wordWrap: { width: CARD_W - PAD * 2 - 28 }, lineSpacing: 2 }).setOrigin(0, 0);
    content.add([this.nameText, this.metaText, this.lineText]);
    y += 104;

    const ok = new Button(this, { width: 220, height: 54, label: 'KEEP DIGGING', fontSize: 22, colors: BUTTON_COLORS.orange, onClick: () => this.close() });
    ok.setPosition(CARD_W / 2, y + 30);
    content.add(ok);
    y += 70;

    this.cardH = y + 10;
    const ph = this.cardH - 8;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
    this.card.sendToBack(panel);

    // Start on the most recently interesting one: the first found, else the first.
    this.select(CURIOS.find((c) => state.progress.curioCount(c.id) > 0) ?? CURIOS[0], false);
  }

  private select(curio: CurioDef, sound = true): void {
    if (sound) sfx.click();
    const cell = this.cells.find((c) => c.curio === curio);
    this.selectRing.clear();
    if (cell) this.selectRing.lineStyle(4, PALETTE.gold).strokeRoundedRect(cell.x - CELL / 2 + 2, cell.y - CELL / 2 + 2, CELL - 4, CELL - 4, 10);
    const count = state.progress.curioCount(curio.id);
    const cat = CURIO_CATEGORIES[curio.category];
    if (count > 0) {
      this.nameText.setText(curio.name);
      this.metaText.setText(`${cat.label}  -  ${CURIO_TIER_LABELS[curio.tier]}  -  found x${count}`);
      this.lineText.setText(curio.line);
    } else {
      const layer = state.layers[curio.minLayer];
      this.nameText.setText('???');
      this.metaText.setText(`${cat.label}  -  ${CURIO_TIER_LABELS[curio.tier]}`);
      this.lineText.setText(`Not found yet. Try digging in ${layer ? layer.name : 'deeper ground'} or below...`);
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
