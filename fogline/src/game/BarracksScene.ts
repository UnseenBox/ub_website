import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { MISSIONS } from '../data/missions';
import { MAX_RECRUIT_LEVEL, RECRUITS, RecruitDef, RecruitRole, SQUAD_SLOTS, recruitInterval, recruitPower } from '../data/squad';
import { playerPower, recruitTrainStatus, toggleSquad, trainRecruit } from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { icon, type IconName } from '../ui/icons';
import { C, STENCIL, box, chip, css, meter, portraitTexture, pushButton, row, text, type Part } from '../ui/kit';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';

const ROLE_ICON: Record<RecruitRole, IconName> = {
  engineer: 'wrench', sniper: 'head', gunner: 'bullet', pilot: 'heli', grenadier: 'blast', mortar: 'orbital',
};

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
    backdrop(this, C.night);
    const back = pushButton(this, 0, 46, { h: 48, size: 22, icon: 'back', label: 'MAP', onClick: () => this.scene.start('Map') });
    back.c.x = 28 + back.w / 2;
    text(this, 28 + back.w + 20, 46, 'BARRACKS', { size: 34, font: STENCIL, color: C.title }).setOrigin(0, 0.5);
    this.msg = text(this, VIEW.centerX, VIEW.height - 28, '', { size: 22, font: STENCIL, color: C.green }).setOrigin(0.5);
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
    const totals: Part[] = [
      chip(this, { icon: 'people', text: `${p.squad.length}/${SQUAD_SLOTS}`, size: 20 }),
      chip(this, { icon: 'bolt', text: `${playerPower(p)}`, tone: 'gold', size: 20 }),
      chip(this, { icon: 'crate', iconColor: C.brass, text: `${p.supplies}`, size: 20 }),
    ];
    for (const t of totals) add(t.c);
    row(totals, VIEW.width - 28 - totals.reduce((n, t) => n + t.w + 8, -8), 46);

    // Cards share the width: three across in Act 2, more once the whole squad exists.
    const gap = 12;
    const cw = Math.floor((VIEW.width - 56 - (RECRUITS.length - 1) * gap) / RECRUITS.length);
    RECRUITS.forEach((r, i) => {
      const x = 28 + i * (cw + gap), y = 96, mid = x + cw / 2, h = 568;
      const owned = p.recruits.includes(r.id);
      const posted = p.squad.includes(r.id);
      add(box(this, x, y, cw, h, C.card, posted ? C.health : C.line));
      if (!owned) {
        add(icon(this, 'lock', mid, y + 170, 70, C.dim));
        const m = MISSIONS.find((ms) => ms.firstClear.recruits?.includes(r.id));
        const need = add(text(this, mid, y + 260, m ? `WIN ${m.name.toUpperCase()}` : 'NOT MET YET', { size: 15, color: C.gold, bold: true, align: 'center', wrap: cw - 20 }).setOrigin(0.5));
        need.setAlign('center');
        add(icon(this, ROLE_ICON[r.role], mid, y + 330, 38, C.dim));
        return;
      }
      const first = r.name.split(' ')[0].toUpperCase();
      add(this.add.image(mid, y + 66, portraitTexture(this, first, 100)).setScale(0.5));
      const name = add(text(this, mid, y + 140, first, { size: 30, font: STENCIL }).setOrigin(0.5));
      if (name.width > cw - 16) name.setScale((cw - 16) / name.width);
      add(icon(this, ROLE_ICON[r.role], mid, y + 190, 44, C.brass));
      add(text(this, mid, y + 228, r.role.toUpperCase(), { size: 13, color: C.soft, bold: true, spacing: 1 }).setOrigin(0.5));

      const level = p.recruitLevels[r.id] ?? 1;
      const g = add(this.add.graphics());
      statBars(r, level).forEach((bar, k) => {
        const by = y + 264 + k * 38;
        add(icon(this, bar.icon, x + 24, by, 24, C.iconTone));
        meter(g, x + 44, by - 7, cw - 62, 14, bar.frac, C.brass);
        add(text(this, x + cw - 18, by + 8, bar.value, { size: 12, color: C.soft, bold: true }).setOrigin(1, 0));
      });
      const step = Math.min(30, (cw - 36) / MAX_RECRUIT_LEVEL);
      for (let k = 0; k < MAX_RECRUIT_LEVEL; k++) {
        g.fillStyle(k < level ? C.brass : 0x3a3c32, 1).fillRect(mid - (MAX_RECRUIT_LEVEL * step) / 2 + k * step + 3, y + 390, step - 6, 12);
      }
      const bw = Math.min(260, cw - 24);
      const { cost, status } = recruitTrainStatus(p, r.id);
      if (status === 'maxed' || cost === null) {
        add(icon(this, 'check', mid - 34, y + 452, 30, C.ok, { stroke: 2.6 }));
        add(text(this, mid + 14, y + 452, 'MAX', { size: 26, font: STENCIL, color: C.ok }).setOrigin(0.5));
      } else {
        const ok = status === 'ok';
        add(pushButton(this, mid, y + 452, {
          w: bw, h: 48, size: 24, icon: 'crate', iconColor: ok ? C.brass : C.dim, label: `${cost}`, tone: ok ? 'buy' : 'off', onClick: () => this.train(r.id),
        }).c);
      }
      add(pushButton(this, mid, y + 520, {
        w: bw, h: 48, size: 22, icon: posted ? 'check' : 'plus', iconColor: posted ? C.ok : C.text, label: posted ? 'POSTED' : 'POST',
        tone: posted ? 'brass' : 'plain', onClick: () => this.toggle(r.id),
      }).c);
    });
  }

  private train(id: string): void {
    let result = '';
    profile.update((d) => { result = trainRecruit(d, id); });
    if (result === 'ok') {
      audio.play('buy', { volume: 0.8 });
      this.msg.setText('TRAINING COMPLETE').setColor(css(C.green));
    } else {
      audio.play('deny', { volume: 0.6 });
      this.msg.setText(result === 'supplies' ? 'NOT ENOUGH SUPPLIES' : 'CANNOT TRAIN').setColor(css(C.red));
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
      this.msg.setText(`ONLY ${SQUAD_SLOTS} WINDOWS`).setColor(css(C.red));
    }
    this.draw();
  }
}

/** Up to three bars for a recruit: how hard, how often and how far. */
function statBars(r: RecruitDef, level: number): { icon: IconName; frac: number; value: string }[] {
  const power = recruitPower(r, level);
  // The engineer mends instead of shooting.
  if (r.role === 'engineer') return [{ icon: 'wrench', frac: power / recruitPower(r, MAX_RECRUIT_LEVEL), value: `+${power.toFixed(1)}/s` }];
  const every = recruitInterval(r, level);
  const shooters = RECRUITS.filter((o) => o.role !== 'engineer');
  const most = Math.max(...shooters.map((o) => recruitPower(o, MAX_RECRUIT_LEVEL)));
  const quickest = Math.min(...shooters.map((o) => recruitInterval(o, MAX_RECRUIT_LEVEL)));
  const farthest = Math.max(...shooters.map((o) => o.range));
  const bars: { icon: IconName; frac: number; value: string }[] = [
    { icon: 'skull', frac: Math.sqrt(power / most), value: `${Math.round(power)}` },
    { icon: 'clock', frac: Math.sqrt(quickest / every), value: `${every.toFixed(1)}s` },
  ];
  if (r.range > 0) bars.push({ icon: 'head', frac: r.range / farthest, value: `${r.range} m` });
  return bars;
}
