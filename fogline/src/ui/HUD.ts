import Phaser from 'phaser';
import { DEFENSES, MODS, SUPPORT } from '../data/upgrades';
import { weaponById } from '../data/weapons';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { BLEED, MAX_SCREEN, SCREEN } from '../game/screen';
import { Abilities } from '../systems/Abilities';
import { BunkerManager } from '../systems/BunkerManager';
import { EconomyManager } from '../systems/EconomyManager';
import { SupportSystem } from '../systems/SupportSystem';
import { WaveManager } from '../systems/WaveManager';
import { WeaponManager } from '../systems/WeaponManager';
import { HUD_AREA, layoutSlots, type HudSlots, type SlotRect } from './hudLayout';
import { ITEM_ICON, WEAPON_ICON, icon, iconWidth, type IconName } from './icons';
import {
  C, STENCIL, actionCard, centreRow, chip, css, flowRow, keycap, meter, radioChip, row, text, type Part, type Tone,
} from './kit';
import { appendLog, clipWords, tagStyle, wordCount, type StripChip } from './messages';
import { enemyPortrait } from './portraits';
import type { EnemyDef } from '../data/enemies';

interface Slot {
  r: SlotRect;
  frame: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  top: Phaser.GameObjects.Text;
  bottom: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Rectangle;
  state: string;
}

export interface HudActions {
  weapon(slot: number): void;
  mod(index: number): void;
  support(index: number): void;
  defense(index: number): void;
  /** Tap/click on the Focus bar (touch players have no SHIFT key). */
  focus?(): void;
  /** Tap/click on the flare count (touch players have no Q key). */
  flare?(): void;
  /** The two cards between waves. */
  armory?(): void;
  nextWave?(): void;
}

/** One part of a control hint: a key to press, or an icon with a word. */
export interface HintPart {
  key?: string;
  icon?: IconName;
  label?: string;
}

/** The line under a big banner title. */
export interface BannerNote {
  icon?: IconName;
  text: string;
  tone?: Tone;
}

function setText(t: Phaser.GameObjects.Text, s: string): void {
  if (t.text !== s) t.setText(s);
}

const HEALTH_WARN = 0xe0b040;
/** The widest the cash may be beside the health bar. */
const CASH_W = 138;

/** The battle screen: a flat bar of what the mission offers, health and cash, and short messages over the field. */
export class HUD {
  /** Where each offered slot sits. */
  readonly slots: HudSlots;
  private weaponSlots: Slot[] = [];
  private modSlots: Slot[] = [];
  private supportSlots: Slot[] = [];
  private defenseSlots: Slot[] = [];
  private readonly offeredMods: number[];
  private readonly offeredSupport: number[];
  private readonly offeredDefense: number[];
  private hpBar: Phaser.GameObjects.Graphics;
  private cashText: Phaser.GameObjects.Text;
  private ammoPlate: Phaser.GameObjects.Rectangle;
  private ammoBig: Phaser.GameObjects.Text;
  private ammoSmall: Phaser.GameObjects.Text;
  private bannerBox: Phaser.GameObjects.Container | null = null;
  private bannerLeft = 0;
  private bannerSticky = false;
  private critical: Phaser.GameObjects.Text;
  private critVignette: Phaser.GameObjects.Rectangle;
  private effects: Phaser.GameObjects.Container | null = null;
  private effectsKey = '';
  private focusBar: Phaser.GameObjects.Graphics;
  private focusIcon: Phaser.GameObjects.Image;
  private focusKey: Part;
  private focusZone: Phaser.GameObjects.Zone;
  private streakRow: Part[] = [];
  private streakKey = '';
  private flareZone: Phaser.GameObjects.Zone | null = null;
  private stripRow: Part[] = [];
  private stripKey = '';
  private stripWidth = 0;
  private bossName: Phaser.GameObjects.Text;
  private bossBar: Phaser.GameObjects.Graphics;
  private hintBox: Phaser.GameObjects.Container | null = null;
  private pendingHint: HintPart[] | null = null;
  private hintLeft = 0;
  private threatBox: Phaser.GameObjects.Container | null = null;
  private threatLeft = 0;
  private card: Phaser.GameObjects.Container | null = null;
  /** Every radio line of this battle in full, for the radio log in the pause menu. */
  readonly radioLog: { who: string; text: string }[] = [];
  private radioBox: Phaser.GameObjects.Container | null = null;
  private radioQueue: { who: string; text: string }[] = [];
  private radioLeft = 0;
  private cashFlash = 0;
  private lastCash = -1;
  private hpLag = 1;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly d: {
      weapons: WeaponManager; abilities: Abilities; economy: EconomyManager; bunker: BunkerManager; waves: WaveManager; support: SupportSystem;
      /** Whether this mission offers an item (`weapon:m4`, `mod:ap`…). Items it doesn't stay off the HUD. */
      offers: (id: string) => boolean;
      /** Weapon ids on keys 1–4, in order. */
      weaponSlots: string[];
      /** Whether the on-screen touch controls are up (their buttons take the top left corner). */
      touch: () => boolean;
    },
    private readonly actions: HudActions,
  ) {
    const guns = d.weaponSlots.slice(0, 4).filter((id) => d.offers(`weapon:${id}`));
    const offered = (list: readonly { id: string }[], kind: string): number[] =>
      list.map((_, i) => i).filter((i) => d.offers(`${kind}:${list[i].id}`));
    this.offeredMods = offered(MODS, 'mod');
    this.offeredSupport = offered(SUPPORT, 'support');
    this.offeredDefense = offered(DEFENSES, 'defense');
    this.slots = layoutSlots({
      weapons: guns.length, mods: this.offeredMods.length, support: this.offeredSupport.length, defense: this.offeredDefense.length,
    });

    const top = HUD_AREA.top;
    // The bar runs the full width of the screen (and to its bottom); what it holds stays in the design area.
    scene.add.rectangle(-BLEED.x, top, MAX_SCREEN.width, HUD_AREA.height + BLEED.y, C.hud).setOrigin(0).setDepth(DEPTH.hud);
    scene.add.rectangle(-BLEED.x, top, MAX_SCREEN.width, 2, C.hudLine).setOrigin(0).setDepth(DEPTH.hud);

    this.slots.weapons.forEach((r, i) => {
      const slot = d.weaponSlots.indexOf(guns[i]) + 1;
      this.weaponSlots.push(this.makeSlot(r, WEAPON_ICON[guns[i]], C.iconTone, String(slot), () => actions.weapon(slot)));
    });
    this.slots.mods.forEach((r, k) => {
      const i = this.offeredMods[k], m = MODS[i];
      this.modSlots.push(this.makeSlot(r, ITEM_ICON[m.id], m.color, m.key, () => actions.mod(i)));
    });
    this.slots.support.forEach((r, k) => {
      const i = this.offeredSupport[k], s = SUPPORT[i];
      this.supportSlots.push(this.makeSlot(r, ITEM_ICON[s.id], C.iconTone, s.key, () => actions.support(i)));
    });
    this.slots.defense.forEach((r, k) => {
      const i = this.offeredDefense[k], s = DEFENSES[i];
      this.defenseSlots.push(this.makeSlot(r, ITEM_ICON[s.id], C.iconTone, s.key, () => actions.defense(i)));
    });

    // health and cash
    const mid = top + HUD_AREA.height / 2;
    icon(scene, 'shield', HUD_AREA.status.x + 18, mid, 34, C.health).setDepth(DEPTH.hud + 1);
    this.hpBar = scene.add.graphics().setDepth(DEPTH.hud + 1);
    this.cashText = text(scene, VIEW.width - 20, mid, '', { size: 38, color: C.cash, font: STENCIL }).setOrigin(1, 0.5).setDepth(DEPTH.hud + 1);

    // rounds in the gun, above the bar by the right hand
    this.ammoPlate = scene.add.rectangle(1188, top - 8, 150, 56, C.chip, 0.82).setOrigin(0.5, 1).setStrokeStyle(1, 0xffffff, 0.14).setDepth(DEPTH.hud);
    this.ammoBig = text(scene, 1198, top - 36, '', { size: 42, font: STENCIL }).setOrigin(1, 0.5).setDepth(DEPTH.hud + 1);
    this.ammoSmall = text(scene, 1206, top - 30, '', { size: 18, color: C.muted, bold: true }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);

    // Focus meter and kill streak, bottom left above the bar.
    this.focusBar = scene.add.graphics().setDepth(DEPTH.hud + 1);
    this.focusIcon = icon(scene, 'eye', 36, top - 26, 24, 0xc8e0ff).setDepth(DEPTH.hud + 1).setVisible(false);
    this.focusKey = keycap(scene, 'SHIFT', 30);
    this.focusKey.c.setPosition(262, top - 42).setDepth(DEPTH.hud + 1).setVisible(false);
    this.focusZone = scene.add.zone(18, top - 46, 250, 40).setOrigin(0).setDepth(DEPTH.hud + 5).setInteractive({ useHandCursor: true });
    this.focusZone.on('pointerdown', () => actions.focus?.());

    this.bossName = text(scene, VIEW.centerX, 90, '', { size: 24, color: C.red, font: STENCIL, shadow: 3 })
      .setOrigin(0.5, 0).setDepth(DEPTH.banner + 1).setVisible(false);
    this.bossBar = scene.add.graphics().setDepth(DEPTH.banner + 1);

    this.critical = text(scene, VIEW.centerX, 118, 'BUNKER CRITICAL', { size: 30, color: C.red, font: STENCIL, shadow: 4 })
      .setOrigin(0.5).setDepth(DEPTH.banner).setVisible(false);
    this.critVignette = scene.add.rectangle(0, 0, VIEW.width, VIEW.hudTop, 0xff0000, 0).setOrigin(0).setDepth(DEPTH.overlay).setStrokeStyle(40, 0xaa0000, 0.0);
  }

  private makeSlot(r: SlotRect, name: IconName, color: number, key: string, onClick: () => void): Slot {
    const s = this.scene;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    // Weapon silhouettes are twice as wide as they are tall.
    const size = iconWidth(name, 1) > 1 ? Math.min(32, Math.floor((r.w - 8) / 2)) : Math.min(36, r.w - 18);
    s.add.rectangle(r.x, r.y, r.w, r.h, 0x26271f).setOrigin(0).setStrokeStyle(1, 0x44443a).setDepth(DEPTH.hud + 1);
    const img = icon(s, name, cx, cy, size, color).setDepth(DEPTH.hud + 2);
    const lock = icon(s, 'lock', cx, cy, 30, C.text).setDepth(DEPTH.hud + 3).setVisible(false);
    text(s, r.x + 5, r.y + 1, key, { size: 13, color: C.muted, bold: true }).setDepth(DEPTH.hud + 3);
    const top = text(s, r.x + r.w - 5, r.y + 1, '', { size: 13, color: C.text, bold: true }).setOrigin(1, 0).setDepth(DEPTH.hud + 3);
    const bottom = text(s, cx, r.y + r.h - 3, '', { size: 13, color: C.soft, bold: true }).setOrigin(0.5, 1).setDepth(DEPTH.hud + 3);
    const bar = s.add.rectangle(r.x + 2, r.y + r.h - 3, r.w - 4, 4, 0xe0b040).setOrigin(0, 0.5).setDepth(DEPTH.hud + 4).setVisible(false);
    const frame = s.add.graphics().setDepth(DEPTH.hud + 4);
    // The tap target is the full height of the bar, which matters under a thumb.
    const hit = s.add.zone(r.x - 3, HUD_AREA.top, r.w + 6, HUD_AREA.height).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(DEPTH.hud + 5);
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown()) onClick();
    });
    return { r, frame, icon: img, lock, top, bottom, bar, state: '' };
  }

  private drawFrame(slot: Slot, color: number, alpha = 1): void {
    const st = `${color}:${alpha}`;
    if (slot.state === st) return;
    slot.state = st;
    const g = slot.frame;
    g.clear();
    if (!color) return;
    g.lineStyle(3, color, alpha);
    g.strokeRect(slot.r.x, slot.r.y, slot.r.w, slot.r.h);
  }

  // ------------------------------------------------------------ messages over the field

  /** A big title in the middle of the field, with at most one short chip under it. */
  banner(title: string, note: BannerNote | null, seconds: number, sticky = false): void {
    this.dropBanner();
    const s = this.scene;
    const t = text(s, 0, 0, title, { size: 56, font: STENCIL, shadow: 4, align: 'center' }).setOrigin(0.5);
    if (t.width > VIEW.width - 120) t.setScale((VIEW.width - 120) / t.width);
    const parts: Phaser.GameObjects.GameObject[] = [t];
    if (note) {
      const p = chip(s, { icon: note.icon, text: note.text, tone: note.tone, size: 22 });
      p.c.setPosition(-p.w / 2, 42);
      parts.push(p.c);
    }
    this.bannerBox = s.add.container(VIEW.centerX, 190, parts).setDepth(DEPTH.banner + 1);
    this.bannerLeft = seconds;
    this.bannerSticky = sticky;
  }

  private dropBanner(): void {
    this.bannerBox?.destroy();
    this.bannerBox = null;
  }

  /** Focus meter: `meter` fills 0–1; `active` is the time left in a running Focus (0–1). */
  setFocus(enabled: boolean, amount: number, active: number): void {
    const g = this.focusBar;
    g.clear();
    this.focusIcon.setVisible(enabled);
    const full = amount >= 1 && active <= 0;
    this.focusKey.c.setVisible(enabled && full && !this.d.touch());
    this.focusZone.input!.enabled = enabled;
    if (!enabled) return;
    const y = VIEW.hudTop - 26;
    g.fillStyle(C.chip, 0.82).fillRect(18, y - 18, 236, 36);
    const pulse = full ? 0.6 + 0.4 * Math.sin(this.time * 8) : 1;
    meter(g, 58, y - 6, 182, 12, active > 0 ? active : amount, active > 0 ? 0x80a8ff : full ? 0xc8e0ff : 0x5a78b8);
    this.focusIcon.setAlpha(pulse);
  }

  /** Kill streak (0 hides it), its cash multiplier, and flares left at night (-1 hides). */
  setStreak(streak: number, mul: number, flares: number): void {
    const key = `${streak >= 5 ? streak : 0}:${mul}:${flares}`;
    if (key === this.streakKey) return;
    this.streakKey = key;
    for (const p of this.streakRow) p.c.destroy();
    this.streakRow = [];
    if (streak >= 5) {
      this.streakRow.push(chip(this.scene, { icon: 'flame', text: `${streak}`, tone: 'gold', size: 20 }));
      if (mul > 1) this.streakRow.push(chip(this.scene, { icon: 'cash', text: `×${mul}`, tone: 'green', size: 20 }));
    }
    const flare = flares >= 0 ? chip(this.scene, { icon: 'flare', text: this.d.touch() ? `${flares}` : `${flares}  Q`, size: 20 }) : null;
    if (flare) this.streakRow.push(flare);
    for (const p of this.streakRow) p.c.setDepth(DEPTH.hud + 1);
    row(this.streakRow, 18, VIEW.hudTop - 74);
    this.flareZone?.destroy();
    this.flareZone = null;
    if (!flare) return;
    // A finger needs more than the chip itself.
    this.flareZone = this.scene.add.zone(flare.c.x - 10, flare.c.y - 14, flare.w + 28, flare.h + 28)
      .setOrigin(0).setDepth(DEPTH.hud + 5).setInteractive({ useHandCursor: true });
    this.flareZone.on('pointerdown', () => this.actions.flare?.());
  }

  /** The objective strip at the top: what to do, the bonus star's goal and the wave pips. */
  setStrip(chips: StripChip[]): void {
    const w = this.d.waves;
    const total = w.endless ? 0 : w.totalWaves;
    const key = JSON.stringify([chips, w.wave, total]);
    if (key === this.stripKey) return;
    this.stripKey = key;
    for (const p of this.stripRow) p.c.destroy();
    this.stripRow = chips.map((c) => chip(this.scene, { icon: c.icon, text: c.text, tone: c.tone, size: 22 }));
    if (total > 0) this.stripRow.push(chip(this.scene, { pips: { n: total, on: w.wave }, size: 22 }));
    else if (w.wave > 0) this.stripRow.push(chip(this.scene, { icon: 'wave', text: `${w.wave}`, size: 22 }));
    // Every chip the same height, so the strip reads as one row.
    for (const p of this.stripRow) p.c.setDepth(DEPTH.banner + 1);
    this.stripWidth = centreRow(this.stripRow, VIEW.centerX, 52);
  }

  /** The boss health bar; `name` null hides it. */
  setBoss(name: string | null, fraction: number): void {
    const g = this.bossBar;
    g.clear();
    this.bossName.setVisible(!!name);
    if (!name) return;
    setText(this.bossName, name);
    const w = 520, x = VIEW.centerX - w / 2, y = 124;
    g.fillStyle(C.chip, 0.85).fillRect(x - 3, y - 3, w + 6, 18);
    meter(g, x, y, w, 12, fraction, C.bad, 0x3a1f19);
  }

  /** A control hint by the crosshair, for a few seconds. It waits behind banners and wave cards. */
  hint(parts: HintPart[]): void {
    if (this.busy()) {
      this.pendingHint = parts;
      return;
    }
    this.showHint(parts);
  }

  /** New enemies: a card per enemy (its figure, name and tags) on the right, for a few seconds. */
  threatCards(enemies: { def: EnemyDef; tags: string[] }[]): void {
    this.threatBox?.destroy();
    const s = this.scene;
    const shown = enemies.slice(0, 2);
    const W = 330;
    let y = 0;
    const cards = shown.map((e) => {
      const eyebrow = text(s, 18, 12, 'NEW THREAT', { size: 17, color: C.threat, bold: true, spacing: 2 });
      const plate = s.add.rectangle(18, 40, 108, 136, 0x8aa060, 0.28).setOrigin(0);
      const figure = enemyPortrait(s, e.def, 150, 130);
      figure.setPosition(72, 173);
      const name = text(s, 136, 108, e.def.name.toUpperCase(), { size: 36, font: STENCIL, wrap: W - 150 }).setOrigin(0, 0.5);
      if (name.width > W - 150) name.setScale((W - 150) / name.width);
      const tags = e.tags.map((tag) => {
        const t = tagStyle(tag);
        return chip(s, { icon: t.icon, text: tag, tone: t.tone, size: 17 });
      });
      const used = flowRow(tags, 18, 184, W - 36, 8);
      const h = 184 + used + 16;
      const bg = s.add.rectangle(0, 0, W, h, C.chip, 0.92).setOrigin(0).setStrokeStyle(2, C.threat);
      const card = s.add.container(0, y, [bg, eyebrow, plate, figure, name, ...tags.map((t) => t.c)]);
      y += h + 10;
      return card;
    });
    // Two cards at once are drawn smaller, so both fit above the bar.
    const scale = shown.length > 1 ? 0.8 : 1;
    // On touch screens the cards sit higher, clear of the fire button.
    const top = this.d.touch() ? 22 : shown.length > 1 ? 96 : 156;
    this.threatBox = s.add.container(VIEW.width - 26 - W * scale, top, cards).setScale(scale).setDepth(DEPTH.banner + 1);
    this.threatLeft = 4.5;
    this.threatBox.x += 40;
    s.tweens.add({ targets: this.threatBox, x: this.threatBox.x - 40, duration: 220, ease: 'Cubic.easeOut' });
  }

  /** A banner or a wave card is on screen: messages take turns. */
  private busy(): boolean {
    return this.bannerLeft > 0 || this.bannerSticky || this.card !== null;
  }

  private showHint(hint: HintPart[]): void {
    this.hintBox?.destroy();
    const s = this.scene;
    const parts: Part[] = hint.map((h) => {
      if (!h.key) return chip(s, { icon: h.icon, text: h.label, size: 21, alpha: 0.7 });
      const cap = keycap(s, h.key, 46);
      if (!h.label) return cap;
      const plate = chip(s, { icon: h.icon, text: h.label, size: 21, alpha: 0.7 });
      plate.c.setPosition(cap.w + 8, (cap.h - plate.h) / 2);
      return { c: s.add.container(0, 0, [cap.c, plate.c]), w: cap.w + 8 + plate.w, h: cap.h };
    });
    const total = parts.reduce((sum, p) => sum + p.w, 0) + 22 * (parts.length - 1);
    row(parts, -total / 2, 0, 22);
    this.hintBox = s.add.container(VIEW.centerX, 404, parts.map((p) => p.c)).setDepth(DEPTH.banner + 2);
    this.hintLeft = 6;
  }

  /** Radio chatter at the top left: a portrait, the line (at most six words) and the full line kept in the log. */
  radio(lines: { who: string; text: string }[]): void {
    for (const l of lines) appendLog(this.radioLog, l);
    this.radioQueue.push(...lines);
    if (this.radioLeft <= 0) this.nextRadio();
  }

  private nextRadio(): void {
    this.radioBox?.destroy();
    this.radioBox = null;
    const line = this.radioQueue.shift();
    if (!line) {
      this.radioLeft = 0;
      return;
    }
    const shown = clipWords(line.text);
    // The line wraps before it reaches the objective strip.
    const stripLeft = VIEW.centerX - (this.stripWidth || 340) / 2;
    const wrap = Phaser.Math.Clamp(stripLeft - 26 - 124, 200, 430);
    const part = radioChip(this.scene, line.who, shown, wrap);
    // On touch screens the pause and shop buttons own the top left corner.
    part.c.setPosition(22, this.d.touch() ? 86 : 22).setDepth(DEPTH.banner + 1);
    this.radioBox = part.c;
    // Long enough to read: a base plus time per word shown.
    this.radioLeft = 2.2 + wordCount(shown) * 0.36;
  }

  /** Between waves: a tick, the bonus and the two things to do next. Stays until the next wave starts. */
  waveCard(wave: number, reward: number, armory: { label: string; key: string | null }, next: { label: string; key: string | null }): void {
    this.hideCard();
    // A hint still on screen would sit on top of the cards.
    this.hintBox?.destroy();
    this.hintBox = null;
    this.hintLeft = 0;
    const s = this.scene;
    const title = text(s, 0, 0, `WAVE ${wave}`, { size: 72, font: STENCIL, shadow: 4 }).setOrigin(0, 0.5);
    const tickW = 66, gap = 18;
    const x0 = -(tickW + gap + title.width) / 2;
    const tick = icon(s, 'check', x0 + tickW / 2, 0, tickW, C.ok, { stroke: 2.6 });
    title.x = x0 + tickW + gap;
    const parts: Phaser.GameObjects.GameObject[] = [tick, title];
    if (reward > 0) {
      const bonus = chip(s, { icon: 'cash', text: `+${reward}`, tone: 'gold', size: 24 });
      bonus.c.setPosition(-bonus.w / 2, 58);
      parts.push(bonus.c);
    }
    const left = actionCard(s, 0, 0, { icon: 'cart', label: armory.label, key: armory.key, onClick: () => this.actions.armory?.() });
    const right = actionCard(s, 0, 0, { icon: 'play', label: next.label, key: next.key, primary: true, onClick: () => this.actions.nextWave?.() });
    const y = 128 + left.h / 2;
    left.c.setPosition(-13 - left.w / 2, y);
    right.c.setPosition(13 + right.w / 2, y);
    parts.push(left.c, right.c);
    this.card = s.add.container(VIEW.centerX, 150, parts).setDepth(DEPTH.banner + 1);
  }

  private hideCard(): void {
    this.card?.destroy();
    this.card = null;
  }

  hideBanner(): void {
    this.threatBox?.destroy();
    this.threatBox = null;
    this.threatLeft = 0;
    this.bannerLeft = 0;
    this.bannerSticky = false;
    this.dropBanner();
  }

  clearBanner(): void {
    this.hideCard();
    if (this.bannerSticky || this.bannerLeft > 0.5) this.bannerLeft = 0.5;
    this.bannerSticky = false;
  }

  // ------------------------------------------------------------ every frame

  update(dt: number): void {
    this.time += dt;
    this.updateMessages(dt);
    this.updateSlots();
    this.updateStatus(dt);
    this.updateAmmo();
    this.updateEffects();
  }

  private updateMessages(dt: number): void {
    if (this.hintLeft > 0) {
      this.hintLeft -= dt;
      this.hintBox?.setAlpha(Math.min(1, this.hintLeft / 0.6));
      if (this.hintLeft <= 0) {
        this.hintBox?.destroy();
        this.hintBox = null;
      }
    }
    if (this.threatLeft > 0) {
      this.threatLeft -= dt;
      this.threatBox?.setAlpha(Math.min(1, this.threatLeft / 0.6));
      if (this.threatLeft <= 0) {
        this.threatBox?.destroy();
        this.threatBox = null;
      }
    }
    if (this.pendingHint && !this.busy()) {
      const h = this.pendingHint;
      this.pendingHint = null;
      this.showHint(h);
    }
    if (this.radioLeft > 0) {
      this.radioLeft -= dt;
      this.radioBox?.setAlpha(Math.min(1, this.radioLeft / 0.4));
      if (this.radioLeft <= 0) this.nextRadio();
    }
    if (!this.bannerSticky && this.bannerLeft > 0) {
      this.bannerLeft -= dt;
      this.bannerBox?.setAlpha(Math.min(1, this.bannerLeft / 0.5));
      if (this.bannerLeft <= 0) this.dropBanner();
    }
  }

  private updateSlots(): void {
    const { weapons, abilities, bunker, support } = this.d;
    const usable = (slot: Slot, ok: boolean): void => {
      slot.icon.setAlpha(ok ? 1 : 0.35);
    };
    const gunIds = this.d.weaponSlots.slice(0, 4).filter((id) => this.d.offers(`weapon:${id}`));
    this.weaponSlots.forEach((s, i) => {
      const w = weaponById(gunIds[i]);
      const st = weapons.states.get(w.id)!;
      usable(s, st.owned);
      s.lock.setVisible(!st.owned && !st.unlocked);
      setText(s.bottom, st.owned ? (st.reserve === Infinity ? `${st.mag}/∞` : `${st.mag}/${st.reserve}`) : st.unlocked ? `$${w.price}` : '');
      s.bottom.setColor(css(st.owned && st.mag === 0 && st.reserve === 0 ? C.red : st.owned ? C.text : C.gold));
      this.drawFrame(s, weapons.current.def.id === w.id ? C.brass : 0);
    });

    this.modSlots.forEach((s, k) => {
      const m = MODS[this.offeredMods[k]];
      const st = abilities.mods.get(m.id)!;
      const active = st.activeLeft > 0;
      usable(s, st.charges > 0 || active);
      setText(s.top, st.charges > 0 ? `×${st.charges}` : '');
      setText(s.bottom, active ? `${Math.ceil(st.activeLeft)}s` : st.charges > 0 ? '' : `$${m.price}`);
      s.bottom.setColor(css(active ? C.gold : C.soft));
      s.bar.setVisible(active);
      if (active) {
        s.bar.setFillStyle(m.color);
        s.bar.width = (s.r.w - 4) * Math.min(1, st.activeLeft / st.duration);
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 6);
        this.drawFrame(s, m.color, Math.round(pulse * 10) / 10);
      } else this.drawFrame(s, 0);
    });

    const strike = (s: Slot, price: number, charges: number, cd: number, total: number, running: number | null): void => {
      usable(s, (charges > 0 && cd <= 0) || running !== null);
      setText(s.top, charges > 0 ? `×${charges}` : '');
      setText(s.bottom, running !== null ? `${Math.ceil(running)}s` : cd > 0 ? `${Math.ceil(cd)}s` : charges > 0 ? '' : `$${price}`);
      s.bottom.setColor(css(running !== null ? C.gold : C.soft));
      s.bar.setVisible(cd > 0);
      if (cd > 0) {
        s.bar.setFillStyle(0x8090a0);
        s.bar.width = (s.r.w - 4) * (1 - cd / total);
      }
      this.drawFrame(s, running !== null ? C.brass : 0);
    };
    this.supportSlots.forEach((s, k) => {
      const sp = SUPPORT[this.offeredSupport[k]];
      const st = abilities.support.get(sp.id)!;
      const running = sp.id === 'gunship' && support.gunshipActive ? support.gunshipRemaining : null;
      strike(s, sp.price, st.charges, st.cooldownLeft, st.cooldown, running);
    });
    this.defenseSlots.forEach((s, k) => {
      const df = DEFENSES[this.offeredDefense[k]];
      const st = abilities.defense.get(df.id)!;
      const running = df.id === 'wall' && bunker.shielded ? bunker.shieldRemaining : null;
      strike(s, df.price, st.charges, st.cooldownLeft, st.cooldown, running);
    });
  }

  private updateStatus(dt: number): void {
    const { bunker, economy } = this.d;
    const frac = bunker.fraction;
    this.hpLag += (frac - this.hpLag) * Math.min(1, dt * 2.2);
    if (frac > this.hpLag) this.hpLag = frac;
    const bx = HUD_AREA.status.x + 46, bw = 190, bh = 18, by = HUD_AREA.top + HUD_AREA.height / 2 - bh / 2;
    const g = this.hpBar;
    g.clear();
    g.fillStyle(0x333333, 1).fillRect(bx, by, bw, bh);
    g.fillStyle(0xd8d0b0, 0.5).fillRect(bx, by, bw * this.hpLag, bh);
    g.fillStyle(frac > 0.5 ? C.health : frac > 0.25 ? HEALTH_WARN : C.bad, 1).fillRect(bx, by, bw * frac, bh);
    if (bunker.shielded) {
      g.lineStyle(2, C.gold, 0.6 + 0.4 * Math.sin(this.time * 8));
      g.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);
    }

    if (economy.cash !== this.lastCash) {
      if (this.lastCash >= 0) this.cashFlash = economy.cash > this.lastCash ? 0.35 : -0.35;
      this.lastCash = economy.cash;
      setText(this.cashText, `$${economy.cash.toLocaleString('en-US')}`);
    }
    // A fortune shrinks to stay clear of the health bar.
    const fit = Math.min(1, CASH_W / Math.max(1, this.cashText.width));
    if (this.cashFlash > 0) {
      this.cashFlash = Math.max(0, this.cashFlash - dt);
      this.cashText.setColor(css(this.cashFlash > 0 ? 0xf4ffc8 : C.cash)).setScale(fit * (1 + this.cashFlash * 0.25));
    } else if (this.cashFlash < 0) {
      this.cashFlash = Math.min(0, this.cashFlash + dt);
      this.cashText.setColor(css(this.cashFlash < 0 ? C.red : C.cash)).setScale(fit);
    } else this.cashText.setScale(fit);

    const crit = bunker.critical;
    // The red edge hugs the screen, however wide it is.
    this.critVignette.setPosition(-SCREEN.mx, -SCREEN.my).setSize(SCREEN.width, VIEW.hudTop + SCREEN.my);
    this.critical.setVisible(crit && Math.sin(this.time * 7) > -0.2);
    this.critVignette.setStrokeStyle(60, 0xaa0000, crit ? 0.18 + 0.12 * Math.sin(this.time * 5) : 0);
  }

  private updateAmmo(): void {
    const cur = this.d.weapons.current;
    setText(this.ammoBig, `${cur.mag}`);
    setText(this.ammoSmall, cur.reserve === Infinity ? '/ ∞' : `/ ${cur.reserve}`);
    this.ammoBig.setColor(css(cur.mag === 0 ? C.red : cur.mag <= Math.ceil(cur.def.magazine * 0.25) ? C.gold : C.text));
    this.ammoPlate.setStrokeStyle(cur.mag === 0 ? 2 : 1, cur.mag === 0 ? C.red : 0xffffff, cur.mag === 0 ? 1 : 0.14);
  }

  /** What is running right now (ammo mods, support), as chips at the top right. */
  private updateEffects(): void {
    const { abilities, bunker, support } = this.d;
    const on: { icon: IconName; color: number; text: string }[] = [];
    for (const m of MODS) {
      const a = abilities.mods.get(m.id)!;
      if (a.activeLeft > 0) on.push({ icon: ITEM_ICON[m.id], color: m.color, text: `${Math.ceil(a.activeLeft)}s` });
    }
    if (support.gunshipActive) on.push({ icon: 'heli', color: C.gold, text: `${Math.ceil(support.gunshipRemaining)}s` });
    if (support.nukePending) on.push({ icon: 'nuke', color: C.red, text: 'LAUNCH' });
    if (bunker.shielded) on.push({ icon: 'shutters', color: C.gold, text: `${Math.ceil(bunker.shieldRemaining)}s` });
    const key = JSON.stringify(on);
    if (key === this.effectsKey) return;
    this.effectsKey = key;
    this.effects?.destroy();
    this.effects = null;
    if (!on.length) return;
    const chips = on.map((e, i) => {
      const p = chip(this.scene, { icon: e.icon, iconColor: e.color, text: e.text, size: 20 });
      p.c.setPosition(-p.w, i * (p.h + 6));
      return p.c;
    });
    this.effects = this.scene.add.container(VIEW.width - 22, 22, chips).setDepth(DEPTH.hud);
  }
}
