import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { MISSIONS } from '../data/missions';
import { MAX_RECRUIT_LEVEL, RECRUITS, RecruitDef, SQUAD_SLOTS, recruitInterval, recruitPower } from '../data/squad';
import { playerPower, recruitTrainStatus, toggleSquad, trainRecruit } from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';

/** The Barracks: train the squad with Supplies and post two of them at the side windows. */
export class BarracksScene extends Phaser.Scene {
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private msg!: Phaser.GameObjects.Text;

  constructor() {
    super('Barracks');
  }

  create(): void {
    this.input.setDefaultCursor('default');
    this.dynamic = [];
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x121310).setOrigin(0);
    this.add.rectangle(0, 0, VIEW.width, 70, 0x1c1d1a).setOrigin(0);
    this.add.rectangle(0, 70, VIEW.width, 3, 0x7a6420).setOrigin(0);
    this.add.text(24, 16, 'BARRACKS', { fontFamily: STENCIL, fontSize: '36px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 });
    this.add.text(220, 32, `THE SQUAD · ${SQUAD_SLOTS} side windows`, { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' });
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
    add(this.add.text(VIEW.width - 24, 48, `POWER ${playerPower(p)}  ·  POSTED ${p.squad.length}/${SQUAD_SLOTS}`, { fontFamily: MONO, fontSize: '13px', color: '#e8c060' }).setOrigin(1, 0));

    // Cards share the width: three across in Act 2, five once the whole squad exists.
    const cw = Math.floor((VIEW.width - 48 - (RECRUITS.length - 1) * 12) / RECRUITS.length);
    const inner = cw - 36;
    RECRUITS.forEach((r, i) => {
      const x = 24 + i * (cw + 12), y = 100;
      const owned = p.recruits.includes(r.id);
      const posted = p.squad.includes(r.id);
      add(this.add.rectangle(x, y, cw, 520, posted ? 0x26301e : 0x1e1f1c).setOrigin(0).setStrokeStyle(2, posted ? 0x8ae070 : 0x0a0a0a));
      add(this.add.image(x + cw / 2, y + 190, 'squad_soldier').setOrigin(0.5, 1).setScale(Math.min(1.1, cw / 200)).setAlpha(owned ? 1 : 0.25).setTint(owned ? 0xffffff : 0x333333));
      add(this.add.text(x + 18, y + 204, owned ? r.name.toUpperCase() : '???', { fontFamily: STENCIL, fontSize: cw < 300 ? '21px' : '26px', color: '#e8e0c0' }));
      add(this.add.text(x + 18, y + 238, r.role.toUpperCase(), { fontFamily: MONO, fontSize: '13px', color: '#c8a050' }));
      add(this.add.text(x + 18, y + 262, r.description, { fontFamily: MONO, fontSize: '13px', color: '#a8a890', wordWrap: { width: inner } }));
      if (!owned) {
        const m = MISSIONS.find((ms) => ms.firstClear.recruits?.includes(r.id));
        add(this.add.text(x + 18, y + 330, m ? `Joins when you win\nAct ${m.act} · ${m.name}` : 'Not met yet', { fontFamily: MONO, fontSize: '14px', color: '#e8c060', lineSpacing: 4 }));
        return;
      }
      const level = p.recruitLevels[r.id] ?? 1;
      for (let k = 0; k < MAX_RECRUIT_LEVEL; k++) {
        const step = Math.min(34, (inner - 60) / MAX_RECRUIT_LEVEL);
        add(this.add.rectangle(x + 18 + k * step, y + 334, Math.min(22, step - 3), 22, k < level ? 0xc8a040 : 0x2c2d2a).setOrigin(0).setStrokeStyle(1, 0x000000));
      }
      add(this.add.text(x + cw - 18, y + 336, `LV ${level}`, { fontFamily: MONO, fontSize: '14px', color: '#e0dcc0' }).setOrigin(1, 0));
      add(this.add.text(x + 18, y + 368, statsLine(r, level), { fontFamily: MONO, fontSize: '13px', color: '#c8d890', wordWrap: { width: inner } }));
      const { cost, status } = recruitTrainStatus(p, r.id);
      if (status === 'maxed' || cost === null) {
        add(this.add.text(x + cw / 2, y + 446, 'FULLY TRAINED', { fontFamily: STENCIL, fontSize: '20px', color: '#8ae070' }).setOrigin(0.5));
      } else {
        const b = add(button(this, x + cw / 2, y + 446, Math.min(300, cw - 24), 42, `TRAIN  ${cost}`, () => this.train(r.id), 10, status === 'ok' ? 0x5fae3c : 0x6a4a40));
        if (status !== 'ok') b.setAlpha(0.6);
      }
      add(button(this, x + cw / 2, y + 494, Math.min(300, cw - 24), 40, posted ? 'STAND DOWN' : cw < 300 ? 'POST' : 'POST AT A WINDOW', () => this.toggle(r.id), 10, posted ? 0x8a6a40 : 0x6a7a8a));
    });
  }

  private train(id: string): void {
    let result = '';
    profile.update((d) => { result = trainRecruit(d, id); });
    if (result === 'ok') {
      audio.play('buy', { volume: 0.8 });
      this.msg.setText('TRAINING COMPLETE').setColor('#a8e090');
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES' : 'CANNOT TRAIN').setColor('#ff7050');
    }
    this.draw();
  }

  private toggle(id: string): void {
    let ok = false;
    profile.update((d) => { ok = toggleSquad(d, id); });
    if (ok) {
      audio.play('ui_click', { volume: 0.7 });
      this.msg.setText('');
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(`ONLY ${SQUAD_SLOTS} WINDOWS: STAND SOMEONE DOWN FIRST`).setColor('#ff7050');
    }
    this.draw();
  }
}

function statsLine(r: RecruitDef, level: number): string {
  const power = recruitPower(r, level);
  if (r.role === 'engineer') return `Repairs ${power.toFixed(1)} bunker health per second during waves`;
  if (r.role === 'pilot') return `Strafing run every ${recruitInterval(r, level).toFixed(0)}s · ${Math.round(power)} per body`;
  if (r.role === 'mortar') return `Shell every ${recruitInterval(r, level).toFixed(0)}s · ${Math.round(power)} blast, far field only`;
  if (r.role === 'grenadier') return `Grenade every ${recruitInterval(r, level).toFixed(1)}s · ${Math.round(power)} blast`;
  return `${Math.round(power)} damage every ${recruitInterval(r, level).toFixed(2)}s · reach ${r.range} m`;
}
