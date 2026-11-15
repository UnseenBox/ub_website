import Phaser from 'phaser';
import { BUTTON_COLORS, PALETTE, outlinedStyle, textStyle } from '../config/Theme';
import { state } from '../core/GameState';
import { portal } from '../ads/Portal';
import { TOOL_DEFS } from '../data/tools';
import { ALL_UPGRADES, TOOL_SECTIONS, upgradePrice, type ToolItem, type UpgradeItem } from '../data/store';
import { storeIconKey } from '../art/StoreArt';
import { ICON_STAR } from '../art/IconArt';
import { uiIcon } from '../art/UiIcons';
import { sfx } from '../audio/Sfx';
import { Button } from '../ui/Button';
import { computeLayout } from '../ui/layout';
import { formatMoney } from '../ui/MoneyCounter';
import type { DigScene } from './DigScene';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Entry {
  item: ToolItem;
  section: string;
}

/** Every tool that can really be bought, in shop order (the empty "placeholder" slots are skipped). */
const CATALOGUE: Entry[] = TOOL_SECTIONS.flatMap((s) => s.items.filter((i) => !i.placeholder).map((item) => ({ item, section: s.title })));

const MAX_POWER = 15;
const MAX_SPEED = 1000 / 170;
const NOT_YET = BUTTON_COLORS.disabled;
const WOOD_DARK = 0x4a2a14;
const GOLD = 0xffc83d;
const INK = '#3b2616';
const GREEN_INK = '#2a8a3a';
/** The upgrade panel picture (assets/ui/upgrade-panel.png) measured in its own pixels. */
const UPGRADE_ART = {
  w: 512, h: 680, left: 210, right: 150,
  trackX0: 135.6, trackX1: 463.5, trackH: 37.5, rowH: 84,
  rowY: [152.4, 241.7, 331.1, 421.9, 512.8, 603.8],
  titleY: 61.1, titleH: 57.1, iconX: 80.6, iconR: 37.5,
} as const;
const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
/** Cash from the "watch an ad" chip, scaled to the player's level. */
const adCash = (): number => 50 + 25 * state.progress.level;

/**
 * The store is a place, not a menu: it takes over the play area (the part of the screen between the
 * top bar and the bag) with a little market stall. The tools stand on a counter in the middle - the
 * arrows (or a swipe) walk along the shelf - and the upgrades hang on a board beside (or under) it.
 */
export class StoreScene extends Phaser.Scene {
  private R: Rect = { x: 0, y: 0, w: 100, h: 100 };
  private S: Rect = { x: 0, y: 0, w: 100, h: 100 };
  private P: Rect = { x: 0, y: 0, w: 100, h: 100 };
  private portrait = true;

  private block!: Phaser.GameObjects.Rectangle;
  private showL!: Phaser.GameObjects.Container;
  private panelL!: Phaser.GameObjects.Container;
  private topL!: Phaser.GameObjects.Container;

  private index = 0;
  /** On a phone the tools and the upgrades take turns (a tab bar at the bottom); wide screens show both. */
  private view: 'tools' | 'upgrades' = 'tools';
  private tabY = 0;
  private tabs: { id: 'tools' | 'upgrades'; c: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; dot: Phaser.GameObjects.Graphics }[] = [];
  private busy = false;
  private closing = false;
  private pausedKey: string | null = null;
  private swipeStart: { x: number; y: number } | null = null;

  // Showcase parts that change from tool to tool.
  private holder: Phaser.GameObjects.Container | null = null;
  private toolCx = 0;
  private toolCy = 0;
  private toolSize = 120;
  private statsBox!: Phaser.GameObjects.Container;
  private buyBtn!: Button;
  private dots!: Phaser.GameObjects.Graphics;
  private burstFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiFx!: Phaser.GameObjects.Particles.ParticleEmitter;
  private counterTop = 0;
  private bubble: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Store');
  }

  init(): void {
    this.busy = false;
    this.closing = false;
    this.swipeStart = null;
    this.holder = null;
    this.bubble = null;
    // Start where the shopping is: the next tool worth buying, else the one in hand.
    const power = TOOL_DEFS[state.progress.equippedToolId].power;
    const next = CATALOGUE.findIndex(
      ({ item }) => !state.progress.owns(item.id) && (item.kind === 'scanner' || TOOL_DEFS[item.id].power > power),
    );
    this.view = 'tools';
    this.tabs = [];
    this.index = next >= 0 ? next : Math.max(0, CATALOGUE.findIndex((e) => e.item.id === state.progress.equippedToolId));
  }

  create(): void {
    // Freeze whatever the player was doing underneath.
    this.pausedKey = state.mode === 'dig' ? 'Dig' : 'Workshop';
    if (this.scene.isActive(this.pausedKey)) this.scene.pause(this.pausedKey);
    else this.pausedKey = null;

    (this.scene.get('Dig') as DigScene).setShovelHidden(true);
    this.block = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0, 0).setInteractive();
    this.showL = this.add.container(0, 0);
    this.panelL = this.add.container(0, 0);
    this.topL = this.add.container(0, 0);

    this.measure();
    this.build(true);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      (this.scene.get('Dig') as DigScene).setShovelHidden(false);
      if (this.pausedKey && this.scene.isPaused(this.pausedKey)) this.scene.resume(this.pausedKey);
      this.pausedKey = null;
    });

    // Swipe along the shelf.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = this.inRect(p.x, p.y, this.S) && (!this.portrait || this.view === 'tools') ? { x: p.x, y: p.y } : null;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const s = this.swipeStart;
      this.swipeStart = null;
      if (!s) return;
      const dx = p.x - s.x;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(p.y - s.y) * 1.4) this.step(dx < 0 ? 1 : -1);
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.step(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.step(1));
    this.input.keyboard?.on('keydown-A', () => this.step(-1));
    this.input.keyboard?.on('keydown-D', () => this.step(1));
    this.input.keyboard?.on('keydown-ESC', () => this.requestClose());
  }

  // ---------- geometry ----------

  private measure(): void {
    const { width: w, height: h } = this.scale;
    const L = computeLayout(w, h);
    this.R = { x: 0, y: L.play.y, w, h: L.play.h };
    const R = this.R;
    this.cameras.main.setViewport(R.x, R.y, R.w, R.h);
    this.cameras.main.setScroll(R.x, R.y);
    this.block.setPosition(R.x, R.y).setSize(R.w, R.h);
    (this.block.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setTo(0, 0, R.w, R.h);

    const top = R.y;
    const gap = 10;
    this.portrait = R.w / R.h < 1.1;
    if (this.portrait) {
      // The day plaque of the HUD sits across the top; the tab bar takes the bottom. The tools and
      // the upgrades each get the whole middle, one at a time.
      const plaque = 42;
      const tabH = 62;
      const areaTop = top + plaque;
      const areaH = R.h - plaque - tabH - 12;
      this.S = { x: R.x, y: areaTop, w: R.w, h: areaH };
      this.P = { x: R.x + gap, y: areaTop, w: R.w - gap * 2, h: areaH };
      this.tabY = R.y + R.h - tabH / 2 - 4;
    } else {
      const pw = clamp(R.w * 0.4, 280, 380);
      this.P = { x: R.x + R.w - pw - gap, y: top + gap, w: pw, h: R.y + R.h - top - gap * 2 };
      this.S = { x: R.x, y: top, w: this.P.x - gap - R.x, h: R.y + R.h - top };
    }
  }

  private inRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  private onResize(): void {
    this.measure();
    this.build(false);
  }

  // ---------- building ----------

  private build(intro: boolean): void {
    for (const layer of [this.showL, this.panelL, this.topL]) layer.removeAll(true);
    this.bubble = null;
    this.buildShowcase();
    this.buildUpgrades();
    this.buildClose();
    this.buildTabs();
    this.showL.setVisible(!this.portrait || this.view === 'tools');
    this.panelL.setVisible(!this.portrait || this.view === 'upgrades');
    if (intro) this.playIntro();
  }

  // ---------- phone: tools / upgrades tabs ----------

  /** Two big buttons at the bottom of the shop (phones only): the tool in hand, and the bolt for upgrades. */
  private buildTabs(): void {
    this.tabs = [];
    if (!this.portrait) return;
    const { x, w } = this.R;
    const bw = Math.min(190, (w - 40) / 2);
    const bh = 56;
    (['tools', 'upgrades'] as const).forEach((id, i) => {
      const cx = x + w / 2 + (i === 0 ? -(bw / 2 + 6) : bw / 2 + 6);
      const bg = this.add.graphics();
      const key = id === 'tools' ? TOOL_DEFS[state.progress.equippedToolId].textureKey : uiIcon('bolt');
      const pic = this.add.image(0, 0, key);
      if (id === 'tools') pic.setScale(46 / pic.height).setAngle(38);
      else pic.setDisplaySize(40, 40);
      const dot = this.add.graphics();
      const c = this.add.container(cx, this.tabY, [bg, pic, dot]);
      c.setSize(bw, bh).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tweens.add({ targets: c, scale: 0.94, duration: 70 }));
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.tweens.add({ targets: c, scale: 1, duration: 140 }));
      c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.easeOut' });
        this.setView(id);
      });
      this.topL.add(c);
      this.tabs.push({ id, c, bg, dot });
      this.paintTab(id, bw, bh);
    });
  }

  private paintTab(id: 'tools' | 'upgrades', bw: number, bh: number): void {
    const t = this.tabs.find((o) => o.id === id);
    if (!t) return;
    const on = this.view === id;
    const g = t.bg;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-bw / 2, -bh / 2 + 4, bw, bh, 18);
    g.fillStyle(on ? 0x8a5530 : 0x3a2412, 0.97).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    g.fillStyle(0xffffff, on ? 0.2 : 0.08).fillRoundedRect(-bw / 2 + 6, -bh / 2 + 4, bw - 12, bh * 0.3, 12);
    g.lineStyle(on ? 4 : 3, on ? GOLD : 0x8a6a46, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    // A gold dot on the upgrades tab when something there can be bought right now.
    t.dot.clear();
    if (id === 'upgrades' && this.view !== 'upgrades' && this.upgradeAffordable()) {
      t.dot.fillStyle(0xe5533d).fillCircle(bw / 2 - 14, -bh / 2 + 12, 9);
      t.dot.lineStyle(2, 0xffffff).strokeCircle(bw / 2 - 14, -bh / 2 + 12, 9);
      t.dot.fillStyle(0xffffff).fillRect(bw / 2 - 15.5, -bh / 2 + 7, 3, 6).fillCircle(bw / 2 - 14, -bh / 2 + 16, 1.7);
    }
  }

  private upgradeAffordable(): boolean {
    return ALL_UPGRADES.some((u) => {
      const lv = state.progress.upgradeLevel(u.id);
      return lv < u.maxLevel && upgradePrice(u, lv) <= state.economy.money;
    });
  }

  private repaintTabs(): void {
    const bw = Math.min(190, (this.R.w - 40) / 2);
    this.paintTab('tools', bw, 56);
    this.paintTab('upgrades', bw, 56);
  }

  /** Phone: swaps the tools and the upgrades with a short slide. */
  private setView(next: 'tools' | 'upgrades'): void {
    if (!this.portrait || next === this.view || this.closing) return;
    sfx.click();
    const old = this.view === 'tools' ? this.showL : this.panelL;
    const now = next === 'tools' ? this.showL : this.panelL;
    this.view = next;
    this.tweens.killTweensOf([old, now]);
    this.tweens.add({ targets: old, alpha: 0, duration: 110, onComplete: () => old.setVisible(false) });
    now.setVisible(true).setAlpha(0).setX(next === 'upgrades' ? 40 : -40).setY(0);
    this.tweens.add({ targets: now, alpha: 1, x: 0, duration: 240, ease: 'Cubic.easeOut' });
    this.repaintTabs();
  }

  /** The lit tool in the middle, its stats and buy button under it, and the arrows. No backdrop: the play area shows through. */
  private buildShowcase(): void {
    const S = this.S;
    const f = this.portrait ? Math.max(0.95, clamp(S.w / 520, 0.72, 1.15)) : clamp(S.w / 520, 0.72, 1.15);
    const infoH = this.portrait ? clamp(S.h * 0.3, 118, 160) : clamp(S.h * 0.32, 96, 150);
    this.counterTop = S.y + S.h - infoH;
    const cx = S.x + S.w / 2;
    const L = this.showL;
    this.toolCx = cx;
    // Leave room above the tool for the ad chip when there is one.
    const topPad = portal.hasAds ? 46 * f : 8;
    const zoneH = this.counterTop - S.y - topPad;
    this.toolCy = S.y + topPad + zoneH * 0.46;
    this.toolSize = this.portrait ? Math.min(zoneH * 0.8, S.w * 0.62) : Math.min(zoneH * 0.7, S.w * 0.58);

    // A dark halo so the tool reads against any ground, a soft spotlight and slowly turning rays.
    const halo = this.add.image(cx, this.toolCy, 'soft').setTint(0x000000).setDisplaySize(this.toolSize * 2.1, this.toolSize * 2.1).setAlpha(0.42);
    L.add(halo);
    const glow = this.add.image(cx, this.toolCy, 'soft').setTint(0xffe2a0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(this.toolSize * 2.4, this.toolSize * 2.4).setAlpha(0.5);
    this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.65 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const rays = this.add.container(cx, this.toolCy);
    for (let i = 0; i < 10; i++) {
      rays.add(this.add.image(0, 0, 'ray').setOrigin(0.5, 1).setRotation((i / 10) * Math.PI * 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.13).setScale(this.toolSize / 260, this.toolSize / 260));
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 26000, repeat: -1 });
    L.add([glow, rays]);

    const amb = this.add.particles(cx, this.toolCy, 'star', {
      frequency: 220,
      lifespan: 1600,
      speedY: { min: -26, max: -10 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xfff3c0, 0xffd27a, 0xffffff],
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-this.toolSize * 0.5, -this.toolSize * 0.4, this.toolSize, this.toolSize * 0.9) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    });
    L.add(amb);
    if (portal.hasAds) this.buildAdChip(cx - 75 * f, S.y + 8, f);

    // Arrows.
    const ar = this.portrait ? 32 : clamp(S.w * 0.075, 24, 36);
    L.add(this.makeArrow(S.x + ar + 12, this.toolCy, -1, ar));
    L.add(this.makeArrow(S.x + S.w - ar - 12, this.toolCy, 1, ar));

    // Stats and the buy button under the tool.
    const bh = this.portrait ? 56 : Math.round(46 * Math.max(f, 0.9));
    this.statsBox = this.add.container(cx, this.counterTop + 18 * f);
    this.dots = this.add.graphics();
    this.buyBtn = new Button(this, { width: Math.round(this.portrait ? clamp(S.w * 0.62, 200, 270) : clamp(S.w * 0.46, 170, 230)), height: bh, label: '', fontSize: Math.round((this.portrait ? 28 : 24) * f), colors: BUTTON_COLORS.green, onClick: () => this.pressBuy() });
    this.buyBtn.setPosition(cx, S.y + S.h - bh / 2 - 10);
    L.add([this.statsBox, this.dots, this.buyBtn]);

    this.burstFx = this.add.particles(0, 0, 'star', {
      emitting: false, lifespan: { min: 500, max: 900 }, speed: { min: 140, max: 420 }, scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 }, gravityY: 240, blendMode: Phaser.BlendModes.ADD,
    });
    this.confettiFx = this.add.particles(0, 0, 'confetti', {
      emitting: false, lifespan: 1500, speed: { min: 220, max: 560 }, angle: { min: 230, max: 310 }, gravityY: 700,
      rotate: { start: 0, end: 720 }, scaleX: { start: 1.1, end: 0.2, ease: 'Sine.easeInOut' }, scaleY: 1.1,
      tint: [0xff5a5f, 0xffd23f, 0x5fcf6e, 0x4fb0ff, 0xb565ff, 0xff9ad5],
    });
    L.add([this.burstFx, this.confettiFx]);

    this.holder = null;
    this.showTool(0, false);
  }

  /** "Need cash? Watch an ad" - only where ads exist. */
  private buildAdChip(x: number, y: number, f: number): void {
    const w = 150 * f;
    const h = 40 * f;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x, y + 3, w, h, h / 2);
    g.fillStyle(0x2a1b12, 0.92).fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(2, GOLD, 0.7).strokeRoundedRect(x, y, w, h, h / 2);
    const t = this.add.text(x + 16 * f, y + h / 2, formatMoney(adCash()), outlinedStyle(Math.round(17 * f), PALETTE.money)).setOrigin(0, 0.5);
    const b = new Button(this, { width: 52 * f, height: h - 8, label: '', fontSize: 16, colors: BUTTON_COLORS.blue, icon: uiIcon('play'), onClick: () => this.watchForCash() });
    b.setPosition(x + w - 30 * f, y + h / 2);
    this.showL.add([g, t, b]);
  }

  private watchForCash(): void {
    if (!portal.rewarded(() => {
      state.economy.grant(adCash());
      sfx.coin();
      this.refreshAll(false);
    })) sfx.denied();
  }

  /** A round wooden arrow button that nudges in its direction while idle. */
  private makeArrow(x: number, y: number, dir: -1 | 1, r: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillCircle(0, 4, r);
    g.fillStyle(WOOD_DARK).fillCircle(0, 0, r);
    g.fillStyle(0x8a5530).fillCircle(0, 0, r - 4);
    g.fillStyle(0xffffff, 0.18).fillEllipse(-r * 0.15, -r * 0.4, r * 1.0, r * 0.5);
    g.lineStyle(Math.max(3, r * 0.12), GOLD, 1).strokeCircle(0, 0, r - 2);
    g.fillStyle(0xfff3dc).fillTriangle(dir * r * 0.38, 0, -dir * r * 0.22, -r * 0.46, -dir * r * 0.22, r * 0.46);
    g.lineStyle(3, 0x3b2616, 0.8).strokeTriangle(dir * r * 0.38, 0, -dir * r * 0.22, -r * 0.46, -dir * r * 0.22, r * 0.46);
    const nudge = this.add.container(0, 0, [g]);
    const c = this.add.container(x, y, [nudge]);
    c.setSize(r * 2.6, r * 2.6).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: nudge, x: dir * 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tweens.add({ targets: c, scale: 0.86, duration: 70, ease: 'Quad.easeOut' }));
    const up = (): void => { this.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.easeOut' }); };
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, up);
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => { up(); this.step(dir); });
    return c;
  }

  // ---------- the tool on the counter ----------

  private entry(): Entry {
    return CATALOGUE[this.index];
  }

  /** Texture and size for a tool: the real shovel pictures, otherwise the store tile. */
  private toolArt(item: ToolItem): { key: string; w: number; h: number; tilt: number } {
    const def = TOOL_DEFS[item.id];
    const isShovel = /-shovel$/.test(item.id) && !!def;
    const key = isShovel ? def.textureKey : storeIconKey(item.id);
    const tex = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const size = this.toolSize;
    if (isShovel) {
      const k = size / tex.height;
      return { key, w: tex.width * k, h: size, tilt: 10 };
    }
    const sq = size * 0.82;
    return { key, w: sq, h: sq, tilt: 0 };
  }

  private makeSprite(entry: Entry): Phaser.GameObjects.Container {
    const { item } = entry;
    const art = this.toolArt(item);
    // A warm rim (the same picture, filled gold and a touch larger) so even a dark silhouette stands out.
    const rim = this.add.image(0, 0, art.key).setDisplaySize(art.w * 1.08, art.h * 1.05).setAngle(art.tilt).setTintFill(0xffd27a).setAlpha(0.85);
    const img = this.add.image(0, 0, art.key).setDisplaySize(art.w, art.h).setAngle(art.tilt);
    const bob = this.add.container(0, 0, [rim, img]);
    const locked = !state.progress.owns(item.id) && state.progress.level < item.minLevel;
    if (locked) {
      // Still the real picture, so the player sees what is coming - just dimmed, with a lock on it.
      img.setTint(0x8c8c96);
      rim.setTintFill(0x8a7a5a).setAlpha(0.6);
      const ls = this.toolSize * 0.2;
      const lx = this.toolSize * 0.2;
      const ly = this.toolSize * 0.3;
      const badge = this.add.graphics();
      badge.fillStyle(0x000000, 0.5).fillCircle(lx, ly + 3, ls * 0.78);
      badge.fillStyle(0x2a1b12, 0.92).fillCircle(lx, ly, ls * 0.78);
      badge.lineStyle(3, GOLD, 0.9).strokeCircle(lx, ly, ls * 0.78);
      const lock = this.add.image(lx, ly - ls * 0.08, uiIcon('lock')).setDisplaySize(ls, ls);
      const lv = this.add.text(lx + ls * 0.95, ly + ls * 0.55, `${item.minLevel}`, outlinedStyle(Math.round(this.toolSize * 0.12), PALETTE.goldText)).setOrigin(0, 0.5);
      bob.add([badge, lock, lv]);
    }
    this.tweens.add({ targets: bob, y: { from: -this.toolSize * 0.035, to: this.toolSize * 0.035 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: bob, angle: { from: -2.5, to: 2.5 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return this.add.container(0, 0, [bob]);
  }

  /** Brings the tool at `this.index` onto the counter, sliding in from the side the arrow points. */
  private showTool(dir: number, animate: boolean): void {
    const entry = this.entry();
    const next = this.makeSprite(entry);
    const dist = this.S.w * 0.42;
    const old = this.holder;
    this.holder = next;
    // In front of the halo, glow, rays and sparkles (the first four children) but behind the text and arrows.
    this.showL.addAt(next, Math.min(4, this.showL.length));
    if (!animate) {
      next.setPosition(this.toolCx, this.toolCy);
      this.refreshInfo(false);
      return;
    }
    if (old) {
      this.tweens.add({ targets: old, x: this.toolCx - dir * dist, alpha: 0, scale: 0.6, duration: 190, ease: 'Quad.easeIn', onComplete: () => old.destroy() });
    }
    next.setPosition(this.toolCx + dir * dist, this.toolCy).setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: next, x: this.toolCx, alpha: 1, scale: 1, duration: 340, delay: 120, ease: 'Back.easeOut', onComplete: () => { this.busy = false; } });
    this.refreshInfo(true);
  }

  private step(dir: number): void {
    if (this.busy || this.closing || CATALOGUE.length < 2 || (this.portrait && this.view !== 'tools')) return;
    this.busy = true;
    sfx.click();
    this.index = (this.index + dir + CATALOGUE.length) % CATALOGUE.length;
    this.showTool(dir, true);
  }

  /** Name, stats, dots and the buy button for the tool on show. */
  private refreshInfo(pop: boolean): void {
    const { item } = this.entry();
    const S = this.S;
    const f = clamp(S.w / 520, 0.72, 1.15);
    const cx = S.x + S.w / 2;
    // Stats: bars for power and speed, or the scanner bonus.
    this.statsBox.removeAll(true);
    const def = TOOL_DEFS[item.id];
    const bw = clamp(S.w * 0.22, 70, 120);
    const row = 22 * f;
    if (item.kind === 'dig' && def) {
      this.statBar(-bw - 24 * f, uiIcon('pickaxe'), def.power / MAX_POWER, bw, row, pop);
      this.statBar(24 * f, uiIcon('stopwatch'), 1000 / def.swingCooldownMs / MAX_SPEED, bw, row, pop);
    } else {
      const bonus = item.id === 'tool-deep-scanner' ? '+50%' : '+25%';
      const icon = this.add.image(-30 * f, 0, uiIcon('magnifier')).setDisplaySize(row, row);
      const txt = this.add.text(-14 * f, 0, bonus, textStyle(Math.round(18 * f), GREEN_INK)).setOrigin(0, 0.5);
      this.statsBox.add([icon, txt]);
      if (item.id === 'tool-deep-scanner') this.statsBox.add(this.add.image(50 * f, 0, ICON_STAR).setDisplaySize(row, row));
    }

    // Page dots.
    const dg = this.dots;
    dg.clear();
    const n = CATALOGUE.length;
    const step = 13;
    for (let i = 0; i < n; i++) {
      const x = cx - ((n - 1) * step) / 2 + i * step;
      const on = i === this.index;
      dg.fillStyle(on ? GOLD : 0x2a1608, on ? 1 : 0.45).fillCircle(x, this.counterTop - 12, on ? 5 : 3.4);
      if (on) dg.lineStyle(2, 0x3b2616, 0.8).strokeCircle(x, this.counterTop - 12, 5);
    }

    this.paintBuyButton(pop);
  }

  private statBar(x: number, icon: string, frac: number, w: number, h: number, animate: boolean): void {
    const ic = this.add.image(x + h / 2, 0, icon).setDisplaySize(h, h);
    const track = this.add.graphics();
    const bx = x + h + 6;
    track.fillStyle(0x000000, 0.4).fillRoundedRect(bx, -h * 0.28, w, h * 0.56, h * 0.28);
    const fill = this.add.graphics();
    const draw = (p: number): void => {
      fill.clear();
      const fw = Math.max(h * 0.4, (w - 4) * p);
      fill.fillStyle(0x7ee05a).fillRoundedRect(bx + 2, -h * 0.28 + 2, fw, h * 0.56 - 4, (h * 0.56 - 4) / 2);
      fill.fillStyle(0xffffff, 0.3).fillRoundedRect(bx + 4, -h * 0.28 + 3, Math.max(0, fw - 4), (h * 0.56 - 4) * 0.35, 2);
    };
    const target = clamp(frac, 0.05, 1);
    if (animate) {
      draw(0);
      const c = { p: 0 };
      this.tweens.add({ targets: c, p: target, duration: 420, delay: 160, ease: 'Cubic.easeOut', onUpdate: () => draw(c.p) });
    } else draw(target);
    this.statsBox.add([ic, track, fill]);
  }

  private paintBuyButton(pop: boolean): void {
    const { item } = this.entry();
    const b = this.buyBtn;
    b.setPulse(false);
    const owned = state.progress.owns(item.id);
    const equipped = owned && item.kind === 'dig' && state.progress.equippedToolId === item.id;
    const locked = !owned && state.progress.level < item.minLevel;
    const weaker = !owned && item.kind === 'dig' && TOOL_DEFS[item.id].power <= TOOL_DEFS[state.progress.equippedToolId].power;
    if (owned) {
      b.setIcon(uiIcon('check')).setLabel('').setColors(equipped || item.kind === 'scanner' ? BUTTON_COLORS.green : NOT_YET).setEnabled(true);
    } else if (locked) {
      b.setIcon(uiIcon('lock')).setLabel(`${item.minLevel}`).setColors(NOT_YET).setEnabled(true);
    } else if (weaker) {
      b.setIcon(uiIcon('cross')).setLabel('').setColors(NOT_YET).setEnabled(true);
    } else {
      const afford = state.economy.money >= item.price;
      b.setIcon(null).setLabel(formatMoney(item.price)).setColors(afford ? BUTTON_COLORS.green : NOT_YET).setEnabled(true);
      if (afford) b.setPulse(true);
    }
    if (pop) this.tweens.add({ targets: b, scale: { from: 0.8, to: 1 }, duration: 300, delay: 140, ease: 'Back.easeOut' });
  }

  private pressBuy(): void {
    if (this.busy || this.closing) return;
    const { item } = this.entry();
    if (state.progress.owns(item.id)) {
      this.tweens.add({ targets: this.holder, scale: { from: 1.1, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      return;
    }
    const result = state.buyTool(item);
    if (result === 'ok') {
      sfx.sell();
      this.celebrate();
      this.refreshAll(false);
    } else {
      sfx.denied();
      this.tweens.add({ targets: this.buyBtn, x: { from: this.buyBtn.x - 8, to: this.buyBtn.x }, duration: 260, ease: 'Elastic.easeOut' });
      if (result === 'locked') this.tweens.add({ targets: this.holder, angle: { from: -6, to: 0 }, duration: 320, ease: 'Elastic.easeOut' });
    }
  }

  /** A purchase: the tool spins up, a flash ring, stars and confetti. */
  private celebrate(): void {
    const h = this.holder;
    if (h) {
      this.tweens.add({ targets: h, angle: 360, scale: { from: 1.3, to: 1 }, duration: 620, ease: 'Cubic.easeOut', onComplete: () => h.setAngle(0) });
    }
    const ring = this.add.image(this.toolCx, this.toolCy, 'ring').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe28a).setScale(0.3).setAlpha(0.9);
    this.showL.add(ring);
    this.tweens.add({ targets: ring, scale: this.toolSize / 40, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.burstFx.explode(26, this.toolCx, this.toolCy);
    this.confettiFx.explode(46, this.toolCx, this.toolCy);
    this.time.delayedCall(180, () => this.confettiFx.explode(26, this.toolCx, this.toolCy - 20));
  }

  // ---------- upgrades board ----------

  /**
   * The wooden upgrade panel picture (its six rows already carry the icons): a title, and in each row
   * a bar that fills as the upgrade levels up, with the price at the right end. The picture is
   * stretched sideways in the middle (a three-part slice), so it fits a tall panel or a wide one.
   */
  private buildUpgrades(popId?: string): void {
    const P = this.P;
    const L = this.panelL;
    const T = UPGRADE_ART;
    let s = P.h / T.h;
    let wTex = P.w / s;
    if (wTex < T.w) {
      s = P.w / T.w;
      wTex = T.w;
    }
    const extra = wTex - T.w;
    const px = P.x + (P.w - wTex * s) / 2;
    const py = P.y + (P.h - T.h * s) / 2;
    const panel = this.add.nineslice(px, py, 'upgrade-panel', undefined, wTex, T.h, T.left, T.right, 0, 0).setOrigin(0, 0).setScale(s);
    L.add(panel);

    // Title in the empty plaque at the top.
    const title = this.add.text(px + ((T.w + extra) / 2) * s, py + T.titleY * s, 'Upgrades', outlinedStyle(Math.max(14, Math.round(T.titleH * s * 0.66)), '#ffe9b0')).setOrigin(0.5);
    L.add(title);

    ALL_UPGRADES.forEach((item, i) => {
      const level = state.progress.upgradeLevel(item.id);
      const maxed = level >= item.maxLevel;
      const price = upgradePrice(item, level);
      const afford = state.economy.money >= price;
      const ry = py + T.rowY[i] * s;
      const tx0 = px + T.trackX0 * s;
      const tx1 = px + (T.trackX1 + extra) * s;
      const th = T.trackH * s;
      const pad = Math.max(2, th * 0.14);
      const color = item.icon.kind === 'glyph' ? item.icon.color : GOLD;

      // Price (or a star when there is nothing more to buy) at the right end of the bar.
      const priceW = clamp((tx1 - tx0) * 0.3, 40, 100);
      if (maxed) {
        L.add(this.add.image(tx1 - pad - th * 0.5, ry, ICON_STAR).setDisplaySize(th * 0.8, th * 0.8));
      } else {
        L.add(this.add.text(tx1 - pad - 4, ry, formatMoney(price), outlinedStyle(Math.max(11, Math.round(th * 0.7)), afford ? PALETTE.money : '#a89b8a', { strokeThickness: 3 })).setOrigin(1, 0.5));
      }

      // The bar: one segment per level (or a looping bar for the endless upgrade).
      const fx0 = tx0 + pad;
      const fillW = tx1 - tx0 - priceW - pad * 2;
      const segH = th - pad * 2;
      const g = this.add.graphics();
      L.add(g);
      const endless = item.maxLevel > 12;
      if (endless) {
        const frac = (level % 10) / 10;
        g.fillStyle(0xffffff, 0.1).fillRoundedRect(fx0, ry - segH / 2, fillW, segH, segH / 2);
        if (frac > 0) {
          g.fillStyle(color).fillRoundedRect(fx0, ry - segH / 2, Math.max(segH, fillW * frac), segH, segH / 2);
          g.fillStyle(0xffffff, 0.3).fillRoundedRect(fx0 + 2, ry - segH / 2 + 2, Math.max(0, fillW * frac - 4), segH * 0.3, segH * 0.15);
        }
        L.add(this.add.text(fx0 + fillW / 2, ry, `${level}`, outlinedStyle(Math.max(11, Math.round(th * 0.62)), '#ffffff', { strokeThickness: 3 })).setOrigin(0.5));
      } else {
        const n = item.maxLevel;
        const gap = Math.max(2, segH * 0.18);
        const sw = (fillW - gap * (n - 1)) / n;
        for (let k = 0; k < n; k++) {
          const sx = fx0 + k * (sw + gap);
          if (k >= level) {
            g.fillStyle(0xffffff, 0.1).fillRoundedRect(sx, ry - segH / 2, sw, segH, Math.min(segH / 2, sw / 2));
            continue;
          }
          const draw = (gg: Phaser.GameObjects.Graphics, ox: number, oy: number): void => {
            gg.fillStyle(color).fillRoundedRect(ox, oy, sw, segH, Math.min(segH / 2, sw / 2));
            gg.fillStyle(0xffffff, 0.35).fillRoundedRect(ox + 1, oy + 1, Math.max(0, sw - 2), segH * 0.34, Math.min(segH * 0.17, sw / 2));
          };
          if (popId === item.id && k === level - 1) {
            const seg = this.add.graphics();
            draw(seg, -sw / 2, -segH / 2);
            const c = this.add.container(sx + sw / 2, ry, [seg]);
            L.add(c);
            c.setScale(0, 1.6);
            this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
            this.burstFx.explode(12, sx + sw / 2, ry);
          } else draw(g, sx, ry - segH / 2);
        }
      }

      // Tap the round icon for its name and what a level gives; tap the bar or the price to buy.
      const ir = T.iconR * s;
      const iconZone = this.add.zone(px + T.iconX * s, ry, ir * 2.2, ir * 2.2).setInteractive({ useHandCursor: true });
      iconZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.showBubble(item, px + T.iconX * s, ry - ir));
      const buyZone = this.add.zone((tx0 + tx1) / 2, ry, tx1 - tx0, Math.max(th, T.rowH * s * 0.8)).setInteractive({ useHandCursor: true });
      buyZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (maxed) {
          sfx.denied();
          return;
        }
        if (!afford) {
          sfx.denied();
          this.tweens.add({ targets: g, x: { from: -5, to: 0 }, duration: 240, ease: 'Elastic.easeOut' });
          return;
        }
        this.buyUpgrade(item);
      });
      // Press feedback on the row, so a tap never feels dead.
      const hl = this.add.graphics().setVisible(false);
      hl.fillStyle(0xffffff, 0.22).fillRoundedRect(tx0 - pad, ry - th * 0.7, tx1 - tx0 + pad * 2, th * 1.4, th * 0.5);
      buyZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => hl.setVisible(true));
      buyZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => hl.setVisible(false));
      buyZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => hl.setVisible(false));
      L.add([hl, iconZone, buyZone]);
    });
  }

  private buyUpgrade(item: UpgradeItem): void {
    if (this.closing) return;
    const result = state.buyUpgrade(item);
    if (result === 'ok') {
      sfx.sell();
      this.refreshAll(true, item.id);
    } else {
      sfx.denied();
    }
  }

  /** A tiny speech bubble over a tapped upgrade: its name and what one level gives. */
  private showBubble(item: UpgradeItem, cx: number, y: number): void {
    this.bubble?.destroy();
    sfx.click();
    const t = this.add.text(0, 0, `${item.name}\n${item.perLevel}`, textStyle(14, '#ffffff', { align: 'center', stroke: INK, strokeThickness: 3 })).setOrigin(0.5);
    const w = t.width + 26;
    const h = t.height + 16;
    const g = this.add.graphics();
    g.fillStyle(0x2a1b12, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.lineStyle(2, GOLD, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(0x2a1b12, 0.95).fillTriangle(-7, h / 2 - 1, 7, h / 2 - 1, 0, h / 2 + 8);
    const px = clamp(cx, this.R.x + w / 2 + 6, this.R.x + this.R.w - w / 2 - 6);
    const c = this.add.container(px, y - h / 2 - 8, [g, t]).setAlpha(0).setScale(0.8);
    this.topL.add(c);
    this.bubble = c;
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.time.delayedCall(2000, () => {
      if (this.bubble !== c) return;
      this.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => { c.destroy(); if (this.bubble === c) this.bubble = null; } });
    });
  }

  /** Money changed or something was bought: repaint the shelf and the board. */
  private refreshAll(popUpgrade: boolean, upgradeId?: string): void {
    this.refreshInfo(false);
    this.panelL.removeAll(true);
    this.buildUpgrades(popUpgrade ? upgradeId : undefined);
    if (this.portrait) this.repaintTabs();
  }

  // ---------- close, intro ----------

  private buildClose(): void {
    const { x, y } = this.R;
    const r = 20;
    const c = this.add.container(x + r + 10, y + r + 10);
    c.add(this.add.image(0, 0, uiIcon('cross')).setDisplaySize(r * 2, r * 2));
    c.setSize(r * 2.6, r * 2.6).setInteractive({ useHandCursor: true });
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tweens.add({ targets: c, scale: 0.88, duration: 70 }));
    c.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.requestClose());
    this.topL.add(c);
  }

  private playIntro(): void {
    this.showL.setAlpha(0).setY(90);
    this.tweens.add({ targets: this.showL, alpha: 1, y: 0, duration: 420, delay: 110, ease: 'Cubic.easeOut' });
    if (!this.portrait) {
      this.panelL.x = this.P.w + 40;
      this.panelL.setAlpha(0);
      this.tweens.add({ targets: this.panelL, alpha: 1, x: 0, y: 0, duration: 460, delay: 200, ease: 'Back.easeOut' });
    }
    this.topL.setAlpha(0);
    this.tweens.add({ targets: this.topL, alpha: 1, duration: 260, delay: 300 });
    if (this.holder) {
      this.holder.setScale(0);
      this.tweens.add({ targets: this.holder, scale: 1, duration: 420, delay: 360, ease: 'Back.easeOut' });
    }
    sfx.click();
  }

  /** Public so the HUD's store icon can close the stall. */
  requestClose(): void {
    if (this.closing) return;
    this.closing = true;
    sfx.click();
    this.tweens.add({ targets: this.showL, alpha: 0, y: 60, duration: 170, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.panelL, alpha: 0, x: this.portrait ? 0 : this.P.w + 40, y: this.portrait ? this.P.h + 30 : 0, duration: 190, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.topL, alpha: 0, duration: 120 });
    this.time.delayedCall(210, () => this.scene.stop());
  }
}
