import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { portal } from '../ads/Portal';
import { TOOL_DEFS } from '../data/tools';
import {
  TOOL_SECTIONS,
  UPGRADE_SECTIONS,
  upgradePrice,
  type StoreTab,
  type ToolItem,
  type UpgradeItem,
} from '../data/store';
import { storeIconKey } from '../art/StoreArt';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';
import { Toast } from '../ui/Toast';

/** The card is laid out in this design space, then scaled to fit the screen. */
const CARD_W = 520;
const MIN_H = 480;
const MAX_H = 800;
const PAD = 20;
const LIST_W = CARD_W - PAD * 2;
const VIEW_TOP = 138;
const ROW_H = 92;
const HEADER_H = 46;

const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';
const GREEN_INK = '#2a8a3a';
/** Looks greyed out but still answers a press (with a hint about what is missing). */
const NOT_YET = BUTTON_COLORS.disabled;
/** Cash from the "watch an ad" row, scaled to the player's level. */
const adCash = (): number => 50 + 25 * state.progress.level;

/**
 * The store: a paper card over the paused game with two tabs. DISPLAY ONLY -
 * nothing is bought yet. Connect the game in `requestPurchase()`.
 */
export class StoreScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private card!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Graphics;
  private list!: Phaser.GameObjects.Container;
  private listCam!: Phaser.Cameras.Scene2D.Camera;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private toast!: Toast;
  private moneyText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private tabButtons = new Map<StoreTab, Button>();
  private tab: StoreTab = 'tools';
  private cardH = MIN_H;
  private viewH = 300;
  private contentH = 0;
  private scrollY = 0;
  private dragging = false;
  private dragStartY = 0;
  private lastPointerY = 0;
  private pausedKey: string | null = null;
  private closing = false;

  constructor() {
    super('Store');
  }

  init(): void {
    this.tab = 'tools';
    this.scrollY = 0;
    this.dragging = false;
    this.closing = false;
    this.tabButtons = new Map();
  }

  create(): void {
    const { width: w, height: h } = this.scale;

    // Freeze whatever the player was doing underneath.
    this.pausedKey = state.mode === 'dig' ? 'Dig' : 'Workshop';
    if (this.scene.isActive(this.pausedKey)) this.scene.pause(this.pausedKey);
    else this.pausedKey = null;

    this.dim = this.add.rectangle(0, 0, w, h, 0x120a04, 0).setOrigin(0, 0).setInteractive();
    this.tweens.add({ targets: this.dim, fillAlpha: 0.66, duration: 220 });

    this.card = this.add.container(0, 0);
    this.panel = this.add.graphics();
    // The scrolling list is drawn by its own camera whose viewport is the list window:
    // a cheap hardware scissor instead of a stencil mask, and it clips taps too.
    this.list = this.add.container(0, 0);
    this.listCam = this.cameras.add(0, 0, 10, 10);
    this.scrollbar = this.add.graphics();
    this.toast = new Toast(this);
    this.card.add([this.panel, this.scrollbar]);
    this.buildHeader();
    this.card.add(this.toast);
    this.listCam.ignore([this.dim, this.card]);

    this.buildList();
    this.fit();

    this.card.setAlpha(0);
    this.list.setAlpha(0);
    this.tweens.add({ targets: [this.card, this.list], alpha: 1, duration: 220 });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.resumeUnderneath();
    });

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setScroll(this.scrollY + dy * 0.8);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      this.dragStartY = p.y;
      this.lastPointerY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (!this.dragging && Math.abs(p.y - this.dragStartY) > 8) this.dragging = true;
      if (this.dragging) this.setScroll(this.scrollY - (p.y - this.lastPointerY) / this.card.scaleY);
      this.lastPointerY = p.y;
    });
    this.dim.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!this.dragging && !this.insideCard(p)) this.close();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  // ---------- construction ----------

  private buildHeader(): void {
    const title = this.add.text(CARD_W / 2, 36, 'STORE', outlinedStyle(34)).setOrigin(0.5);
    const ribbonW = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 16, ribbonW, 52, 14);
    ribbon.fillStyle(0xff8a3d).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 10, ribbonW, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2 + 8, 14, ribbonW - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - ribbonW / 2, 10, ribbonW, 52, 14);
    title.setY(36);

    // Read-only money display.
    const coin = this.add.image(PAD + 14, 30, 'coin').setScale(0.55);
    this.moneyText = this.add.text(PAD + 32, 30, formatMoney(state.economy.money), outlinedStyle(20, PALETTE.money)).setOrigin(0, 0.5);
    this.levelText = this.add.text(PAD + 4, 54, '', textStyle(13, SOFT_INK)).setOrigin(0, 0.5);
    this.paintMoney();

    // Close button.
    const close = this.add.container(CARD_W - PAD - 18, 36);
    const cg = this.add.graphics();
    cg.fillStyle(0x000000, 0.25).fillCircle(0, 3, 20);
    cg.fillStyle(0xe5533d).fillCircle(0, 0, 20);
    cg.lineStyle(3, 0x3b2616, 0.9).strokeCircle(0, 0, 20);
    cg.lineStyle(5, 0xffffff).lineBetween(-7, -7, 7, 7).lineBetween(-7, 7, 7, -7);
    close.add(cg).setSize(40, 40).setInteractive({ useHandCursor: true });
    close.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (!this.dragging) this.close();
    });

    const tabs: Array<{ id: StoreTab; label: string }> = [
      { id: 'tools', label: 'TOOLS' },
      { id: 'upgrades', label: 'UPGRADES' },
    ];
    tabs.forEach((t, i) => {
      const b = new Button(this, {
        width: 224, height: 48, label: t.label, fontSize: 22, colors: BUTTON_COLORS.blue,
        onClick: () => this.selectTab(t.id),
      });
      b.setPosition(CARD_W / 2 + (i === 0 ? -118 : 118), 96);
      this.tabButtons.set(t.id, b);
      this.card.add(b);
    });
    this.card.add([ribbon, title, coin, this.moneyText, this.levelText, close]);
    this.paintTabs();
  }

  private paintMoney(): void {
    const p = state.progress.levelProgress;
    this.moneyText.setText(formatMoney(state.economy.money));
    this.levelText.setText(`Level ${p.level}  -  ${p.into}/${p.need} XP`);
  }

  private paintTabs(): void {
    this.tabButtons.forEach((b, id) => b.setColors(id === this.tab ? BUTTON_COLORS.orange : BUTTON_COLORS.blue));
  }

  private selectTab(tab: StoreTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.paintTabs();
    this.scrollY = 0;
    this.buildList();
    this.applyScroll();
  }

  private buildList(): void {
    this.list.removeAll(true);
    let y = 0;
    y = this.addAdRow(y);
    if (this.tab === 'tools') {
      for (const section of TOOL_SECTIONS) {
        y = this.addHeader(y, section.title, section.subtitle);
        for (const item of section.items) y = this.addToolRow(y, item);
        y += 6;
      }
    } else {
      for (const section of UPGRADE_SECTIONS) {
        y = this.addHeader(y, section.title, section.subtitle);
        for (const item of section.items) y = this.addUpgradeRow(y, item);
        y += 6;
      }
    }
    this.contentH = Math.max(0, y);
    this.cameras.main.ignore(this.list); // new rows must not also draw on the main camera
  }

  /** "Need cash? Watch an ad" - only where ads exist (CrazyGames build or local test). */
  private addAdRow(y: number): number {
    if (!portal.hasAds) return y;
    const g = this.add.graphics();
    g.fillStyle(0x4fb0ff, 0.18).fillRoundedRect(0, 0, LIST_W, 60, 16);
    g.lineStyle(2, 0x2a74c4, 0.5).strokeRoundedRect(0, 0, LIST_W, 60, 16);
    const label = this.add.text(14, 30, `Need cash?  Watch a short ad for ${formatMoney(adCash())}`, textStyle(16, INK)).setOrigin(0, 0.5);
    const row = this.add.container(0, y, [g, label]);
    const b = new Button(this, { width: 112, height: 42, label: 'WATCH', fontSize: 18, colors: BUTTON_COLORS.blue, onClick: () => this.watchForCash() });
    b.setPosition(LIST_W - 12 - 56, 29);
    row.add(b);
    this.list.add(row);
    return y + 60 + 10;
  }

  private watchForCash(): void {
    if (this.dragging || !this.pointerInView()) return;
    if (!portal.rewarded(() => {
      const cash = adCash();
      state.economy.grant(cash);
      this.toast.show(`+${formatMoney(cash)} added!`, 1600);
      sfx.coin();
      this.refreshAll();
    })) this.toast.show(`Next ad ready in ${portal.rewardedWait}s`, 1400);
  }

  private addHeader(y: number, title: string, subtitle: string): number {
    const g = this.add.graphics();
    g.lineStyle(2, 0x7a5a3a, 0.25).lineBetween(0, y + HEADER_H - 8, LIST_W, y + HEADER_H - 8);
    const t = this.add.text(4, y + 14, title, textStyle(22, INK)).setOrigin(0, 0.5);
    const s = this.add.text(LIST_W - 4, y + 16, subtitle, textStyle(14, SOFT_INK)).setOrigin(1, 0.5);
    this.list.add([g, t, s]);
    return y + HEADER_H;
  }

  private rowBase(y: number, item: ToolItem | UpgradeItem, faded: boolean): Phaser.GameObjects.Container {
    const row = this.add.container(0, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.12).fillRoundedRect(0, 4, LIST_W, ROW_H - 8, 16);
    bg.fillStyle(0xf1dcb8, faded ? 0.55 : 1).fillRoundedRect(0, 0, LIST_W, ROW_H - 8, 16);
    bg.lineStyle(2, 0x3b2616, 0.22).strokeRoundedRect(0, 0, LIST_W, ROW_H - 8, 16);
    // Icon tile.
    const tile = 68;
    bg.fillStyle(0xfff3dc, 1).fillRoundedRect(10, (ROW_H - 8 - tile) / 2, tile, tile, 12);
    bg.lineStyle(2, 0x3b2616, 0.2).strokeRoundedRect(10, (ROW_H - 8 - tile) / 2, tile, tile, 12);
    const icon = this.add.image(10 + tile / 2, (ROW_H - 8) / 2, storeIconKey(item.id));
    icon.setScale((tile - 8) / Math.max(icon.width, icon.height, 1));
    row.add([bg, icon]);
    this.list.add(row);
    return row;
  }

  private buyButton(row: Phaser.GameObjects.Container, label: string, enabled: boolean, colors: typeof BUTTON_COLORS.green, onClick: () => void): void {
    const b = new Button(this, { width: 124, height: 48, label, fontSize: 18, colors, onClick });
    b.setPosition(LIST_W - 12 - 62, (ROW_H - 8) / 2).setEnabled(enabled);
    row.add(b);
  }

  private addToolRow(y: number, item: ToolItem): number {
    const row = this.rowBase(y, item, !!item.placeholder);
    const textX = 92;
    const owned = state.progress.owns(item.id);
    const locked = !owned && !item.placeholder && state.progress.level < item.minLevel;
    row.add(this.add.text(textX, 12, item.name, textStyle(20, INK)).setOrigin(0, 0));
    row.add(this.add.text(textX, 36, item.blurb, { ...textStyle(14, SOFT_INK), wordWrap: { width: LIST_W - textX - 150 }, lineSpacing: 2 }).setOrigin(0, 0));
    const stat = this.toolStat(item);
    if (stat) row.add(this.add.text(textX, 62, stat, textStyle(13, GREEN_INK)).setOrigin(0, 0));
    const weaker = !owned && item.kind === 'dig' && !item.placeholder && TOOL_DEFS[item.id].power <= TOOL_DEFS[state.progress.equippedToolId].power;
    if (item.placeholder) this.buyButton(row, 'SOON', false, BUTTON_COLORS.green, () => undefined);
    else if (owned) this.buyButton(row, state.progress.equippedToolId === item.id ? 'EQUIPPED' : 'OWNED', false, BUTTON_COLORS.green, () => undefined);
    else if (locked) this.buyButton(row, `LEVEL ${item.minLevel}`, true, NOT_YET, () => this.requestPurchase(item));
    else if (weaker) this.buyButton(row, 'WEAKER', false, BUTTON_COLORS.green, () => undefined);
    else this.buyButton(row, formatMoney(item.price), true, state.economy.money >= item.price ? BUTTON_COLORS.green : NOT_YET, () => this.requestPurchase(item));
    return y + ROW_H;
  }

  /** A one-line "what it does" under the description. */
  private toolStat(item: ToolItem): string {
    if (item.placeholder) return '';
    const def = TOOL_DEFS[item.id];
    if (def) return `Power ${def.power}   Swing ${(1000 / def.swingCooldownMs).toFixed(1)}/s`;
    if (item.id === 'tool-scanner') return '+25% rock finds';
    if (item.id === 'tool-deep-scanner') return '+50% finds, shows rarity';
    return '';
  }

  private addUpgradeRow(y: number, item: UpgradeItem): number {
    const row = this.rowBase(y, item, false);
    const textX = 92;
    const level = state.progress.upgradeLevel(item.id);
    row.add(this.add.text(textX, 8, item.name, textStyle(20, INK)).setOrigin(0, 0));
    row.add(this.add.text(textX, 32, item.perLevel, textStyle(15, GREEN_INK)).setOrigin(0, 0));
    row.add(this.add.text(textX, 50, item.blurb, textStyle(13, SOFT_INK)).setOrigin(0, 0));
    // Level pips.
    const pips = this.add.graphics();
    // Endless upgrades (hundreds of levels) show just the number.
    const endless = item.maxLevel > 12;
    for (let i = 0; i < (endless ? 0 : item.maxLevel); i++) {
      const filled = i < level;
      pips.fillStyle(filled ? PALETTE.gold : 0x3b2616, filled ? 1 : 0.18).fillCircle(textX + 6 + i * 17, 74, 6);
      if (filled) pips.lineStyle(2, 0x3b2616, 0.8).strokeCircle(textX + 6 + i * 17, 74, 6);
    }
    row.add(pips);
    row.add(this.add.text(endless ? textX : textX + item.maxLevel * 17 + 4, 74, endless ? `Level ${level}` : `Lv ${level}/${item.maxLevel}`, textStyle(13, SOFT_INK)).setOrigin(0, 0.5));
    if (level >= item.maxLevel) this.buyButton(row, 'MAX', false, BUTTON_COLORS.green, () => undefined);
    else {
      const price = upgradePrice(item, level);
      this.buyButton(row, formatMoney(price), true, state.economy.money >= price ? BUTTON_COLORS.green : NOT_YET, () => this.requestPurchase(item));
    }
    return y + ROW_H;
  }

  // ---------- purchasing ----------

  /** Presses on a price button: really buys (or explains what is missing). */
  private requestPurchase(item: ToolItem | UpgradeItem): void {
    if (this.dragging || !this.pointerInView()) return;
    const isTool = 'kind' in item;
    const result = isTool ? state.buyTool(item) : state.buyUpgrade(item);
    switch (result) {
      case 'ok':
        sfx.sell();
        this.toast.show(isTool ? `${item.name} is yours!` : `${item.name} upgraded!`, 1600);
        this.refreshAll();
        break;
      case 'poor': {
        const price = isTool ? item.price : upgradePrice(item, state.progress.upgradeLevel(item.id));
        sfx.denied();
        this.toast.show(`Need ${formatMoney(price - state.economy.money)} more`, 1500);
        break;
      }
      case 'locked':
        sfx.denied();
        this.toast.show(`Reach level ${(item as ToolItem).minLevel} to unlock`, 1600);
        break;
      default:
        sfx.denied();
    }
  }

  /** Money, level and every row after something changed. */
  private refreshAll(): void {
    this.paintMoney();
    this.buildList();
    this.applyScroll();
  }

  // ---------- scrolling & layout ----------

  private get maxScroll(): number {
    return Math.max(0, this.contentH - this.viewH);
  }

  private setScroll(v: number): void {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.applyScroll();
  }

  private applyScroll(): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScroll);
    const s = this.card.scaleX;
    this.list.setPosition(this.card.x + PAD * s, this.card.y + (VIEW_TOP - this.scrollY) * s);
    const g = this.scrollbar;
    g.clear();
    if (this.maxScroll <= 0) return;
    const trackH = this.viewH;
    const thumbH = Math.max(36, (this.viewH / this.contentH) * trackH);
    const thumbY = VIEW_TOP + (this.scrollY / this.maxScroll) * (trackH - thumbH);
    g.fillStyle(0x3b2616, 0.12).fillRoundedRect(CARD_W - 12, VIEW_TOP, 5, trackH, 2.5);
    g.fillStyle(0x3b2616, 0.5).fillRoundedRect(CARD_W - 12, thumbY, 5, thumbH, 2.5);
  }

  private fit(): void {
    const { width: w, height: h } = this.scale;
    let s = Math.min(1.15, (w - 16) / CARD_W);
    let ch = (h - 16) / s;
    if (ch < MIN_H) {
      s = (h - 16) / MIN_H;
      ch = MIN_H;
    }
    this.cardH = Math.min(ch, MAX_H);
    this.viewH = this.cardH - VIEW_TOP - 54;
    this.card.setScale(s);
    this.card.setPosition((w - CARD_W * s) / 2, (h - this.cardH * s) / 2);

    const p = this.panel;
    p.clear();
    p.fillStyle(0x000000, 0.3).fillRoundedRect(4, 12, CARD_W, this.cardH - 6, 24);
    p.fillStyle(0xfff3dc).fillRoundedRect(0, 4, CARD_W, this.cardH - 8, 24);
    p.lineStyle(4, 0x3b2616, 0.9).strokeRoundedRect(0, 4, CARD_W, this.cardH - 8, 24);
    p.lineStyle(2, PALETTE.gold, 0.5).strokeRoundedRect(8, 12, CARD_W - 16, this.cardH - 24, 18);

    const vx = Math.round(this.card.x + PAD * s);
    const vy = Math.round(this.card.y + VIEW_TOP * s);
    this.listCam.setViewport(vx, vy, Math.round(LIST_W * s), Math.round(this.viewH * s));
    this.listCam.setScroll(vx, vy);
    this.list.setScale(s);
    this.toast.place(CARD_W / 2, this.cardH - 30, 16);
    this.applyScroll();
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

  /** Buttons scrolled out of sight are still hit-testable; ignore their clicks. */
  private pointerInView(): boolean {
    const p = this.input.activePointer;
    const s = this.card.scaleX;
    const top = this.card.y + VIEW_TOP * s;
    return p.y >= top && p.y <= top + this.viewH * s;
  }

  // ---------- closing ----------

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: [this.card, this.list], alpha: 0, duration: 160, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 180, onComplete: () => this.scene.stop() });
  }

  private resumeUnderneath(): void {
    if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
    this.pausedKey = null;
  }
}
