import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { BUNKER_TRACK, MAX_LEVEL, TRACKS, TrackId, bunkerHealth } from '../data/workshop';
import { WEAPONS, WeaponDef, weaponById } from '../data/weapons';
import {
  ATTACHMENTS, attachmentStatus, attachmentsOpen, buyAttachment, buyBunkerUpgrade, buyUpgrade, bunkerUpgradeStatus, fitAttachment,
  fittedAttachment, ownedWeapons, playerPower, playerWeapon, upgradeStatus, weaponLevels,
} from '../systems/Campaign';
import { attachmentById } from '../data/attachments';
import { gainChip } from '../ui/messages';
import { profile } from '../systems/Profile';
import { SKINS, SkinId } from '../data/retention';
import { activeSkin, masteryStatus, ownedSkins, setSkin } from '../systems/Retention';
import { ITEM_ICON, WEAPON_ICON, icon, type IconName } from '../ui/icons';
import { C, STENCIL, box, chip, css, meter, pushButton, row, text, type Part } from '../ui/kit';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';

const BUNKER = 'bunker';
/** Left column, and where the detail column starts. */
const LIST_X = 28, LIST_W = 306, X0 = 360, W = VIEW.width - X0 - 28, TOP = 96;

const STAT_ICON: Record<TrackId, IconName> = { damage: 'skull', handling: 'bolt', magazine: 'plus', reload: 'clock' };

/** A weapon's strength on one track: bigger is better. */
function score(def: WeaponDef, track: TrackId): number {
  if (track === 'damage') return def.damage * (def.pellets ?? 1);
  if (track === 'handling') return def.fireRate;
  if (track === 'magazine') return def.magazine;
  return 1 / def.reloadTime;
}

/** How full a stat bar is: this gun against the best gun there is, with room left for upgrades. */
function barFraction(def: WeaponDef, track: TrackId): number {
  const best = Math.max(...WEAPONS.map((w) => score(w, track)));
  return Phaser.Math.Clamp(Math.sqrt(score(def, track) / best) * 0.82, 0.06, 0.94);
}

/** The stat as the player knows it, small, under its bar. */
function statValue(def: WeaponDef, track: TrackId): string {
  if (track === 'damage') return `${def.damage.toFixed(0)}${def.pellets ? ` × ${def.pellets}` : ''}`;
  if (track === 'handling') return `${def.fireRate.toFixed(1)}/s`;
  if (track === 'magazine') return `${def.magazine}`;
  return `${def.reloadTime.toFixed(2)}s`;
}

type Add = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/** Dot's Workshop: spend Supplies on permanent weapon and bunker upgrades. */
export class WorkshopScene extends Phaser.Scene {
  private selected = 'service';
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.dynamic = [];
    backdrop(this, C.night);
    const back = pushButton(this, 0, 46, { h: 48, size: 22, icon: 'back', label: 'MAP', onClick: () => this.scene.start('Map') });
    back.c.x = LIST_X + back.w / 2;
    text(this, LIST_X + back.w + 20, 46, 'WORKSHOP', { size: 34, font: STENCIL, color: C.title }).setOrigin(0, 0.5);
    this.msg = text(this, X0 + W / 2, VIEW.height - 28, '', { size: 22, font: STENCIL, color: C.green }).setOrigin(0.5).setDepth(5);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Map'));
    this.draw();
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const p = profile.get();
    const add: Add = (o) => {
      this.dynamic.push(o);
      return o;
    };
    const totals: Part[] = [
      chip(this, { icon: 'bolt', text: `${playerPower(p)}`, tone: 'gold', size: 20 }),
      chip(this, { icon: 'crate', iconColor: C.brass, text: `${p.supplies}`, size: 20 }),
    ];
    for (const t of totals) add(t.c);
    row(totals, VIEW.width - 28 - totals.reduce((n, t) => n + t.w, 8), 46);

    // Left: owned weapons and the bunker.
    const items = [...ownedWeapons(p), BUNKER];
    // Rows tighten up as the arsenal grows, so every entry fits.
    const step = Math.min(76, Math.floor((VIEW.height - TOP - 12) / items.length));
    const h = step - 8;
    items.forEach((id, i) => {
      const y = TOP + i * step;
      const sel = id === this.selected;
      const bg = add(box(this, LIST_X, y, LIST_W, h, C.tile, sel ? C.brass : 0x2a2c24));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        this.selected = id;
        this.draw();
      });
      const mid = y + h / 2;
      const bunker = id === BUNKER;
      const skin = bunker ? '' : activeSkin(p, id);
      const tone = skin ? Phaser.Display.Color.HexStringToColor(SKINS[skin].color).color : C.iconTone;
      add(icon(this, bunker ? 'shield' : WEAPON_ICON[id], LIST_X + 52, mid, Math.min(bunker ? 38 : 32, h - 12), tone));
      add(text(this, LIST_X + 100, mid, bunker ? 'BUNKER' : weaponById(id).shortName, { size: Math.min(28, h - 16), font: STENCIL }).setOrigin(0, 0.5));
      const lv = bunker ? null : weaponLevels(p, id);
      const filled = lv ? Math.ceil((lv.damage + lv.handling + lv.magazine + lv.reload) / 4) : p.bunkerLevel;
      const g = add(this.add.graphics());
      for (let k = 0; k < MAX_LEVEL; k++) {
        g.fillStyle(k < filled ? C.brass : 0x3a3c32, 1).fillRect(LIST_X + LIST_W - 90 + k * 16, mid - 6, 12, 12);
      }
    });

    if (this.selected === BUNKER) this.drawBunker(add);
    else this.drawWeapon(this.selected, add);
  }

  /** One stat: icon, bar with the next level's gain in green, the gain as a number and the buy button. */
  private statRow(
    add: Add, y: number, o: { icon: IconName; frac: number; gain: number; gainText: string; value: string; level: number },
    cost: number | null, status: string, onBuy: () => void,
  ): void {
    const h = 74;
    add(box(this, X0, y, W, h, C.card));
    add(icon(this, o.icon, X0 + 40, y + h / 2, 40, C.iconTone));
    const mx = X0 + 82, mw = W - 82 - 300, my = y + 18;
    const g = add(this.add.graphics());
    meter(g, mx, my, mw, 20, o.frac, C.brass);
    const maxed = o.level >= MAX_LEVEL;
    if (!maxed) g.fillStyle(C.ok, 0.7).fillRect(mx + mw * o.frac, my, mw * Math.min(o.gain, 1 - o.frac), 20);
    add(text(this, mx, my + 25, o.value, { size: 15, color: C.soft, bold: true }));
    for (let k = 0; k < MAX_LEVEL; k++) {
      g.fillStyle(k < o.level ? C.brass : 0x3a3c32, 1).fillRect(mx + mw - (MAX_LEVEL - k) * 20 + 4, my + 28, 16, 8);
    }
    if (!maxed) add(text(this, X0 + W - 196, y + h / 2, o.gainText, { size: 21, color: C.ok, bold: true }).setOrigin(1, 0.5));
    const bx = X0 + W - 94;
    if (status === 'maxed' || cost === null) {
      add(icon(this, 'check', bx - 34, y + h / 2, 30, C.ok, { stroke: 2.6 }));
      add(text(this, bx + 14, y + h / 2, 'MAX', { size: 26, font: STENCIL, color: C.ok }).setOrigin(0.5));
      return;
    }
    const ok = status === 'ok';
    add(pushButton(this, bx, y + h / 2, {
      w: 162, h: 50, size: 26, icon: 'crate', iconColor: ok ? C.brass : C.dim, label: `${cost}`, tone: ok ? 'buy' : 'off', onClick: onBuy,
    }).c);
  }

  private drawWeapon(id: string, add: Add): void {
    const p = profile.get();
    const def = playerWeapon(p, id);
    const base = weaponById(id);
    const lv = weaponLevels(p, id);
    const name = add(text(this, X0, TOP - 4, base.name.toUpperCase(), { size: 34, font: STENCIL }));
    add(icon(this, WEAPON_ICON[id], X0 + name.width + 60, TOP + 18, 34, C.iconTone));

    TRACKS.forEach((t, i) => {
      const level = lv[t.id];
      const { cost, status } = upgradeStatus(p, id, t.id);
      const percent = gainChip(t.perLevel);
      const step = Math.abs(parseFloat(percent)) / 100;
      const frac = barFraction(def, t.id);
      this.statRow(add, TOP + 50 + i * 84, {
        icon: STAT_ICON[t.id], frac, gain: Math.max(0.025, frac * step), gainText: percent.replace('-', '−'), value: statValue(def, t.id), level,
      }, cost, status, () => this.buy(() => buyUpgrade(profile.get(), id, t.id), `${base.shortName} ${t.name.toUpperCase()} LV ${level + 1}`));
    });
    const y = TOP + 50 + TRACKS.length * 84 + 4;
    const locked: Part[] = [];
    const attachments = attachmentsOpen(p) || p.attachments.length > 0;
    const skins = ownedSkins(p, id);
    if (!attachments) locked.push(chip(this, { icon: 'lock', text: 'ATTACHMENT', tone: 'muted', size: 18, dashed: true }));
    if (!skins.length) {
      const { kills, next } = masteryStatus(p, id);
      locked.push(chip(this, { icon: 'lock', text: next ? `SKINS ${kills}/${next.kills}` : 'SKINS', tone: 'muted', size: 18, dashed: true }));
    }
    if (attachments) this.drawAttachment(id, add, y);
    if (skins.length) this.drawMastery(id, add, attachments ? y + 88 : y, skins);
    for (const l of locked) add(l.c);
    // Padlock chips sit under whatever rows are open.
    const lockY = y + (attachments ? 88 : 0) + (skins.length ? 72 : 0) + 22;
    row(locked, X0, Math.min(lockY, VIEW.height - 62), 12);
  }

  /** One attachment slot per weapon: buy an attachment once, fit it to any gun. */
  private drawAttachment(id: string, add: Add, y: number): void {
    const p = profile.get();
    const fitted = fittedAttachment(p, id);
    const options = ['', ...ATTACHMENTS.map((a) => a.id)];
    const gap = 10, w = Math.floor((W - gap * (options.length - 1)) / options.length), h = 78;
    options.forEach((a, i) => {
      const x = X0 + i * (w + gap);
      const st = a ? attachmentStatus(p, a) : { cost: 0, status: 'owned' as const };
      const on = (fitted ?? '') === a;
      const bg = add(box(this, x, y, w, h, on ? C.raised : C.card, on ? C.brass : C.line));
      const def = a ? attachmentById(a)! : null;
      const label = add(text(this, x + w / 2, y + 20, def ? def.name.toUpperCase() : 'NO ATTACHMENT', { size: 17, font: STENCIL, color: on ? C.gold : C.text }).setOrigin(0.5));
      if (label.width > w - 12) label.setScale((w - 12) / label.width);
      const cy = y + 54;
      if (on) add(icon(this, 'check', x + w / 2, cy, 24, C.ok, { stroke: 2.6 }));
      else if (st.status === 'owned') add(text(this, x + w / 2, cy, 'FIT', { size: 15, color: C.soft, bold: true }).setOrigin(0.5));
      else if (st.status === 'locked') add(icon(this, 'lock', x + w / 2, cy, 22, C.dim));
      else {
        const price = add(text(this, 0, cy, `${st.cost}`, { size: 17, color: st.status === 'supplies' ? C.red : C.green, bold: true }).setOrigin(0, 0.5));
        const left = x + w / 2 - (26 + price.width) / 2;
        add(icon(this, 'crate', left + 10, cy, 20, C.brass));
        price.x = left + 26;
      }
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pickAttachment(id, a));
      bg.on('pointerover', () => {
        this.msg.setText(def ? def.text.toUpperCase() : '').setColor(css(C.soft));
      });
    });
  }

  private pickAttachment(weaponId: string, a: string): void {
    let result = '';
    profile.update((d) => {
      if (a && !d.attachments.includes(a)) {
        result = buyAttachment(d, a);
        if (result !== 'owned') return;
        result = 'bought';
      }
      fitAttachment(d, weaponId, a);
      if (!result) result = 'fitted';
    });
    if (result === 'bought' || result === 'fitted') {
      audio.play(result === 'bought' ? 'buy' : 'ui_click', { volume: 0.7 });
      this.msg.setText(a ? `${attachmentById(a)!.name.toUpperCase()} ${result === 'bought' ? 'BOUGHT AND ' : ''}FITTED` : 'ATTACHMENT REMOVED').setColor(css(C.green));
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES' : 'NOT AVAILABLE YET').setColor(css(C.red));
    }
    this.draw();
  }

  /** Kills with the weapon unlock skins; pick the one it wears. */
  private drawMastery(id: string, add: Add, y: number, owned: SkinId[]): void {
    const p = profile.get();
    const { kills, next } = masteryStatus(p, id);
    add(box(this, X0, y, W, 62, C.card));
    add(icon(this, 'skull', X0 + 28, y + 31, 28, C.iconTone));
    const g = add(this.add.graphics());
    meter(g, X0 + 54, y + 16, 190, 12, next ? kills / next.kills : 1, C.brass);
    add(text(this, X0 + 54, y + 34, next ? `${kills}/${next.kills}` : `${kills}`, { size: 14, color: C.soft, bold: true }));
    const wearing = activeSkin(p, id);
    const swatches: (SkinId | '')[] = ['', ...owned];
    const w = Math.min(104, Math.floor((W - 280) / swatches.length) - 8);
    swatches.forEach((s, i) => {
      const x = X0 + W - 10 - (swatches.length - i) * (w + 8) + 8;
      const sel = s === wearing;
      const bg = add(box(this, x, y + 8, w, 46, sel ? C.raised : C.tile, sel ? C.brass : C.line));
      const tone = s ? Phaser.Display.Color.HexStringToColor(SKINS[s].color).color : C.iconTone;
      add(icon(this, WEAPON_ICON[id], x + w / 2, y + 25, Math.min(24, (w - 8) / 2), tone));
      const label = add(text(this, x + w / 2, y + 44, s ? SKINS[s].name.toUpperCase() : 'FACTORY', { size: 11, color: sel ? C.gold : C.soft, bold: true }).setOrigin(0.5));
      if (label.width > w - 6) label.setScale((w - 6) / label.width);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        profile.update((d) => { setSkin(d, id, s); });
        this.draw();
      });
    });
  }

  private drawBunker(add: Add): void {
    const p = profile.get();
    const name = add(text(this, X0, TOP - 4, BUNKER_TRACK.name.toUpperCase(), { size: 34, font: STENCIL }));
    add(icon(this, ITEM_ICON.reinforce, X0 + name.width + 36, TOP + 18, 34, C.iconTone));
    const level = p.bunkerLevel;
    const { cost, status } = bunkerUpgradeStatus(p);
    const full = bunkerHealth(MAX_LEVEL);
    this.statRow(add, TOP + 50, {
      icon: 'shield', frac: (bunkerHealth(level) / full) * 0.94, gain: (BUNKER_TRACK.healthPerLevel / full) * 0.94,
      gainText: gainChip(BUNKER_TRACK.perLevel), value: `${bunkerHealth(level)}`, level,
    }, cost, status, () => this.buy(() => buyBunkerUpgrade(profile.get()), `BUNKER LV ${level + 1}`));
  }

  private buy(action: () => string, label: string): void {
    let result = '';
    profile.update((d) => {
      void d;
      result = action();
    });
    if (result === 'ok') {
      audio.play('buy', { volume: 0.8 });
      this.msg.setText(`${label} INSTALLED`).setColor(css(C.green));
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES' : 'CANNOT UPGRADE').setColor(css(C.red));
    }
    this.draw();
  }
}
