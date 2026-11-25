import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { resolveMission } from '../systems/Retention';
import { SUPPORT, SupportId } from '../data/upgrades';
import { weaponById } from '../data/weapons';
import {
  LOADOUT_SUPPORTS, LOADOUT_WEAPONS, ownedSupports, ownedWeapons, playerWeapon, resolveLoadout,
} from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { MONO, STENCIL, button } from '../ui/widgets';
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
    this.mode = !!mission.mode;

    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x121310).setOrigin(0);
    this.add.rectangle(0, 0, VIEW.width, 70, 0x1c1d1a).setOrigin(0);
    this.add.rectangle(0, 70, VIEW.width, 3, 0x7a6420).setOrigin(0);
    this.add.text(24, 16, 'LOADOUT', { fontFamily: STENCIL, fontSize: '36px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 });
    this.add.text(200, 32, mission.mode === 'surge' ? `NEXT: FOG SURGE · ${mission.name.toUpperCase()}` : mission.mode === 'endless' ? 'NEXT: LAST STAND' : `NEXT: MISSION ${mission.number} · ${mission.name.toUpperCase()}`, { fontFamily: MONO, fontSize: '14px', color: '#b8b090' });
    const lent = mission.issue.weapons.filter((w) => !ownedWeapons(profile.get()).includes(w)).map((w) => weaponById(w).name);
    if (lent.length) {
      this.add.text(24, VIEW.height - 96, `Issued for this mission, on top of your choice: ${lent.join(', ')}`, { fontFamily: MONO, fontSize: '14px', color: '#e8c060' });
    }
    this.msg = this.add.text(24, VIEW.height - 64, '', { fontFamily: MONO, fontSize: '14px', color: '#ff8060' });
    const by = VIEW.height - 44;
    if (data.deploy) button(this, VIEW.width - 170, by, 280, 50, 'DEPLOY  [ENTER]', () => this.finish(true), 10, 0xc84030);
    button(this, VIEW.width - (data.deploy ? 470 : 170), by, 260, 44, data.deploy ? 'BACK' : 'DONE  [ENTER]', () => this.finish(false), 10, 0x6a7a8a);
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
    add(this.add.text(24, 92, `WEAPONS  ${this.weapons.length}/${LOADOUT_WEAPONS}`, { fontFamily: STENCIL, fontSize: '22px', color: '#e0dcc0' }));
    ownedWeapons(p).forEach((id, i) => {
      const x = 24 + (i % 3) * 410, y = 126 + Math.floor(i / 3) * 112;
      const on = this.weapons.includes(id);
      const def = playerWeapon(p, id);
      const bg = add(this.add.rectangle(x, y, 396, 100, on ? 0x2f3a26 : 0x1e1f1c).setOrigin(0).setStrokeStyle(2, on ? 0x8ae070 : 0x0a0a0a));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleWeapon(id));
      const tex = this.textures.get(def.iconTexture).getSourceImage() as HTMLCanvasElement;
      add(this.add.image(x + 70, y + 50, def.iconTexture).setScale(Math.min(110 / tex.width, 70 / tex.height)));
      add(this.add.text(x + 140, y + 12, def.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '18px', color: '#e0dcc0', wordWrap: { width: 250 } }));
      add(this.add.text(x + 140, y + 44, `DMG ${def.damage.toFixed(0)}${def.pellets ? `×${def.pellets}` : ''} · ${def.fireRate.toFixed(1)}/s · MAG ${def.magazine}`, { fontFamily: MONO, fontSize: '12px', color: '#a8a890' }));
      add(this.add.text(x + 140, y + 70, on ? `CARRIED · KEY ${this.weapons.indexOf(id) + 1}` : 'CLICK TO CARRY', { fontFamily: MONO, fontSize: '12px', color: on ? '#8ae070' : '#7a7a6a' }));
    });

    const sy = 126 + Math.ceil(ownedWeapons(p).length / 3) * 112 + 16;
    add(this.add.text(24, sy, `SUPPORT  ${this.supports.length}/${LOADOUT_SUPPORTS}`, { fontFamily: STENCIL, fontSize: '22px', color: '#e0dcc0' }));
    const owned = ownedSupports(p);
    if (!owned.length) add(this.add.text(24, sy + 34, 'No support strikes yet. Kestrel joins in mission 3.', { fontFamily: MONO, fontSize: '13px', color: '#7a7a6a' }));
    owned.forEach((id, i) => {
      const def = SUPPORT.find((s) => s.id === id)!;
      const x = 24 + i * 410, y = sy + 34;
      const on = this.supports.includes(id);
      const bg = add(this.add.rectangle(x, y, 396, 76, on ? 0x2f3a26 : 0x1e1f1c).setOrigin(0).setStrokeStyle(2, on ? 0x8ae070 : 0x0a0a0a));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleSupport(id));
      add(this.add.image(x + 44, y + 38, def.icon).setScale(1.1));
      add(this.add.text(x + 90, y + 10, `${def.name.toUpperCase()}  [${def.key}]`, { fontFamily: STENCIL, fontSize: '18px', color: '#e0dcc0' }));
      add(this.add.text(x + 90, y + 38, def.description, { fontFamily: MONO, fontSize: '11px', color: '#a8a890', wordWrap: { width: 296 } }));
    });
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
