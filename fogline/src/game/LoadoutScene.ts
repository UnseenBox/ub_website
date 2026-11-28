import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { resolveMission } from '../systems/Retention';
import { SUPPORT, SupportId } from '../data/upgrades';
import {
  LOADOUT_SUPPORTS, LOADOUT_WEAPONS, ownedSupports, ownedWeapons, playerWeapon, resolveLoadout,
} from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { WEAPONS, WeaponDef, weaponById } from '../data/weapons';
import { ITEM_ICON, WEAPON_ICON, icon, iconWidth, type IconName } from '../ui/icons';
import { BODY, C, STENCIL, box, chip, meter, pushButton, text } from '../ui/kit';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';

export interface LoadoutData {
  missionId: string;
  /** True: DEPLOY starts the mission. False: opened from the map just to change the loadout. */
  deploy: boolean;
  /** Deploy the Veteran version. */
  veteran?: boolean;
}

/** Pick what to carry: up to three weapons and two support strikes. */
export class LoadoutScene extends Phaser.Scene {
  private weapons: string[] = [];
  private supports: SupportId[] = [];
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private data_!: LoadoutData;
  private msg!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;

  constructor() {
    super('Loadout');
  }

  /** Fog Surge or Last Stand: BACK returns to the HQ instead of the map. */
  private mode = false;

  create(data: LoadoutData): void {
    this.data_ = data;
    this.input.setDefaultCursor('default');
    const lo = resolveLoadout(profile.get());
    this.weapons = [...lo.weapons];
    this.supports = [...lo.supports];
    this.dynamic = [];
    const mission = resolveMission(data.missionId, profile.get(), Date.now())!;
    // A side quest is reached from the map, like a mission; a surge or Last Stand from the HQ.
    this.mode = mission.mode === 'surge' || mission.mode === 'endless';

    backdrop(this, C.night);
    const title = text(this, 28, 46, 'LOADOUT', { size: 36, font: STENCIL, color: C.title }).setOrigin(0, 0.5);
    const next = chip(this, {
      icon: mission.mode === 'surge' ? 'bolt' : mission.mode === 'endless' ? 'wave' : 'play',
      text: mission.mode === 'endless' ? 'LAST STAND' : `${mission.mode ? '' : `${mission.number} `}${mission.name.toUpperCase()}`,
      tone: 'gold', size: 20,
    });
    next.c.setPosition(28 + title.width + 22, 46 - next.h / 2);
    // Guns the mission lends come on top of the player's choice.
    let lx = next.c.x + next.w + 12;
    for (const id of mission.issue.weapons.filter((w) => !ownedWeapons(profile.get()).includes(w))) {
      const lent = chip(this, { icon: WEAPON_ICON[id], text: `+ ${weaponById(id).shortName}`, tone: 'green', size: 20 });
      lent.c.setPosition(lx, 46 - lent.h / 2);
      lx += lent.w + 10;
    }
    this.msg = text(this, 28, VIEW.height - 44, '', { size: 22, font: STENCIL, color: C.red }).setOrigin(0, 0.5);
    const by = VIEW.height - 46;
    const go = pushButton(this, 0, by, {
      h: 60, size: 28, icon: data.deploy ? 'play' : 'check', label: data.deploy ? 'DEPLOY' : 'DONE', key: 'ENTER',
      tone: data.deploy ? 'go' : 'buy', onClick: () => this.finish(data.deploy),
    });
    go.c.x = VIEW.width - 28 - go.w / 2;
    if (data.deploy) {
      const back = pushButton(this, 0, by, { h: 60, size: 26, icon: 'back', label: 'BACK', onClick: () => this.finish(false) });
      back.c.x = go.c.x - go.w / 2 - 14 - back.w / 2;
    }
    this.input.keyboard!.on('keydown-ENTER', () => this.finish(data.deploy));
    this.input.keyboard!.on('keydown-ESC', () => this.finish(false));
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
    /** A heading with one pip for every slot, filled when taken. */
    const heading = (y: number, name: IconName, label: string, taken: number, slots: number): void => {
      add(icon(this, name, 28 + iconWidth(name, 26) / 2, y + 16, 26, C.iconTone));
      const t = add(text(this, 40 + iconWidth(name, 26), y, label, { size: 24, font: STENCIL }));
      const g = add(this.add.graphics());
      for (let k = 0; k < slots; k++) g.fillStyle(k < taken ? C.brass : 0x3a3c32, 1).fillRect(t.x + t.width + 14 + k * 22, y + 9, 16, 16);
    };
    heading(86, 'carbine', 'WEAPONS', this.weapons.length, LOADOUT_WEAPONS);
    const owned = ownedWeapons(p);
    // Four across; rows tighten once the arsenal passes eight guns.
    const cols = 4, gap = 12, w = Math.floor((VIEW.width - 56 - gap * (cols - 1)) / cols);
    const rows = Math.ceil(owned.length / cols);
    const h = rows > 2 ? 104 : 142;
    owned.forEach((id, i) => {
      const x = 28 + (i % cols) * (w + gap), y = 128 + Math.floor(i / cols) * (h + 10);
      const on = this.weapons.includes(id);
      const def = playerWeapon(p, id);
      const bg = add(box(this, x, y, w, h, on ? C.raised : C.card, on ? C.brass : C.line));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleWeapon(id));
      add(icon(this, WEAPON_ICON[id], x + 62, y + h / 2 - 8, 38, on ? C.text : C.iconTone));
      add(text(this, x + 62, y + h - 20, def.shortName, { size: 20, font: STENCIL }).setOrigin(0.5));
      if (on) add(text(this, x + 12, y + 6, `${this.weapons.indexOf(id) + 1}`, { size: 22, color: C.brass, bold: true }));
      const g = add(this.add.graphics());
      statBars(def).forEach((bar, k) => {
        const by = y + h / 2 + (k - 1) * (h > 120 ? 30 : 24);
        add(icon(this, bar.icon, x + 138, by, 20, C.soft));
        meter(g, x + 158, by - 5, w - 174, 10, bar.frac, C.brass);
      });
    });

    const sy = 128 + rows * (h + 10) + 8;
    heading(sy, 'heli', 'SUPPORT', this.supports.length, LOADOUT_SUPPORTS);
    const strikes = ownedSupports(p);
    if (!strikes.length) add(icon(this, 'lock', 54, sy + 76, 44, C.dim));
    strikes.forEach((id, i) => {
      const def = SUPPORT.find((s) => s.id === id)!;
      const x = 28 + i * (w + gap), y = sy + 42;
      const on = this.supports.includes(id);
      const bg = add(box(this, x, y, w, 88, on ? C.raised : C.card, on ? C.brass : C.line));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleSupport(id));
      bg.on('pointerover', () => this.tip.setText(def.description));
      bg.on('pointerout', () => this.tip.setText(''));
      add(icon(this, ITEM_ICON[id], x + 48, y + 44, 44, on ? C.text : C.iconTone));
      add(text(this, x + 92, y + 30, def.name.toUpperCase(), { size: 19, font: STENCIL }));
      add(text(this, x + 92, y + 56, def.key, { size: 14, color: C.muted, bold: true }));
    });
    // A strike's full description, only while the pointer is on it.
    this.tip = add(text(this, 28, sy + 140, '', { size: 15, font: BODY, color: C.soft }));
  }

  private toggleWeapon(id: string): void {
    audio.play('ui_click', { volume: 0.6 });
    if (this.weapons.includes(id)) {
      if (this.weapons.length <= 1) return this.flash('Carry at least one weapon.');
      this.weapons = this.weapons.filter((w) => w !== id);
    } else {
      if (this.weapons.length >= LOADOUT_WEAPONS) return this.flash(`You can carry ${LOADOUT_WEAPONS} weapons. Drop one first.`);
      this.weapons.push(id);
    }
    this.weapons = ownedWeapons(profile.get()).filter((w) => this.weapons.includes(w));
    this.flash('');
    this.draw();
  }

  private toggleSupport(id: SupportId): void {
    audio.play('ui_click', { volume: 0.6 });
    if (this.supports.includes(id)) this.supports = this.supports.filter((s) => s !== id);
    else if (this.supports.length >= LOADOUT_SUPPORTS) return this.flash(`You can bring ${LOADOUT_SUPPORTS} support strikes. Drop one first.`);
    else this.supports.push(id);
    this.flash('');
    this.draw();
  }

  private flash(text: string): void {
    this.msg.setText(text);
    if (text) audio.play('deny', { volume: 0.5 });
  }

  private finish(deploy: boolean): void {
    profile.update((d) => {
      d.loadout = { weapons: [...this.weapons], supports: [...this.supports] };
    });
    if (deploy) {
      audio.play('radio', { volume: 0.6 });
      this.scene.start('Game', { missionId: this.data_.missionId, veteran: this.data_.veteran });
    } else {
      this.scene.start(this.mode ? 'HQ' : 'Map');
    }
  }
}

/** Damage, fire rate and magazine, each against the best gun there is. */
function statBars(def: WeaponDef): { icon: IconName; frac: number }[] {
  const part = (value: number, of: (w: WeaponDef) => number): number => Phaser.Math.Clamp(Math.sqrt(value / Math.max(...WEAPONS.map(of))), 0.06, 1);
  return [
    { icon: 'skull', frac: part(def.damage * (def.pellets ?? 1), (w) => w.damage * (w.pellets ?? 1)) },
    { icon: 'bolt', frac: part(def.fireRate, (w) => w.fireRate) },
    { icon: 'plus', frac: part(def.magazine, (w) => w.magazine) },
  ];
}
