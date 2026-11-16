import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { portal } from '../ads/Portal';
import { TOOL_DEFS } from '../data/tools';
import {
  SKILL_SECTIONS,
  TOOL_SECTIONS,
  UPGRADE_SECTIONS,
  upgradePrice,
  type StoreTab,
  type ToolItem,
  type UpgradeItem,
} from '../data/store';
import { storeIconKey } from '../art/StoreArt';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { formatMoney } from '../ui/MoneyCounter';

/** The card is laid out in this design space, then scaled to fit the screen. */
const CARD_W = 520;
const MIN_H = 480;
const MAX_H = 800;
const PAD = 20;
const LIST_W = CARD_W - PAD * 2;
const VIEW_TOP = 138;
const ROW_H = 92;
/** Skill rows also carry a two-line description. */
const SKILL_ROW_H = 118;
const HEADER_H = 46;

const INK = '#3b2616';
const SOFT_INK = '#7a5a3a';
const GREEN_INK = '#2a8a3a';
const RED_INK = '#b23a2a';
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
    this.card.add([this.panel, this.scrollbar]);
    this.buildHeader();
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
  }

  // ---------- construction ----------

  private buildHeader(): void {
    const title = this.add.image(CARD_W / 2, 36, uiIcon('store')).setDisplaySize(44, 44).setOrigin(0.5);
    const ribbonW = title.width + 70;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x000000, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 16, ribbonW, 52, 14);
    ribbon.fillStyle(0xff8a3d).fillRoundedRect(CARD_W / 2 - ribbonW / 2, 10, ribbonW, 52, 14);
    ribbon.fillStyle(0xffffff, 0.25).fillRoundedRect(CARD_W / 2 - ribbonW / 2 + 8, 14, ribbonW - 16, 16, 8);
    ribbon.lineStyle(3, 0x3b2616, 0.9).strokeRoundedRect(CARD_W / 2 - ribbonW / 2, 10, ribbonW, 52, 14);
    title.setY(36);

    // Read-only money display.
    const coinBase = this.textures.get('coin').getSourceImage().width || 52;
    const coin = this.add.image(PAD + 14, 30, 'coin').setScale(28.6 / coinBase);
    this.moneyText = this.add.text(PAD + 32, 30, formatMoney(state.economy.money), outlinedStyle(20, PALETTE.money)).setOrigin(0, 0.5);
    this.levelText = this.add.text(PAD + 30, 54, '', textStyle(16, SOFT_INK)).setOrigin(0, 0.5);
    const levelStar = this.add.image(PAD + 14, 54, ICON_STAR).setDisplaySize(24, 24);
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

    const tabs: Array<{ id: StoreTab; icon: string }> = [
      { id: 'tools', icon: uiIcon('pickaxe') },
      { id: 'upgrades', icon: uiIcon('bolt') },
      { id: 'skills', icon: uiIcon('sparkle') },
    ];
    tabs.forEach((t, i) => {
      const b = new Button(this, {
        width: 158, height: 48, label: '', fontSize: 30, colors: BUTTON_COLORS.blue, icon: t.icon,
        onClick: () => this.selectTab(t.id),
      });
      b.setPosition(CARD_W / 2 + (i - 1) * 168, 96);
      this.tabButtons.set(t.id, b);
      this.card.add(b);
    });
    this.card.add([ribbon, title, coin, this.moneyText, levelStar, this.levelText, close]);
    this.paintTabs();
  }

  private paintMoney(): void {
    const p = state.progress.levelProgress;
    this.moneyText.setText(formatMoney(state.economy.money));
    this.levelText.setText(`${p.level}`);
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
    y = this.addRefillRow(y);
    if (this.tab === 'tools') {
      for (const section of TOOL_SECTIONS) {
        y = this.addHeader(y, section.title, section.subtitle);
        for (const item of section.items) y = this.addToolRow(y, item);
        y += 6;
      }
    } else {
      const sections = this.tab === 'skills' ? SKILL_SECTIONS : UPGRADE_SECTIONS;
      for (const section of sections) {
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
    const cashIcon = this.add.image(14, 30, uiIcon('cash')).setDisplaySize(26, 26).setOrigin(0, 0.5);
    const label = this.add.text(44, 30, `+${formatMoney(adCash())}`, textStyle(26, INK)).setOrigin(0, 0.5);
    const row = this.add.container(0, y, [g, cashIcon, label]);
    const b = new Button(this, { width: 100, height: 42, label: '', fontSize: 24, colors: BUTTON_COLORS.blue, icon: uiIcon('play'), onClick: () => this.watchForCash() });
    b.setPosition(LIST_W - 12 - 50, 29);
    row.add(b);
    this.list.add(row);
    return y + 60 + 10;
  }

  /** "Out of stamina? Watch an ad" - a menu row only, never on the dig screen. Stamina also refills by itself. */
  private addRefillRow(y: number): number {
    if (!portal.hasAds || state.stamina.fraction >= 1) return y;
    const g = this.add.graphics();
    g.fillStyle(0x4fb0ff, 0.18).fillRoundedRect(0, 0, LIST_W, 60, 16);
    g.lineStyle(2, 0x2a74c4, 0.5).strokeRoundedRect(0, 0, LIST_W, 60, 16);
    const icon = this.add.image(14, 30, uiIcon('refill')).setDisplaySize(26, 26).setOrigin(0, 0.5);
    const label = this.add.text(44, 30, 'Refill stamina', textStyle(26, INK)).setOrigin(0, 0.5);
    const row = this.add.container(0, y, [g, icon, label]);
    const b = new Button(this, { width: 100, height: 42, label: '', fontSize: 24, colors: BUTTON_COLORS.blue, icon: uiIcon('play'), onClick: () => this.watchRefill() });
    b.setPosition(LIST_W - 12 - 50, 29);
    row.add(b);
    this.list.add(row);
    return y + 60 + 10;
  }

  /** After an ad that did not play: no reward. If the SDK says ads are off or blocked, the offers disappear. */
  private adSettled(granted: boolean): void {
    if (granted) return;
    sfx.denied();
    if (portal.hasAds) return;
    this.buildList();
    this.applyScroll();
  }

  private watchRefill(): void {
    if (this.dragging || !this.pointerInView()) return;
    if (!portal.rewarded(() => {
      state.stamina.refill();
      sfx.coin();
      this.refreshAll();
    }, (granted) => this.adSettled(granted))) sfx.denied();
  }

  private watchForCash(): void {
    if (this.dragging || !this.pointerInView()) return;
    if (!portal.rewarded(() => {
      const cash = adCash();
      state.economy.grant(cash);
      sfx.coin();
      this.refreshAll();
    }, (granted) => this.adSettled(granted))) sfx.denied();
  }

  private addHeader(y: number, title: string, _subtitle: string): number {
    const g = this.add.graphics();
    g.lineStyle(2, 0x7a5a3a, 0.25).lineBetween(0, y + HEADER_H - 8, LIST_W, y + HEADER_H - 8);
    const t = this.add.text(4, y + 14, title, textStyle(22, INK)).setOrigin(0, 0.5);
    this.list.add([g, t]);
    return y + HEADER_H;
  }

  private rowBase(y: number, item: ToolItem | UpgradeItem, faded: boolean, rowH = ROW_H): Phaser.GameObjects.Container {
    const row = this.add.container(0, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.12).fillRoundedRect(0, 4, LIST_W, rowH - 8, 16);
    bg.fillStyle(0xf1dcb8, faded ? 0.55 : 1).fillRoundedRect(0, 0, LIST_W, rowH - 8, 16);
    bg.lineStyle(2, 0x3b2616, 0.22).strokeRoundedRect(0, 0, LIST_W, rowH - 8, 16);
    // Icon tile.
    const tile = 68;
    bg.fillStyle(0xfff3dc, 1).fillRoundedRect(10, (rowH - 8 - tile) / 2, tile, tile, 12);
    bg.lineStyle(2, 0x3b2616, 0.2).strokeRoundedRect(10, (rowH - 8 - tile) / 2, tile, tile, 12);
    const icon = this.add.image(10 + tile / 2, (rowH - 8) / 2, storeIconKey(item.id));
    icon.setScale((tile - 8) / Math.max(icon.width, icon.height, 1));
    row.add([bg, icon]);
    this.list.add(row);
    return row;
  }

  private buyButton(row: Phaser.GameObjects.Container, label: string, enabled: boolean, colors: typeof BUTTON_COLORS.green, onClick: () => void, icon?: string, rowH = ROW_H): void {
    const b = new Button(this, { width: 124, height: 48, label, fontSize: 18, colors, onClick, icon });
    b.setPosition(LIST_W - 12 - 62, (rowH - 8) / 2).setEnabled(enabled);
    row.add(b);
  }

  private addToolRow(y: number, item: ToolItem): number {
    const row = this.rowBase(y, item, !!item.placeholder || !!item.comingSoon);
    const textX = 92;
    const owned = state.progress.owns(item.id);
    const locked = !owned && !item.placeholder && state.progress.level < item.minLevel;
    row.add(this.add.text(textX, 12, item.name, textStyle(20, INK)).setOrigin(0, 0));
    
    const def = TOOL_DEFS[item.id];
    if (def && !item.placeholder) {
      const pickaxeIcon = this.add.image(textX, 44, uiIcon('pickaxe')).setDisplaySize(20, 20).setOrigin(0, 0.5);
      const pickaxeText = this.add.text(textX + 24, 44, `${def.power}`, textStyle(16, GREEN_INK)).setOrigin(0, 0.5);
      const stopwatchIcon = this.add.image(textX + 60, 44, uiIcon('stopwatch')).setDisplaySize(20, 20).setOrigin(0, 0.5);
      const stopwatchText = this.add.text(textX + 84, 44, `${(1000 / def.swingCooldownMs).toFixed(1)}`, textStyle(16, GREEN_INK)).setOrigin(0, 0.5);
      row.add([pickaxeIcon, pickaxeText, stopwatchIcon, stopwatchText]);
    }
    if (item.id === 'tool-scanner') {
      const magIcon = this.add.image(textX, 44, uiIcon('magnifier')).setDisplaySize(20, 20).setOrigin(0, 0.5);
      const magText = this.add.text(textX + 24, 44, '+25%', textStyle(16, GREEN_INK)).setOrigin(0, 0.5);
      row.add([magIcon, magText]);
    }
    if (item.id === 'tool-deep-scanner') {
      const magIcon = this.add.image(textX, 44, uiIcon('magnifier')).setDisplaySize(20, 20).setOrigin(0, 0.5);
      const magText = this.add.text(textX + 24, 44, '+50%', textStyle(16, GREEN_INK)).setOrigin(0, 0.5);
      const starIcon = this.add.image(textX + 70, 44, ICON_STAR).setDisplaySize(20, 20).setOrigin(0, 0.5);
      row.add([magIcon, magText, starIcon]);
    }
    
    const weaker = !owned && item.kind === 'dig' && !item.placeholder && TOOL_DEFS[item.id].power <= TOOL_DEFS[state.progress.equippedToolId].power;
    if (item.comingSoon || item.placeholder) this.buyButton(row, 'Coming soon', false, NOT_YET, () => undefined);
    else if (owned) this.buyButton(row, '', false, BUTTON_COLORS.green, () => undefined, uiIcon('check'));
    else if (locked) this.buyButton(row, `${item.minLevel}`, true, NOT_YET, () => this.requestPurchase(item), uiIcon('lock'));
    else if (weaker) this.buyButton(row, '', false, BUTTON_COLORS.green, () => undefined, uiIcon('cross'));
    else this.buyButton(row, formatMoney(item.price), true, state.economy.money >= item.price ? BUTTON_COLORS.green : NOT_YET, () => this.requestPurchase(item));
    return y + ROW_H;
  }

  private addUpgradeRow(y: number, item: UpgradeItem): number {
    const skill = item.id.startsWith('trait-');
    const rowH = skill ? SKILL_ROW_H : ROW_H;
    const locked = item.minLevel !== undefined && state.progress.level < item.minLevel;
    const row = this.rowBase(y, item, locked, rowH);
    const textX = 92;
    const level = state.progress.upgradeLevel(item.id);
    row.add(this.add.text(textX, 8, item.name, textStyle(20, INK)).setOrigin(0, 0));
    // What one level does, then (skills) what the skill is.
    const per = this.add.text(textX, 32, item.perLevel, textStyle(13, GREEN_INK, { wordWrap: { width: 244 } })).setOrigin(0, 0);
    row.add(per);
    if (skill) {
      const about = locked ? `Needs prospector level ${item.minLevel}.` : item.blurb;
      row.add(this.add.text(textX, 32 + per.height + 2, about, textStyle(12, locked ? RED_INK : SOFT_INK, { wordWrap: { width: 244 } })).setOrigin(0, 0));
    }
    // Level pips.
    const pipY = rowH - 8 - 16;
    const pips = this.add.graphics();
    // Endless upgrades (hundreds of levels) show just the number.
    const endless = item.maxLevel > 12;
    for (let i = 0; i < (endless ? 0 : item.maxLevel); i++) {
      const filled = i < level;
      pips.fillStyle(filled ? PALETTE.gold : 0x3b2616, filled ? 1 : 0.18).fillCircle(textX + 6 + i * 17, pipY, 6);
      if (filled) pips.lineStyle(2, 0x3b2616, 0.8).strokeCircle(textX + 6 + i * 17, pipY, 6);
    }
    row.add(pips);
    row.add(this.add.text(endless ? textX : textX + item.maxLevel * 17 + 4, pipY, endless ? `${level}` : `${level}/${item.maxLevel}`, textStyle(15, SOFT_INK)).setOrigin(0, 0.5));
    if (level >= item.maxLevel) this.buyButton(row, '', false, BUTTON_COLORS.green, () => undefined, ICON_STAR, rowH);
    else if (locked) this.buyButton(row, `${item.minLevel}`, true, NOT_YET, () => this.requestPurchase(item), uiIcon('lock'), rowH);
    else {
      const price = upgradePrice(item, level);
      this.buyButton(row, formatMoney(price), true, state.economy.money >= price ? BUTTON_COLORS.green : NOT_YET, () => this.requestPurchase(item), undefined, rowH);
    }
    return y + rowH;
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
        this.refreshAll();
        break;
      case 'poor':
      case 'locked':
        sfx.denied(); // the greyed price already says why
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
