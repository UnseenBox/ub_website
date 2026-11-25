import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { BUNKER_TRACK, MAX_LEVEL, TRACKS, TrackId, bunkerHealth } from '../data/workshop';
import { weaponById } from '../data/weapons';
import {
  ATTACHMENTS, attachmentStatus, attachmentsOpen, buyAttachment, buyBunkerUpgrade, buyUpgrade, bunkerUpgradeStatus, fitAttachment,
  fittedAttachment, ownedWeapons, playerPower, playerWeapon, upgradeStatus, weaponLevels,
} from '../systems/Campaign';
import { attachmentById } from '../data/attachments';
import { drawLock } from '../ui/icons';
import { gainChip } from '../ui/messages';
import { profile } from '../systems/Profile';
import { SKINS, SkinId } from '../data/retention';
import { skinTexture } from '../rendering/SkinArt';
import { activeSkin, masteryStatus, ownedSkins, setSkin } from '../systems/Retention';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';

const BUNKER = 'bunker';

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
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x121310).setOrigin(0);
    this.add.rectangle(0, 0, VIEW.width, 70, 0x1c1d1a).setOrigin(0);
    this.add.rectangle(0, 70, VIEW.width, 3, 0x7a6420).setOrigin(0);
    this.add.text(24, 16, 'WORKSHOP', { fontFamily: STENCIL, fontSize: '36px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 });
    this.add.text(210, 32, "DOT OKAFOR'S BENCH · permanent upgrades", { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' });
    this.msg = this.add.text(VIEW.centerX, VIEW.height - 40, '', { fontFamily: STENCIL, fontSize: '20px', color: '#a8e090', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    button(this, VIEW.width - 170, VIEW.height - 40, 280, 44, 'BACK TO MAP  [ESC]', () => this.scene.start('Map'), 10, 0x6a7a8a);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Map'));
    this.draw();
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    const p = profile.get();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.dynamic.push(o);
      return o;
    };
    add(this.add.text(VIEW.width - 24, 14, `SUPPLIES ${p.supplies}`, { fontFamily: STENCIL, fontSize: '30px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0));
    add(this.add.text(VIEW.width - 24, 48, `POWER ${playerPower(p)}`, { fontFamily: MONO, fontSize: '13px', color: '#e8c060' }).setOrigin(1, 0));

    // Left: owned weapons and the bunker.
    const items = [...ownedWeapons(p), BUNKER];
    // Rows tighten up as the arsenal grows, so every entry fits above the back button.
    const rowH = Math.min(78, Math.floor((VIEW.height - 160) / items.length));
    const compact = rowH < 64;
    const nameY = compact ? 5 : 12, lineY = compact ? 29 : 40;
    items.forEach((id, i) => {
      const y = 100 + i * rowH;
      const sel = id === this.selected;
      const bg = add(this.add.rectangle(24, y, 330, rowH - 8, sel ? 0x34362c : 0x1e1f1c).setOrigin(0).setStrokeStyle(2, sel ? 0xc8a040 : 0x0a0a0a));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        this.selected = id;
        this.draw();
      });
      if (id === BUNKER) {
        add(this.add.image(70, y + (rowH - 8) / 2, 'icon_reinforce').setScale(compact ? 0.8 : 1.1));
        add(this.add.text(120, y + nameY, 'BUNKER', { fontFamily: STENCIL, fontSize: '20px', color: '#e0dcc0' }));
        add(this.add.text(120, y + lineY, `LV ${p.bunkerLevel}/${MAX_LEVEL}  ·  ${bunkerHealth(p.bunkerLevel)} HP`, { fontFamily: MONO, fontSize: '13px', color: '#a8a890' }));
      } else {
        const def = weaponById(id);
        const lv = weaponLevels(p, id);
        const icon = skinTexture(this, def.iconTexture, activeSkin(p, id));
        const tex = this.textures.get(icon).getSourceImage() as HTMLCanvasElement;
        add(this.add.image(78, y + (rowH - 8) / 2, icon).setScale(Math.min(96 / tex.width, (rowH - 16) / tex.height)));
        add(this.add.text(140, y + nameY, def.shortName, { fontFamily: STENCIL, fontSize: '20px', color: '#e0dcc0' }));
        const total = lv.damage + lv.handling + lv.magazine + lv.reload;
        add(this.add.text(140, y + lineY, `UPGRADES ${total}/${MAX_LEVEL * 4}`, { fontFamily: MONO, fontSize: '13px', color: '#a8a890' }));
      }
    });

    if (this.selected === BUNKER) this.drawBunker(add);
    else this.drawWeapon(this.selected, add);
  }

  private drawWeapon(id: string, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const p = profile.get();
    const def = playerWeapon(p, id);
    const base = weaponById(id);
    const lv = weaponLevels(p, id);
    const x0 = 390;
    add(this.add.text(x0, 96, base.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '30px', color: '#e8e0c0' }));
    add(this.add.text(x0, 134, base.description, { fontFamily: MONO, fontSize: '13px', color: '#9a9a86', wordWrap: { width: 840 } }));
    const pellets = def.pellets ? ` × ${def.pellets}` : '';
    // The four numbers that matter, as chips.
    const stats = [`DAMAGE ${def.damage.toFixed(0)}${pellets}`, `RATE ${def.fireRate.toFixed(1)}/s`, `MAG ${def.magazine}`, `RELOAD ${def.reloadTime.toFixed(2)}s`];
    let sx = x0;
    for (const label of stats) {
      const t = add(this.add.text(0, 0, label, { fontFamily: MONO, fontSize: '13px', color: '#c8d890' }));
      const cw = t.width + 18;
      add(this.add.rectangle(sx, 170, cw, 24, 0x23241f, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x5a5c48).setDepth(1));
      t.setPosition(sx + 9, 170).setOrigin(0, 0.5).setDepth(2);
      sx += cw + 8;
    }
    this.drawAttachment(id, add);
    this.drawMastery(id, add);

    TRACKS.forEach((t, i) => {
      const y = 192 + i * 76;
      const level = lv[t.id];
      const { cost, status } = upgradeStatus(p, id, t.id);
      add(this.add.rectangle(x0, y, 860, 68, 0x1e1f1c).setOrigin(0).setStrokeStyle(1, 0x3a3c38));
      add(this.add.text(x0 + 16, y + 8, t.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '20px', color: '#e0dcc0' }));
      add(this.add.rectangle(x0 + 16, y + 40, 56, 20, 0x253019, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x5fae3c));
      add(this.add.text(x0 + 44, y + 40, gainChip(t.perLevel), { fontFamily: MONO, fontSize: '13px', color: '#a8e090' }).setOrigin(0.5));
      for (let k = 0; k < MAX_LEVEL; k++) {
        add(this.add.rectangle(x0 + 330 + k * 34, y + 22, 24, 24, k < level ? 0xc8a040 : 0x2c2d2a).setOrigin(0).setStrokeStyle(2, k === level && level < MAX_LEVEL ? 0xa8e090 : 0x000000));
      }
      this.buyButton(add, x0 + 720, y + 34, cost, status, () => this.buy(() => buyUpgrade(profile.get(), id, t.id as TrackId), `${base.shortName} ${t.name.toUpperCase()} LV ${level + 1}`));
    });
  }

  /** One attachment slot per weapon: buy an attachment once, fit it to any gun. */
  private drawAttachment(id: string, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const p = profile.get();
    const x0 = 390;
    const y = 498;
    add(this.add.rectangle(x0, y, 860, 66, 0x1a1b18).setOrigin(0).setStrokeStyle(1, 0x5a5040));
    add(this.add.text(x0 + 16, y + 8, 'ATTACHMENT', { fontFamily: STENCIL, fontSize: '20px', color: '#e8c060' }));
    const fitted = fittedAttachment(p, id);
    if (!attachmentsOpen(p) && !p.attachments.length) {
      add(this.add.graphics({ x: x0 + 22, y: y + 44 })).setDepth(1);
      drawLock(this.dynamic[this.dynamic.length - 1] as Phaser.GameObjects.Graphics, 0x7a7a6c);
      add(this.add.text(x0 + 40, y + 44, 'LOCKED', { fontFamily: MONO, fontSize: '13px', color: '#7a7a6c' }).setOrigin(0, 0.5));
      return;
    }
    add(this.add.text(x0 + 16, y + 38, fitted ? attachmentById(fitted)!.text : 'None fitted', { fontFamily: MONO, fontSize: '12px', color: '#9a9a86', wordWrap: { width: 250 } }));
    const chips = ['', ...ATTACHMENTS.map((a) => a.id)];
    chips.forEach((a, i) => {
      const cx = x0 + 860 - (chips.length - i) * 112 + 52;
      const st = a ? attachmentStatus(p, a) : { cost: 0, status: 'owned' as const };
      const on = (fitted ?? '') === a;
      const chip = add(this.add.rectangle(cx, y + 33, 104, 52, on ? 0x3a3620 : 0x222423).setStrokeStyle(2, on ? 0xe8c060 : 0x0a0a0a));
      const name = a ? attachmentById(a)!.name.toUpperCase() : 'NONE';
      add(this.add.text(cx, y + 22, name, { fontFamily: STENCIL, fontSize: '13px', color: on ? '#e8c060' : '#d0ccb4', align: 'center', wordWrap: { width: 98 } }).setOrigin(0.5));
      const sub = !a ? '' : on ? 'FITTED' : st.status === 'owned' ? 'FIT' : st.status === 'locked' ? 'LOCKED' : `BUY ${st.cost}`;
      add(this.add.text(cx, y + 43, sub, { fontFamily: MONO, fontSize: '11px', color: st.status === 'supplies' ? '#c87060' : '#a8c890' }).setOrigin(0.5));
      chip.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pickAttachment(id, a));
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
      this.msg.setText(a ? `${attachmentById(a)!.name.toUpperCase()} ${result === 'bought' ? 'BOUGHT AND ' : ''}FITTED` : 'ATTACHMENT REMOVED').setColor('#a8e090');
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES' : 'NOT AVAILABLE YET').setColor('#ff7050');
    }
    this.draw();
  }

  /** Kills with the weapon unlock skins; pick the one it wears. */
  private drawMastery(id: string, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const p = profile.get();
    const x0 = 390;
    const y = 572;
    const { kills, next } = masteryStatus(p, id);
    add(this.add.rectangle(x0, y, 860, 70, 0x1a1b18).setOrigin(0).setStrokeStyle(1, 0x5a5040));
    add(this.add.text(x0 + 16, y + 10, `MASTERY  ·  ${kills} KILLS`, { fontFamily: STENCIL, fontSize: '20px', color: '#e8c060' }));
    const frac = next ? Math.min(1, kills / next.kills) : 1;
    add(this.add.rectangle(x0 + 16, y + 48, 300, 8, 0x0c0d0c, 1).setOrigin(0, 0.5).setStrokeStyle(1, 0x3a3c38));
    add(this.add.rectangle(x0 + 17, y + 48, 298 * frac, 6, 0xc8a040, 1).setOrigin(0, 0.5));
    add(this.add.text(x0 + 330, y + 48, next ? `NEXT ${SKINS[next.skin].name.toUpperCase()} · ${next.kills}` : 'ALL SKINS EARNED', { fontFamily: MONO, fontSize: '12px', color: '#9a9a86' }).setOrigin(0, 0.5));
    const owned = ownedSkins(p, id);
    const wearing = activeSkin(p, id);
    const chips: (SkinId | '')[] = ['', ...owned];
    if (chips.length === 1) {
      add(this.add.text(x0 + 844, y + 35, 'SKINS: earn kills with this weapon', { fontFamily: MONO, fontSize: '13px', color: '#7a7a6c' }).setOrigin(1, 0.5));
      return;
    }
    chips.forEach((s, i) => {
      const cx = x0 + 844 - (chips.length - i) * 96 + 48;
      const sel = s === wearing;
      const chip = add(this.add.rectangle(cx, y + 35, 88, 40, sel ? 0x3a3620 : 0x222423).setStrokeStyle(2, sel ? 0xe8c060 : 0x0a0a0a));
      if (s) add(this.add.rectangle(cx - 30, y + 35, 14, 24, Phaser.Display.Color.HexStringToColor(SKINS[s].color).color).setStrokeStyle(1, 0x000000));
      add(this.add.text(cx + (s ? 8 : 0), y + 35, s ? SKINS[s].name.toUpperCase() : 'FACTORY', { fontFamily: STENCIL, fontSize: '14px', color: sel ? '#e8c060' : '#d0ccb4' }).setOrigin(0.5));
      chip.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        profile.update((d) => { setSkin(d, id, s); });
        this.draw();
      });
    });
  }

  private drawBunker(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const p = profile.get();
    const x0 = 390;
    add(this.add.text(x0, 96, 'REINFORCED BUNKER', { fontFamily: STENCIL, fontSize: '30px', color: '#e8e0c0' }));
    add(this.add.text(x0, 134, 'Concrete, rebar and more sandbags. Every mission starts with the extra health.', { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' }));
    add(this.add.text(x0, 164, `BUNKER HEALTH ${bunkerHealth(p.bunkerLevel)}`, { fontFamily: MONO, fontSize: '15px', color: '#c8d890' }));
    const y = 214;
    add(this.add.rectangle(x0, y, 860, 92, 0x1e1f1c).setOrigin(0).setStrokeStyle(1, 0x3a3c38));
    add(this.add.text(x0 + 16, y + 12, BUNKER_TRACK.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '22px', color: '#e0dcc0' }));
    add(this.add.text(x0 + 16, y + 46, `Each level: ${BUNKER_TRACK.perLevel}`, { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' }));
    for (let k = 0; k < MAX_LEVEL; k++) {
      add(this.add.rectangle(x0 + 330 + k * 34, y + 30, 26, 26, k < p.bunkerLevel ? 0xc8a040 : 0x2c2d2a).setOrigin(0).setStrokeStyle(1, 0x000000));
    }
    const { cost, status } = bunkerUpgradeStatus(p);
    this.buyButton(add, x0 + 720, y + 46, cost, status, () => this.buy(() => buyBunkerUpgrade(profile.get()), `BUNKER LV ${p.bunkerLevel + 1}`));
  }

  private buyButton(
    add: <T extends Phaser.GameObjects.GameObject>(o: T) => T, x: number, y: number, cost: number | null, status: string, onBuy: () => void,
  ): void {
    if (status === 'maxed' || cost === null) {
      add(this.add.text(x, y, 'MAXED', { fontFamily: STENCIL, fontSize: '22px', color: '#8ae070' }).setOrigin(0.5));
      return;
    }
    const c = add(button(this, x, y, 220, 44, `UPGRADE  ${cost}`, onBuy, 10, status === 'ok' ? 0x5fae3c : 0x6a4a40));
    if (status !== 'ok') c.setAlpha(0.6);
  }

  private buy(action: () => string, label: string): void {
    let result = '';
    profile.update((d) => {
      void d;
      result = action();
    });
    if (result === 'ok') {
      audio.play('buy', { volume: 0.8 });
      this.msg.setText(`${label} INSTALLED`).setColor('#a8e090');
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES — WIN MISSIONS OR REPLAY FOR STARS' : 'CANNOT UPGRADE').setColor('#ff7050');
    }
    this.draw();
  }
}
