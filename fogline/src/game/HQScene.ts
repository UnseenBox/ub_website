import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { ENEMIES } from '../data/enemies';
import { MISSIONS, missionById } from '../data/missions';
import {
  CODEX_TIERS, CONTRACT_SET_BONUS, DEPOT_LEVELS, ENDLESS_MILESTONES, ENDLESS_PER_WAVE, ENDLESS_UNLOCK, FIELD_NOTES,
  LOGIN_REWARDS, SURGE_FIRST_WIN, SURGE_MODIFIERS, SURGE_REPLAY, SURGE_UNLOCK,
} from '../data/retention';
import { needsLoadout, playerPower, threatRating } from '../systems/Campaign';
import { profile } from '../systems/Profile';
import {
  ENDLESS_ID, SURGE_ID, buyDepotUpgrade, claimLogin, codexPages, collectDepot, dayKey, depotCap, depotLevel,
  depotStored, depotUpgradeStatus, endlessOpen, hqOpen, loginStatus, metEnemies, msToNextDay, refreshDay, rerollContract,
  surgeMission, surgeModifiers, surgeOpen,
} from '../systems/Retention';
import { weaponById } from '../data/weapons';
import type { Contract } from '../systems/MetaState';
import { WEAPON_ICON, icon, iconWidth, type IconName } from '../ui/icons';
import {
  BODY, C, STENCIL, box, centreRow, chip, css, dashedRect, meter, pushButton, ring, row, text, type Part,
} from '../ui/kit';
import { tagStyle, threatTags } from '../ui/messages';
import { enemyPortrait } from '../ui/portraits';
import { portal } from '../portal/Portal';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';

export type HQTab = 'drop' | 'contracts' | 'depot' | 'surge' | 'endless' | 'notes';

export interface HQData {
  tab?: HQTab;
}

type Add = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

/** The tab column, and the room to the right of it. */
const TAB_X = 28, TAB_W = 148, X0 = 204, W = VIEW.width - X0 - 28, MID = X0 + W / 2;

const hm = (ms: number): string => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

/** The picture inside a contract's ring. */
function contractIcon(c: Contract): IconName {
  switch (c.kind) {
    case 'kills': return 'skull';
    case 'headshots': return 'head';
    case 'enemy': return 'skull';
    case 'weapon': return WEAPON_ICON[c.param!] ?? 'rifle';
    case 'wins': return 'check';
    case 'objective': return c.param === 'protect' ? 'mast' : c.param === 'evacuate' ? 'truck' : c.param === 'nests' ? 'nest' : c.param === 'boss' ? 'skull' : 'shield';
    case 'stars': return 'star';
    case 'supports': return 'heli';
    case 'streak': return 'flame';
    case 'surge': return 'bolt';
    case 'endless': return 'wave';
  }
}

/** A few words under a contract's ring: only what the picture cannot say. */
function contractWords(c: Contract): string {
  switch (c.kind) {
    case 'kills': return 'KILLS';
    case 'headshots': return 'HEADSHOTS';
    case 'enemy': return ENEMIES[c.param!]?.name.toUpperCase() ?? 'ENEMY';
    case 'weapon': return weaponById(c.param!).shortName;
    case 'wins': return 'WINS';
    case 'objective': return `${(c.param ?? '').toUpperCase()} WIN`;
    case 'stars': return 'STARS';
    case 'supports': return 'STRIKES';
    case 'streak': return 'STREAK';
    case 'surge': return 'FOG SURGE';
    case 'endless': return 'LAST STAND';
  }
}

/** Fogline HQ: the daily layer. Supply drop, contracts, depot, Fog Surge, Last Stand, Field Notes. */
export class HQScene extends Phaser.Scene {
  private tab: HQTab = 'drop';
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private msg!: Phaser.GameObjects.Text;
  private noteEnemy = 'shambler';
  /** Things that count down or fill up while the screen is open. */
  private live: (() => void)[] = [];
  private day = '';

  constructor() {
    super('HQ');
  }

  create(data: HQData = {}): void {
    this.input.setDefaultCursor('default');
    const p = profile.get();
    if (!hqOpen(p)) {
      this.scene.start('Map');
      return;
    }
    if (refreshDay(p, Date.now())) profile.save();
    this.day = dayKey(Date.now());
    this.tab = data.tab ?? (loginStatus(p, Date.now()).ready ? 'drop' : this.tab);
    this.dynamic = [];
    backdrop(this, C.night);
    const back = pushButton(this, 0, 46, { h: 48, size: 22, icon: 'back', label: 'MAP', onClick: () => this.scene.start('Map') });
    back.c.x = TAB_X + back.w / 2;
    this.msg = text(this, MID, VIEW.height - 28, '', { size: 22, font: STENCIL, color: C.green }).setOrigin(0.5).setDepth(5);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Map'));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.draw();
  }

  /** Once a second: counters, the depot ring, and a new day at midnight. */
  private tick(): void {
    if (dayKey(Date.now()) !== this.day) {
      this.day = dayKey(Date.now());
      if (refreshDay(profile.get(), Date.now())) profile.save();
      this.draw();
      return;
    }
    for (const fn of this.live) fn();
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.live = [];
    const add: Add = (o) => {
      this.dynamic.push(o);
      return o;
    };
    const p = profile.get();
    const now = Date.now();
    const clock = chip(this, { icon: 'clock', text: hm(msToNextDay(now)), tone: 'gold', size: 20 });
    const crates = chip(this, { icon: 'crate', iconColor: C.brass, text: `${p.supplies}`, size: 20 });
    add(clock.c);
    add(crates.c);
    row([clock, crates], VIEW.width - 28 - clock.w - crates.w - 8, 46);
    const clockText = clock.c.list[clock.c.list.length - 1] as Phaser.GameObjects.Text;
    this.live.push(() => clockText.setText(hm(msToNextDay(Date.now()))));

    // Left: the HQ's rooms, one icon each.
    const login = loginStatus(p, now);
    const tabs: { id: HQTab; icon: IconName; open: boolean; alert: boolean }[] = [
      { id: 'drop', icon: 'crate', open: true, alert: login.ready },
      { id: 'contracts', icon: 'skull', open: true, alert: false },
      { id: 'depot', icon: 'clock', open: true, alert: depotStored(p, now) >= depotCap(p) / 2 },
      { id: 'surge', icon: 'bolt', open: surgeOpen(p), alert: surgeOpen(p) && !p.meta.surge.won },
      { id: 'endless', icon: 'wave', open: endlessOpen(p), alert: false },
      { id: 'notes', icon: 'book', open: true, alert: false },
    ];
    const step = 102, h = 92;
    tabs.forEach((t, i) => {
      const y = 96 + i * step;
      const sel = t.id === this.tab;
      const bg = add(box(this, TAB_X, y, TAB_W, h, C.tile, sel ? C.brass : 0x2a2c24));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        this.tab = t.id;
        this.msg.setText('');
        this.draw();
      });
      add(icon(this, t.open ? t.icon : 'lock', TAB_X + TAB_W / 2, y + h / 2, 52, t.open ? C.iconTone : C.dim));
      if (t.alert) {
        const dot = add(this.add.circle(TAB_X + TAB_W - 18, y + 18, 10, C.dot));
        this.tweens.add({ targets: dot, scale: 1.25, yoyo: true, repeat: -1, duration: 500 });
      }
    });

    switch (this.tab) {
      case 'drop': return this.drawDrop(add);
      case 'contracts': return this.drawContracts(add);
      case 'depot': return this.drawDepot(add);
      case 'surge': return this.drawSurge(add);
      case 'endless': return this.drawEndless(add);
      case 'notes': return this.drawNotes(add);
    }
  }

  /** A title only: the pictures under it say what the room does. */
  private heading(add: Add, title: string): void {
    add(text(this, X0, 92, title, { size: 34, font: STENCIL, color: C.title }));
  }

  private say(message: string, ok = true): void {
    audio.play(ok ? 'buy' : 'deny', { volume: ok ? 0.8 : 0.6 });
    this.msg.setText(message).setColor(css(ok ? C.green : C.red));
  }

  private addAll(add: Add, parts: Part[]): Part[] {
    for (const part of parts) add(part.c);
    return parts;
  }

  // ------------------------------------------------------------ daily drop

  private drawDrop(add: Add): void {
    const p = profile.get();
    const s = loginStatus(p, Date.now());
    this.heading(add, 'DAILY DROP');
    // Days already claimed in this run of the calendar.
    const claimedUpTo = s.ready ? (s.reset ? 0 : s.day - 1) : s.day;
    const gap = 12, w = Math.floor((W - gap * 6) / 7), h = 210, y = 170;
    LOGIN_REWARDS.forEach((r, i) => {
      const day = i + 1;
      const x = X0 + i * (w + gap);
      const claimed = day <= claimedUpTo;
      const today = s.ready && day === s.day;
      add(box(this, x, y, w, h, today ? C.raised : C.card, today ? C.brass : C.line));
      add(text(this, x + w / 2, y + 28, `${day}`, { size: 30, font: STENCIL, color: today ? C.gold : C.soft }).setOrigin(0.5));
      add(icon(this, 'crate', x + w / 2, y + 90, day === 7 ? 70 : 54, claimed ? C.dim : C.brass));
      add(text(this, x + w / 2, y + 152, `+${r.supplies}`, { size: 28, font: STENCIL, color: claimed ? C.dim : C.text }).setOrigin(0.5));
      if (r.skin) add(icon(this, 'rifle', x + w / 2, y + 185, 22, 0xe07060));
      if (claimed) add(icon(this, 'check', x + w / 2, y + 90, 62, C.ok, { stroke: 3 }));
    });
    if (s.ready) {
      add(pushButton(this, MID, 450, {
        w: 320, h: 64, size: 30, icon: 'check', label: 'CLAIM', tone: 'buy',
        onClick: () => {
          let claim: ReturnType<typeof claimLogin> = null;
          profile.update((d) => { claim = claimLogin(d, Date.now()); });
          const c = claim as ReturnType<typeof claimLogin>;
          if (c) this.say(`+${c.supplies} SUPPLIES${c.skin ? ' · CRIMSON SKIN' : ''}`);
          this.draw();
        },
      }).c);
    } else {
      centreRow(this.addAll(add, [chip(this, { icon: 'check', iconColor: C.ok, text: 'CLAIMED', tone: 'green', size: 22 })]), MID, 440);
    }
    if (s.reset && s.ready) centreRow(this.addAll(add, [chip(this, { icon: 'replay', text: 'STREAK RESET', tone: 'red', size: 18 })]), MID, 520);
  }

  // ------------------------------------------------------------ contracts

  private drawContracts(add: Add): void {
    const p = profile.get();
    const d = p.meta.daily;
    this.heading(add, 'CONTRACTS');
    const gap = 20, w = Math.floor((W - gap * 2) / 3), h = 396, y = 150;
    d.contracts.forEach((c, i) => {
      const x = X0 + i * (w + gap), cx = x + w / 2, cy = y + 112;
      add(box(this, x, y, w, h, C.card, c.done ? C.health : C.line));
      const g = add(this.add.graphics());
      ring(g, cx, cy, 84, 16, c.progress / c.target, c.done ? C.health : C.brass);
      if (c.kind === 'enemy' && ENEMIES[c.param!]) {
        const figure = add(enemyPortrait(this, ENEMIES[c.param!], 96, 104));
        figure.setPosition(cx, cy + 52);
      } else {
        const name = contractIcon(c);
        add(icon(this, name, cx, cy, iconWidth(name, 1) > 1 ? 52 : 68, 0xe0d8b8));
      }
      add(text(this, cx, y + 232, `${c.progress} / ${c.target}`, { size: 40, font: STENCIL }).setOrigin(0.5));
      add(text(this, cx, y + 266, contractWords(c), { size: 16, color: C.soft, bold: true, spacing: 1 }).setOrigin(0.5));
      centreRow(this.addAll(add, [chip(this, {
        icon: c.done ? 'check' : 'crate', iconColor: c.done ? C.ok : C.brass, text: `+${c.reward}`, tone: c.done ? 'green' : 'gold', size: 21,
      })]), cx, y + 308);
      if (c.done || (d.rerolled && !portal.rewardReady)) return;
      const ad = d.rerolled;
      add(pushButton(this, cx, y + 362, {
        h: 40, size: 18, icon: 'replay', label: ad ? 'SWAP ▶ AD' : 'SWAP',
        onClick: () => {
          if (ad) {
            portal.rewarded(() => {
              profile.update((pd) => { rerollContract(pd, i, Date.now(), true); });
              this.say('NEW ORDER');
            }, () => this.draw());
            return;
          }
          let ok = false;
          profile.update((pd) => { ok = rerollContract(pd, i, Date.now()); });
          if (ok) this.say('NEW ORDER');
          this.draw();
        },
      }).c);
    });
    // Three ticks make the bonus.
    const by = y + h + 18, bh = 58;
    const g = add(this.add.graphics());
    dashedRect(g, X0, by, W, bh, d.bonusPaid ? C.health : C.lineReward);
    const done = d.contracts.filter((c) => c.done).length;
    for (let i = 0; i < 3; i++) add(icon(this, 'check', MID - 128 + i * 40, by + bh / 2, 32, i < done ? C.ok : C.lineReward, { stroke: 2.8 }));
    add(text(this, MID + 6, by + bh / 2, '=', { size: 28, color: C.brass, bold: true }).setOrigin(0.5));
    add(icon(this, 'crate', MID + 46, by + bh / 2, 32, C.brass));
    add(text(this, MID + 72, by + bh / 2, `+${CONTRACT_SET_BONUS}`, { size: 26, color: d.bonusPaid ? C.green : C.brass, bold: true }).setOrigin(0, 0.5));
  }

  // ------------------------------------------------------------ depot

  private drawDepot(add: Add): void {
    const p = profile.get();
    const lv = depotLevel(p);
    this.heading(add, 'SUPPLY DEPOT');
    const cx = X0 + 220, cy = 300;
    const g = add(this.add.graphics());
    add(icon(this, 'crate', cx, cy - 34, 66, C.brass));
    const stored = add(text(this, cx, cy + 36, '', { size: 38, font: STENCIL }).setOrigin(0.5));
    const update = (): void => {
      const q = profile.get();
      const have = depotStored(q, Date.now()), cap = depotCap(q);
      if (!stored.active) return;
      stored.setText(`${have} / ${cap}`);
      g.clear();
      ring(g, cx, cy, 140, 22, have / cap, have >= cap ? C.health : C.brass);
    };
    update();
    this.live.push(update);
    const rate = chip(this, { icon: 'bolt', text: `${lv.rate}/h`, tone: 'gold', size: 20 });
    add(rate.c);
    const eta = (): string => {
      const q = profile.get();
      const left = depotCap(q) - depotStored(q, Date.now());
      return left <= 0 ? 'FULL' : hm((left / depotLevel(q).rate) * 3_600_000);
    };
    const etaChip = chip(this, { icon: 'clock', text: eta(), size: 20 });
    add(etaChip.c);
    const etaText = etaChip.c.list[etaChip.c.list.length - 1] as Phaser.GameObjects.Text;
    this.live.push(() => { if (etaText.active) etaText.setText(eta()); });
    centreRow([rate, etaChip], cx, 478);
    add(pushButton(this, cx, 550, {
      w: 280, h: 60, size: 28, icon: 'crate', iconColor: C.brass, label: 'COLLECT', tone: 'buy',
      onClick: () => {
        let got = 0;
        profile.update((d) => { got = collectDepot(d, Date.now()); });
        if (got > 0) this.say(`+${got} SUPPLIES`);
        else this.say('NOTHING YET', false);
        this.draw();
      },
    }).c);

    // Expanding the depot.
    const ux = X0 + 480, uw = W - 480, uy = 160, uh = 280;
    add(box(this, ux, uy, uw, uh, C.card, C.line));
    add(icon(this, 'wrench', ux + uw / 2, uy + 54, 56, C.iconTone));
    const pips = add(this.add.graphics());
    DEPOT_LEVELS.forEach((_, i) => {
      pips.fillStyle(i < p.meta.depot.level ? C.brass : 0x3a3c32, 1).fillRect(ux + uw / 2 - (DEPOT_LEVELS.length * 30 - 8) / 2 + i * 30, uy + 100, 22, 14);
    });
    const { cost, status } = depotUpgradeStatus(p);
    if (status === 'maxed' || cost === null) {
      centreRow(this.addAll(add, [chip(this, { icon: 'check', iconColor: C.ok, text: 'MAX', tone: 'green', size: 22 })]), ux + uw / 2, uy + 170);
      return;
    }
    const next = DEPOT_LEVELS[p.meta.depot.level];
    centreRow(this.addAll(add, [
      chip(this, { icon: 'bolt', text: `${next.rate}/h`, tone: 'green', size: 20 }),
      chip(this, { icon: 'crate', text: `${next.rate * next.capHours}`, tone: 'green', size: 20 }),
    ]), ux + uw / 2, uy + 160);
    const ok = status === 'ok';
    add(pushButton(this, ux + uw / 2, uy + 224, {
      w: 240, h: 56, size: 28, icon: 'crate', iconColor: ok ? C.brass : C.dim, label: `${cost}`, tone: ok ? 'buy' : 'off',
      onClick: () => {
        let r = '';
        profile.update((d) => { r = buyDepotUpgrade(d, Date.now()); });
        if (r === 'ok') this.say(`DEPOT LEVEL ${profile.get().meta.depot.level}`);
        else this.say('NOT ENOUGH SUPPLIES', false);
        this.draw();
      },
    }).c);
  }

  // ------------------------------------------------------------ fog surge

  /** A room that is not open yet: a padlock and the mission that opens it. */
  private drawLocked(add: Add, mission: string): void {
    add(icon(this, 'lock', MID, 300, 150, C.dim));
    centreRow(this.addAll(add, [chip(this, { icon: 'check', text: `WIN ${mission.toUpperCase()}`, tone: 'gold', size: 24 })]), MID, 430);
  }

  private drawSurge(add: Add): void {
    const p = profile.get();
    if (!surgeOpen(p)) {
      this.heading(add, 'FOG SURGE');
      this.drawLocked(add, missionById(SURGE_UNLOCK)!.name);
      return;
    }
    const m = surgeMission(p, this.day);
    const mods = surgeModifiers(this.day);
    const s = p.meta.surge;
    this.heading(add, `FOG SURGE · ${m.name.toUpperCase()}`);
    const gap = 20, w = Math.floor((W - gap) / 2);
    const MOD_ICON: Record<string, IconName> = { night: 'eye', drops: 'crate', horde: 'skull', fast: 'fast', armoured: 'shield', bounty: 'cash', glass: 'shutters' };
    mods.forEach((id, i) => {
      const x = X0 + i * (w + gap), y = 150;
      add(box(this, x, y, w, 130, C.goFill, C.goLine));
      add(icon(this, MOD_ICON[id] ?? 'bolt', x + 62, y + 65, 66, C.red));
      add(text(this, x + 118, y + 30, SURGE_MODIFIERS[id].name, { size: 30, font: STENCIL }));
      add(text(this, x + 118, y + 76, SURGE_MODIFIERS[id].text, { size: 17, font: BODY, color: C.soft, wrap: w - 134 }));
    });
    this.drawGauge(add, playerPower(p), m.threat, 314);
    centreRow(this.addAll(add, [
      chip(this, { icon: 'wave', text: `${m.waves.length}`, size: 22 }),
      chip(this, s.won
        ? { icon: 'check', iconColor: C.ok, text: `+${SURGE_REPLAY}`, tone: 'green', size: 22 }
        : { icon: 'crate', iconColor: C.brass, text: `+${SURGE_FIRST_WIN}`, tone: 'gold', size: 22 }),
      chip(this, { icon: 'star', text: s.best.toLocaleString('en-US'), tone: 'gold', size: 22 }),
    ]), MID, 424, 12);
    this.deployButtons(add, SURGE_ID, 520);
  }

  private drawGauge(add: Add, power: number, threat: number, y: number): void {
    const w = 560, x = MID - w / 2;
    const rating = threatRating(power, threat);
    const max = Math.max(power, threat) * 1.25;
    const g = add(this.add.graphics());
    meter(g, x, y + 8, w, 20, power / max, rating === 'ready' ? C.health : rating === 'risky' ? 0xe0b040 : C.goLine);
    g.fillStyle(0xff7a5a, 1).fillRect(x + w * (threat / max) - 2, y, 5, 36);
    add(text(this, x, y + 36, `POWER ${power}`, { size: 18, color: 0xc8c2a6, bold: true }));
    add(text(this, x + w, y + 36, `${threat}`, { size: 18, color: 0xff7a5a, bold: true }).setOrigin(1, 0));
  }

  // ------------------------------------------------------------ last stand

  private drawEndless(add: Add): void {
    const p = profile.get();
    this.heading(add, 'LAST STAND');
    if (!endlessOpen(p)) {
      this.drawLocked(add, missionById(ENDLESS_UNLOCK)!.name);
      return;
    }
    const e = p.meta.endless;
    add(icon(this, 'wave', MID - 130, 200, 80, C.brass));
    add(text(this, MID - 70, 200, `BEST ${e.best}`, { size: 62, font: STENCIL, color: C.star }).setOrigin(0, 0.5));
    const gap = 12, n = ENDLESS_MILESTONES.length, w = Math.floor((W - gap * (n - 1)) / n), y = 268;
    ENDLESS_MILESTONES.forEach((ms, i) => {
      const x = X0 + i * (w + gap);
      const got = e.milestones.includes(ms.wave);
      add(box(this, x, y, w, 132, got ? C.buyFill : C.raised, got ? C.buyLine : C.lineReward));
      add(text(this, x + w / 2, y + 28, `${ms.wave}`, { size: 34, font: STENCIL, color: got ? C.green : C.text }).setOrigin(0.5));
      add(icon(this, got ? 'check' : 'crate', x + w / 2, y + 70, 34, got ? C.ok : C.brass));
      add(text(this, x + w / 2, y + 110, `+${ms.supplies}`, { size: 20, font: STENCIL, color: got ? C.green : C.soft }).setOrigin(0.5));
    });
    centreRow(this.addAll(add, [
      chip(this, { icon: 'wave', text: '+1', size: 20 }),
      chip(this, { icon: 'crate', iconColor: C.brass, text: `+${ENDLESS_PER_WAVE}`, tone: 'gold', size: 20 }),
    ]), MID, 444, 10);
    this.deployButtons(add, ENDLESS_ID, 530);
  }

  private deployButtons(add: Add, missionId: string, y: number): void {
    const loadout = needsLoadout(profile.get());
    const go = add(pushButton(this, 0, y, {
      w: 320, h: 64, size: 31, icon: 'play', label: 'DEPLOY', tone: 'go',
      onClick: () => {
        audio.play('radio', { volume: 0.6 });
        if (loadout) this.scene.start('Loadout', { missionId, deploy: true });
        else this.scene.start('Game', { missionId });
      },
    }).c);
    go.x = loadout ? MID - 110 : MID;
    if (loadout) {
      add(pushButton(this, MID + 170, y, {
        w: 200, h: 64, size: 26, icon: 'carbine', label: 'LOADOUT', onClick: () => this.scene.start('Loadout', { missionId, deploy: false }),
      }).c);
    }
  }

  // ------------------------------------------------------------ field notes

  private drawNotes(add: Add): void {
    const p = profile.get();
    const met = metEnemies(p);
    // Campaign order: the order the player meets them in.
    const order: string[] = [];
    for (const m of MISSIONS) {
      for (const w of m.waves) for (const g of w.groups) if (!order.includes(g.enemy)) order.push(g.enemy);
      if (m.objective.kind === 'boss' && !order.includes(m.objective.enemy)) order.push(m.objective.enemy);
    }
    for (const id of Object.keys(ENEMIES)) if (!order.includes(id)) order.push(id);
    if (!met.has(this.noteEnemy)) this.noteEnemy = order.find((id) => met.has(id)) ?? 'shambler';

    this.heading(add, 'FIELD NOTES');
    // Each tier of kills opens a page and pays.
    row(this.addAll(add, CODEX_TIERS.map((t) => chip(this, { icon: 'skull', text: `${t.kills} → +${t.supplies}`, tone: 'muted', size: 15 }))), X0 + 250, 112);

    const cols = 6, gap = 8, w = Math.floor((W - gap * (cols - 1)) / cols);
    const rows = Math.ceil(order.length / cols);
    const h = Math.min(96, Math.floor(300 / rows) - gap);
    order.forEach((id, i) => {
      const x = X0 + (i % cols) * (w + gap);
      const y = 142 + Math.floor(i / cols) * (h + gap);
      const known = met.has(id);
      const sel = id === this.noteEnemy;
      const bg = add(box(this, x, y, w, h, C.card, sel ? C.brass : C.line));
      if (!known) {
        add(icon(this, 'lock', x + w / 2, y + h / 2, 32, C.dim));
        return;
      }
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        this.noteEnemy = id;
        this.draw();
      });
      const figure = add(enemyPortrait(this, ENEMIES[id], 60, h - 14));
      figure.setPosition(x + 40, y + h - 7);
      const pages = codexPages(p, id);
      const g = add(this.add.graphics());
      for (let k = 0; k < CODEX_TIERS.length; k++) g.fillStyle(k < pages ? C.brass : 0x3a3c32, 1).fillRect(x + w - 62 + k * 19, y + h / 2 - 20, 14, 18);
      add(text(this, x + w - 12, y + h / 2 + 18, `${p.meta.codex[id] ?? 0}`, { size: 18, color: C.soft, bold: true }).setOrigin(1, 0.5));
    });

    // The open page: the enemy, its traits and what is known so far.
    const id = this.noteEnemy;
    const e = ENEMIES[id];
    const pages = codexPages(p, id);
    const y0 = 142 + rows * (h + gap) + 6, bottom = VIEW.height - 14;
    add(box(this, X0, y0, W, bottom - y0, C.tile, C.lineReward));
    const figure = add(enemyPortrait(this, e, 150, bottom - y0 - 30));
    figure.setPosition(X0 + 88, bottom - 14);
    const name = add(text(this, X0 + 180, y0 + 10, e.name.toUpperCase(), { size: 30, font: STENCIL, color: C.gold }));
    row(this.addAll(add, threatTags(e).map((tag) => {
      const t = tagStyle(tag);
      return chip(this, { icon: t.icon, text: tag, tone: t.tone, size: 15 });
    })), X0 + 196 + name.width, y0 + 30);
    const notes = [e.intel ?? e.description, FIELD_NOTES[id]?.tactic ?? '', FIELD_NOTES[id]?.lore ?? ''];
    let ny = y0 + 56;
    notes.forEach((note, k) => {
      const open = k < pages;
      add(icon(this, open ? 'book' : 'lock', X0 + 192, ny + 11, 20, open ? C.brass : C.dim));
      const line = add(text(this, X0 + 212, ny, open ? note : `${CODEX_TIERS[k].kills} kills`, { size: 16, font: BODY, color: open ? 0xd8d4bc : C.dim, wrap: W - 232 }));
      ny += line.height + 6;
    });
  }
}

/** Shown on the map once a day: today's drop, claimed in one click. */
export function showDailyDrop(scene: Phaser.Scene, onDone: () => void): Phaser.GameObjects.Container | null {
  const p = profile.get();
  const now = Date.now();
  if (!hqOpen(p)) return null;
  const s = loginStatus(p, now);
  if (!s.ready) return null;
  const W = 420, H = 340;
  const cx = VIEW.centerX, cy = VIEW.height / 2;
  const parts: Phaser.GameObjects.GameObject[] = [];
  parts.push(backdrop(scene, 0x000000, 0.65).setInteractive());
  parts.push(scene.add.rectangle(cx, cy, W, H, C.chip, 0.97).setStrokeStyle(2, C.brass));
  parts.push(text(scene, cx, cy - H / 2 + 38, 'DAILY DROP', { size: 36, font: STENCIL }).setOrigin(0.5));
  const days = scene.add.graphics();
  LOGIN_REWARDS.forEach((_, i) => {
    const x = cx - (LOGIN_REWARDS.length * 30 - 10) / 2 + i * 30;
    days.fillStyle(i + 1 < s.day ? C.brass : i + 1 === s.day ? C.gold : 0x3a3c32, 1).fillRect(x, cy - H / 2 + 72, 20, 10);
  });
  parts.push(days);
  const crate = icon(scene, 'crate', cx, cy - 20, 110, C.brass);
  parts.push(crate);
  scene.tweens.add({ targets: crate, y: cy - 28, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
  parts.push(text(scene, cx, cy + 62, `+${s.reward.supplies}${s.reward.skin ? '  + SKIN' : ''}`, { size: 38, font: STENCIL, color: C.cash }).setOrigin(0.5));
  const holder = scene.add.container(0, 0, parts).setDepth(60);
  const claim = (): void => {
    profile.update((d) => { claimLogin(d, Date.now()); });
    audio.play('buy', { volume: 0.8 });
    holder.destroy();
    onDone();
  };
  holder.add(pushButton(scene, cx, cy + H / 2 - 46, { w: 260, h: 56, size: 28, icon: 'check', label: 'CLAIM', tone: 'buy', onClick: claim }).c);
  scene.input.keyboard!.once('keydown-ENTER', () => { if (holder.active) claim(); });
  return holder;
}
