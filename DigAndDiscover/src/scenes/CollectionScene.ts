import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { CONDITIONS, FINDS, type FindDef } from '../data/finds';
import { ensureFindTexture } from '../art/FindArt';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

type Tab = 'collection' | 'artifacts' | 'junk';
type GridKind = 'collection' | 'junk';

const CARD_W = 480;
const CARD_H = 584;
const PAD = 22;
const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';
const GREEN_INK = '#2a8a3a';
const COLS = 7;
const CELL = (CARD_W - PAD * 2) / COLS;
/** Where the part that changes with the tab starts and ends (card coordinates). */
const BODY_TOP = 128;
const LIST_TOP = 188;
const ROW_H = 58;
const PER_PAGE = 4;

/**
 * The Finds screen: everything dug up that is not a rock. Three tabs, no words on them.
 * - collection: every collection item as a picture (a dark silhouette until found) with its story
 * - artifacts: what you hold right now; this is the ONLY place an artifact becomes money
 * - junk: what you dug up that nobody wants; counted, never sold
 * Pauses the game like the store does.
 */
export class CollectionScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private tabButtons = new Map<Tab, Button>();
  private pausedKey: string | null = null;
  private closing = false;
  private tab: Tab = 'collection';
  private page = 0;
  private selected: Record<GridKind, string | null> = { collection: null, junk: null };

  constructor() {
    super('Collection');
  }

  init(): void {
    this.closing = false;
    this.tab = 'collection';
    this.page = 0;
    this.selected = { collection: null, junk: null };
    this.tabButtons = new Map();
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

  // ---------- card ----------

  private buildCard(): void {
    const panel = this.add.graphics();
    this.content = this.add.container(0, 0);
    this.card.add([panel, this.content]);

    // Title ribbon with the album picture.
    const rw = 150;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2, 16, rw, 52, 14);
    ribbon.fillStyle(0xb98cff).fillRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - rw / 2 + 8, 14, rw - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - rw / 2, 10, rw, 52, 14);
    const album = this.add.image(CARD_W / 2, 36, uiIcon('album')).setDisplaySize(40, 40);
    this.content.add([ribbon, album]);

    // Tabs: pictures only.
    const tabs: Array<{ id: Tab; icon: string }> = [
      { id: 'collection', icon: uiIcon('collection') },
      { id: 'artifacts', icon: uiIcon('artifact') },
      { id: 'junk', icon: uiIcon('junk') },
    ];
    tabs.forEach((t, i) => {
      const b = new Button(this, {
        width: 140, height: 46, label: '', icon: t.icon, fontSize: 20, colors: BUTTON_COLORS.blue,
        onClick: () => this.selectTab(t.id),
      });
      b.setPosition(CARD_W / 2 + (i - 1) * 150, 98);
      this.tabButtons.set(t.id, b);
      this.content.add(b);
    });

    const ok = new Button(this, {
      width: 220, height: 54, label: '', icon: uiIcon('play'), fontSize: 30, colors: BUTTON_COLORS.orange,
      onClick: () => this.close(),
    });
    ok.setPosition(CARD_W / 2, CARD_H - 52);
    this.content.add(ok);

    const ph = CARD_H - 8;
    panel.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, ph, 24);
    panel.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, ph, 24);
    panel.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, ph - 16, 18);
    this.card.sendToBack(panel);

    this.renderBody();
  }

  private selectTab(tab: Tab): void {
    if (tab === this.tab) return;
    sfx.click();
    this.tab = tab;
    this.page = 0;
    this.renderBody();
  }

  /** Rebuilds the part that depends on the tab. Cheap: it only runs on a tap. */
  private renderBody(): void {
    this.tabButtons.forEach((b, id) => b.setColors(id === this.tab ? BUTTON_COLORS.orange : BUTTON_COLORS.blue));
    this.body?.destroy(true);
    this.body = this.add.container(0, 0);
    this.content.add(this.body);

    if (this.tab === 'artifacts') this.buildArtifacts();
    else this.buildGrid(this.tab);

    // A small count on the artifacts tab while something is waiting to be sold.
    const waiting = state.artifactCount;
    if (waiting > 0 && this.tab !== 'artifacts') {
      const tb = this.tabButtons.get('artifacts');
      if (tb) {
        const dot = this.add.graphics();
        dot.fillStyle(0xe5484d).fillCircle(tb.x + 58, tb.y - 18, 11);
        dot.lineStyle(2, 0xffffff, 0.9).strokeCircle(tb.x + 58, tb.y - 18, 11);
        const n = this.add.text(tb.x + 58, tb.y - 18, `${Math.min(99, waiting)}`, textStyle(12, '#ffffff')).setOrigin(0.5);
        this.body.add([dot, n]);
      }
    }
  }

  // ---------- collection and junk ----------

  private buildGrid(kind: GridKind): void {
    const defs = FINDS.filter((d) => d.category === kind);
    const countOf = (id: string) => (kind === 'collection' ? state.findsInv.collectionCount(id) : state.findsInv.junkCount(id));

    // Counter line.
    const total = defs.length;
    const unique = defs.filter((d) => countOf(d.id) > 0).length;
    const counterIcon = this.add.image(PAD + 16, BODY_TOP + 22, uiIcon(kind)).setDisplaySize(30, 30);
    const counterText = kind === 'collection' ? `${unique} / ${total}` : `${state.findsInv.junkTotal}`;
    this.body.add([counterIcon, this.add.text(PAD + 40, BODY_TOP + 22, counterText, textStyle(24, INK)).setOrigin(0, 0.5)]);
    if (kind === 'collection') {
      const bar = this.add.graphics();
      bar.fillStyle(0x3b2616, 0.18).fillRoundedRect(PAD, BODY_TOP + 44, CARD_W - PAD * 2, 12, 6);
      bar.fillStyle(0xb98cff).fillRoundedRect(PAD, BODY_TOP + 44, Math.max(12, ((CARD_W - PAD * 2) * unique) / Math.max(1, total)), 12, 6);
      bar.lineStyle(2, 0x3b2616, 0.5).strokeRoundedRect(PAD, BODY_TOP + 44, CARD_W - PAD * 2, 12, 6);
      this.body.add(bar);
    }

    // Grid of pictures: found ones in colour with a count, the rest as dark shapes.
    const ring = this.add.graphics();
    this.body.add(ring);
    const spots = new Map<string, { x: number; y: number }>();
    defs.forEach((def, i) => {
      const cx = PAD + (i % COLS) * CELL + CELL / 2;
      const cy = LIST_TOP + Math.floor(i / COLS) * CELL + CELL / 2;
      const n = countOf(def.id);
      const icon = this.add.image(0, 0, ensureFindTexture(this.textures, def));
      icon.setScale((CELL - 10) / Math.max(icon.width, icon.height, 1));
      if (n === 0) icon.setTintFill(0x3b2616).setAlpha(0.4);
      const cell = this.add.container(cx, cy, [icon]);
      if (n > 1) cell.add(this.add.text(CELL * 0.3, CELL * 0.3, `x${n}`, textStyle(12, '#ffffff', { stroke: '#3b2616', strokeThickness: 3 })).setOrigin(0.5));
      cell.setSize(CELL, CELL).setInteractive({ useHandCursor: true });
      cell.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => select(def, true));
      this.body.add(cell);
      spots.set(def.id, { x: cx, y: cy });
    });

    // The story of the selected one.
    const detailY = LIST_TOP + Math.ceil(defs.length / COLS) * CELL + 8;
    const detail = this.add.graphics();
    detail.fillStyle(0xf1dcb8).fillRoundedRect(PAD, detailY, CARD_W - PAD * 2, 64, 14);
    detail.lineStyle(2, 0x3b2616, 0.25).strokeRoundedRect(PAD, detailY, CARD_W - PAD * 2, 64, 14);
    const nameText = this.add.text(CARD_W / 2, detailY + 18, '', textStyle(22, INK)).setOrigin(0.5);
    const storyText = this.add
      .text(CARD_W / 2, detailY + 42, '', textStyle(14, SOFT_INK, { align: 'center', wordWrap: { width: CARD_W - PAD * 2 - 24 } }))
      .setOrigin(0.5);
    this.body.add([detail, nameText, storyText]);

    const select = (def: FindDef, sound: boolean): void => {
      if (sound) sfx.click();
      this.selected[kind] = def.id;
      const spot = spots.get(def.id);
      ring.clear();
      if (spot) ring.lineStyle(4, PALETTE.gold).strokeRoundedRect(spot.x - CELL / 2 + 2, spot.y - CELL / 2 + 2, CELL - 4, CELL - 4, 10);
      const found = countOf(def.id) > 0;
      nameText.setText(found ? def.name : '???');
      storyText.setText(found ? def.history : '');
    };
    const start = defs.find((d) => d.id === this.selected[kind]) ?? defs.find((d) => countOf(d.id) > 0) ?? defs[0];
    if (start) select(start, false);
  }

  // ---------- artifacts ----------

  private buildArtifacts(): void {
    const list = [...state.findsInv.artifacts].sort((a, b) => b.value - a.value);
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);

    // Counter line: how many, and what they are worth together.
    this.body.add(this.add.image(PAD + 16, BODY_TOP + 22, uiIcon('artifact')).setDisplaySize(30, 30));
    this.body.add(this.add.text(PAD + 40, BODY_TOP + 22, `${list.length}`, textStyle(24, INK)).setOrigin(0, 0.5));
    if (list.length > 0) {
      const total = this.add.text(CARD_W - PAD, BODY_TOP + 22, formatMoney(state.artifactValue), textStyle(24, GREEN_INK)).setOrigin(1, 0.5);
      this.body.add([total, this.add.image(total.x - total.width - 20, BODY_TOP + 22, uiIcon('cash')).setDisplaySize(26, 26)]);
    }

    if (list.length === 0) {
      // Nothing to sell: just a faint picture.
      this.body.add(this.add.image(CARD_W / 2, LIST_TOP + 120, uiIcon('artifact')).setDisplaySize(120, 120).setAlpha(0.22));
      return;
    }

    const first = this.page * PER_PAGE;
    list.slice(first, first + PER_PAGE).forEach((item, row) => {
      const def = FINDS.find((d) => d.id === item.defId);
      if (!def) return;
      const top = LIST_TOP + row * ROW_H;
      const bg = this.add.graphics();
      bg.fillStyle(0xf1dcb8).fillRoundedRect(PAD, top + 2, CARD_W - PAD * 2, ROW_H - 6, 14);
      bg.lineStyle(2, 0x3b2616, 0.2).strokeRoundedRect(PAD, top + 2, CARD_W - PAD * 2, ROW_H - 6, 14);
      this.body.add(bg);

      const pic = this.add.image(PAD + 32, top + ROW_H / 2 - 1, ensureFindTexture(this.textures, def));
      pic.setScale(44 / Math.max(pic.width, pic.height, 1));
      this.body.add(pic);

      const name = this.add.text(PAD + 64, top + 18, def.name, textStyle(18, INK)).setOrigin(0, 0.5);
      if (name.width > 180) name.setScale(180 / name.width);
      this.body.add(name);
      // Condition in words, rarity in stars.
      this.body.add(this.add.text(PAD + 64, top + 38, CONDITIONS[item.condition].label, textStyle(13, SOFT_INK)).setOrigin(0, 0.5));
      const stars = def.tier + 1;
      for (let s = 0; s < stars; s++) {
        this.body.add(this.add.image(PAD + 112 + s * 14, top + 38, ICON_STAR).setDisplaySize(14, 14));
      }

      const sell: Button = new Button(this, {
        width: 70, height: 38, label: '', icon: uiIcon('cash'), fontSize: 18, colors: BUTTON_COLORS.green,
        onClick: () => this.sellOne(item.id, sell),
      });
      sell.setPosition(CARD_W - PAD - 41, top + ROW_H / 2 - 1);
      this.body.add(sell);
      const value = this.add.text(CARD_W - PAD - 88, top + ROW_H / 2 - 1, formatMoney(item.value), textStyle(19, GREEN_INK)).setOrigin(1, 0.5);
      this.body.add(value);
    });

    // Bottom row: paging on the left, Sell all on the right.
    const rowY = LIST_TOP + PER_PAGE * ROW_H + 22;
    if (pages > 1) {
      const prev = new Button(this, { width: 46, height: 38, label: '', icon: uiIcon('back'), fontSize: 16, colors: BUTTON_COLORS.blue, onClick: () => this.turn(-1) });
      prev.setPosition(PAD + 24, rowY).setEnabled(this.page > 0);
      const next = new Button(this, { width: 46, height: 38, label: '', icon: uiIcon('play'), fontSize: 16, colors: BUTTON_COLORS.blue, onClick: () => this.turn(1) });
      next.setPosition(PAD + 24 + 98, rowY).setEnabled(this.page < pages - 1);
      const label = this.add.text(PAD + 24 + 49, rowY, `${this.page + 1}/${pages}`, textStyle(16, SOFT_INK)).setOrigin(0.5);
      this.body.add([prev, next, label]);
    }
    const all: Button = new Button(this, {
      width: 230, height: 46, label: formatMoney(state.artifactValue), icon: uiIcon('cash'), fontSize: 22, colors: BUTTON_COLORS.green,
      onClick: () => this.sellEverything(all),
    });
    all.setPosition(CARD_W - PAD - 115, rowY);
    this.body.add(all);
  }

  private turn(step: number): void {
    sfx.click();
    this.page += step;
    this.renderBody();
  }

  /** The only way an artifact turns into money. The HUD plays the coin effect and counts the money up. */
  private sellOne(id: string, from: Button): void {
    const m = from.getWorldTransformMatrix();
    if (state.sellArtifact(id, m.tx, m.ty) > 0) this.renderBody();
  }

  private sellEverything(from: Button): void {
    const m = from.getWorldTransformMatrix();
    if (state.sellAllArtifacts(m.tx, m.ty) > 0) {
      this.page = 0;
      this.renderBody();
    }
  }

  // ---------- layout ----------

  private fit(): void {
    const { width: w, height: h } = this.scale;
    const s = Math.min(1.15, (w - 16) / CARD_W, (h - 16) / CARD_H);
    this.card.setScale(s);
    this.card.setPosition((w - CARD_W * s) / 2, (h - CARD_H * s) / 2);
  }

  private onResize(): void {
    const { width: w, height: h } = this.scale;
    this.dim.setSize(w, h);
    (this.dim.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, w, h);
    this.fit();
  }

  private insideCard(p: Phaser.Input.Pointer): boolean {
    const s = this.card.scaleX;
    return p.x >= this.card.x && p.x <= this.card.x + CARD_W * s && p.y >= this.card.y && p.y <= this.card.y + CARD_H * s;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.card, alpha: 0, scale: this.card.scale * 0.9, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }
}
