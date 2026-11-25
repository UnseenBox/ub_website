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
  ENDLESS_ID, SURGE_ID, buyDepotUpgrade, claimLogin, codexPages, collectDepot, contractText, dayKey, depotCap, depotLevel,
  depotStored, depotUpgradeStatus, endlessOpen, hqOpen, loginStatus, metEnemies, msToNextDay, refreshDay, rerollContract,
  surgeMission, surgeModifiers, surgeOpen,
} from '../systems/Retention';
import { MONO, STENCIL, button } from '../ui/widgets';
import { portal } from '../portal/Portal';
import { VIEW } from './config';

export type HQTab = 'drop' | 'contracts' | 'depot' | 'surge' | 'endless' | 'notes';

export interface HQData {
  tab?: HQTab;
}

type Add = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

const X0 = 390;
const GREEN = '#a8e090';
const GOLD = '#e8c060';
const DIM = '#7a7a6c';

const hm = (ms: number): string => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

/** Fogline HQ: the daily layer. Supply drop, contracts, depot, Fog Surge, Last Stand, Field Notes. */
export class HQScene extends Phaser.Scene {
  private tab: HQTab = 'drop';
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private msg!: Phaser.GameObjects.Text;
  private noteEnemy = 'shambler';
  /** Text that counts down or fills up while the screen is open. */
  private live: { text: Phaser.GameObjects.Text; fn: () => string }[] = [];
  private depotFill: Phaser.GameObjects.Rectangle | null = null;
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
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x121310).setOrigin(0);
    this.add.rectangle(0, 0, VIEW.width, 70, 0x1c1d1a).setOrigin(0);
    this.add.rectangle(0, 70, VIEW.width, 3, 0x7a6420).setOrigin(0);
    this.add.text(24, 16, 'HQ', { fontFamily: STENCIL, fontSize: '36px', color: '#e0dcc0', stroke: '#000', strokeThickness: 4 });
    this.add.text(84, 32, 'FOGLINE COMMAND · daily orders and stores', { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' });
    this.msg = this.add.text(VIEW.centerX - 100, VIEW.height - 40, '', { fontFamily: STENCIL, fontSize: '20px', color: GREEN, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    button(this, VIEW.width - 170, VIEW.height - 40, 280, 44, 'BACK TO MAP  [ESC]', () => this.scene.start('Map'), 10, 0x6a7a8a);
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('Map'));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.draw();
  }

  /** Once a second: counters, the depot bar, and a new day at midnight. */
  private tick(): void {
    if (dayKey(Date.now()) !== this.day) {
      this.day = dayKey(Date.now());
      if (refreshDay(profile.get(), Date.now())) profile.save();
      this.draw();
      return;
    }
    for (const l of this.live) if (l.text.active) l.text.setText(l.fn());
    if (this.depotFill?.active) {
      const p = profile.get();
      this.depotFill.width = 600 * (depotStored(p, Date.now()) / depotCap(p));
    }
  }

  private draw(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.live = [];
    this.depotFill = null;
    const add: Add = (o) => {
      this.dynamic.push(o);
      return o;
    };
    const p = profile.get();
    const now = Date.now();
    add(this.add.text(VIEW.width - 24, 14, `SUPPLIES ${p.supplies}`, { fontFamily: STENCIL, fontSize: '30px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setOrigin(1, 0));
    const reset = add(this.add.text(VIEW.width - 24, 48, '', { fontFamily: MONO, fontSize: '13px', color: GOLD }).setOrigin(1, 0));
    this.liveText(reset, () => `NEW ORDERS IN ${hm(msToNextDay(Date.now()))}`);

    // Left: the HQ's rooms.
    const login = loginStatus(p, now);
    const contracts = p.meta.daily.contracts;
    const tabs: { id: HQTab; name: string; note: string; open: boolean; alert: boolean }[] = [
      { id: 'drop', name: 'DAILY DROP', note: login.ready ? `DAY ${login.day} READY` : `DAY ${login.day} CLAIMED`, open: true, alert: login.ready },
      { id: 'contracts', name: 'CONTRACTS', note: `${contracts.filter((c) => c.done).length} / ${contracts.length} DONE`, open: true, alert: false },
      { id: 'depot', name: 'SUPPLY DEPOT', note: `${depotStored(p, now)} / ${depotCap(p)} STORED`, open: true, alert: depotStored(p, now) >= depotCap(p) / 2 },
      { id: 'surge', name: 'FOG SURGE', note: surgeOpen(p) ? (p.meta.surge.won ? 'WON TODAY' : "TODAY'S CHALLENGE") : `WIN MISSION ${missionById(SURGE_UNLOCK)!.number}`, open: surgeOpen(p), alert: surgeOpen(p) && !p.meta.surge.won },
      { id: 'endless', name: 'LAST STAND', note: endlessOpen(p) ? `BEST WAVE ${p.meta.endless.best}` : 'FINISH ACT 1', open: endlessOpen(p), alert: false },
      { id: 'notes', name: 'FIELD NOTES', note: `${Object.keys(ENEMIES).filter((id) => codexPages(p, id) > 0).length} / ${Object.keys(ENEMIES).length} STUDIED`, open: true, alert: false },
    ];
    tabs.forEach((t, i) => {
      const y = 96 + i * 82;
      const sel = t.id === this.tab;
      const bg = add(this.add.rectangle(24, y, 330, 72, sel ? 0x34362c : 0x1e1f1c).setOrigin(0).setStrokeStyle(2, sel ? 0xc8a040 : 0x0a0a0a));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        audio.play('ui_click', { volume: 0.6 });
        this.tab = t.id;
        this.msg.setText('');
        this.draw();
      });
      add(this.add.text(44, y + 12, t.name, { fontFamily: STENCIL, fontSize: '22px', color: t.open ? '#e0dcc0' : DIM }));
      add(this.add.text(44, y + 44, t.open ? t.note : `LOCKED · ${t.note}`, { fontFamily: MONO, fontSize: '13px', color: t.alert ? GREEN : '#a8a890' }));
      if (t.alert) {
        const dot = add(this.add.circle(334, y + 20, 7, 0xd84030).setStrokeStyle(2, 0x000000));
        this.tweens.add({ targets: dot, scale: 1.3, yoyo: true, repeat: -1, duration: 500 });
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

  private liveText(text: Phaser.GameObjects.Text, fn: () => string): void {
    text.setText(fn());
    this.live.push({ text, fn });
  }

  private heading(add: Add, title: string, body: string): void {
    add(this.add.text(X0, 96, title, { fontFamily: STENCIL, fontSize: '30px', color: '#e8e0c0' }));
    add(this.add.text(X0, 136, body, { fontFamily: MONO, fontSize: '14px', color: '#9a9a86', wordWrap: { width: 860 }, lineSpacing: 3 }));
  }

  private say(text: string, ok = true): void {
    audio.play(ok ? 'buy' : 'deny', { volume: ok ? 0.8 : 0.6 });
    this.msg.setText(text).setColor(ok ? GREEN : '#ff7050');
  }

  // ------------------------------------------------------------ daily drop

  private drawDrop(add: Add): void {
    const p = profile.get();
    const s = loginStatus(p, Date.now());
    this.heading(add, 'DAILY SUPPLY DROP', 'A crate from Command every day you report in. Miss one day and the streak waits for you; miss two and it starts over.');
    // Days already claimed in this run of the calendar.
    const claimedUpTo = s.ready ? (s.reset ? 0 : s.day - 1) : s.day;
    LOGIN_REWARDS.forEach((r, i) => {
      const day = i + 1;
      const x = X0 + i * 122;
      const y = 200;
      const claimed = day <= claimedUpTo;
      const today = s.ready && day === s.day;
      add(this.add.rectangle(x, y, 112, 170, today ? 0x3a3620 : 0x1e1f1c).setOrigin(0).setStrokeStyle(today ? 3 : 1, today ? 0xe8c060 : 0x3a3c38));
      add(this.add.text(x + 56, y + 16, `DAY ${day}`, { fontFamily: STENCIL, fontSize: '20px', color: today ? GOLD : '#c8c4b0' }).setOrigin(0.5, 0));
      add(this.add.image(x + 56, y + 74, 'supply_crate').setScale(day === 7 ? 0.95 : 0.7).setAlpha(claimed ? 0.35 : 1));
      add(this.add.text(x + 56, y + 116, `+${r.supplies}`, { fontFamily: STENCIL, fontSize: '22px', color: '#c8d890' }).setOrigin(0.5, 0));
      if (r.skin) add(this.add.text(x + 56, y + 144, '+ CRIMSON SKIN', { fontFamily: MONO, fontSize: '11px', color: '#e07060' }).setOrigin(0.5, 0));
      if (claimed) add(this.add.text(x + 56, y + 70, '✓', { fontFamily: STENCIL, fontSize: '54px', color: GREEN, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    });
    if (s.ready) {
      if (s.reset) add(this.add.text(X0, 392, 'Two days missed: the calendar starts again at day 1.', { fontFamily: MONO, fontSize: '14px', color: '#e0a070' }));
      add(button(this, X0 + 170, 450, 300, 54, `CLAIM DAY ${s.day}`, () => {
        let claim: ReturnType<typeof claimLogin> = null;
        profile.update((d) => { claim = claimLogin(d, Date.now()); });
        const c = claim as ReturnType<typeof claimLogin>;
        if (c) this.say(`DAY ${c.day}: +${c.supplies} SUPPLIES${c.skin ? ` · CRIMSON SKIN FOR THE ${c.skin.weapon.toUpperCase()}` : ''}`);
        this.draw();
      }, 10, 0x5fae3c));
    } else {
      const t = add(this.add.text(X0, 420, '', { fontFamily: STENCIL, fontSize: '22px', color: '#c8c4b0' }));
      this.liveText(t, () => `CLAIMED TODAY · NEXT DROP IN ${hm(msToNextDay(Date.now()))}`);
    }
  }

  // ------------------------------------------------------------ contracts

  private drawContracts(add: Add): void {
    const p = profile.get();
    const d = p.meta.daily;
    this.heading(add, 'DAILY CONTRACTS', "Major Hale's orders for today. Every mission, Fog Surge and Last Stand counts. New orders at midnight; you may swap one unfinished order a day.");
    d.contracts.forEach((c, i) => {
      const y = 200 + i * 112;
      add(this.add.rectangle(X0, y, 860, 100, c.done ? 0x1e2a1c : 0x1e1f1c).setOrigin(0).setStrokeStyle(1, c.done ? 0x4a7a3a : 0x3a3c38));
      add(this.add.text(X0 + 18, y + 14, contractText(c).toUpperCase(), { fontFamily: STENCIL, fontSize: '22px', color: c.done ? GREEN : '#e0dcc0' }));
      add(this.add.rectangle(X0 + 18, y + 58, 420, 18, 0x0c0d0c).setOrigin(0).setStrokeStyle(1, 0x4a4c48));
      add(this.add.rectangle(X0 + 20, y + 60, 416 * (c.progress / c.target), 14, c.done ? 0x6aae4a : 0xc8a040).setOrigin(0));
      add(this.add.text(X0 + 452, y + 58, `${c.progress} / ${c.target}`, { fontFamily: MONO, fontSize: '15px', color: '#c8c4b0' }));
      add(this.add.text(X0 + 600, y + 22, c.done ? `PAID +${c.reward}` : `+${c.reward} SUPPLIES`, { fontFamily: STENCIL, fontSize: '20px', color: c.done ? GREEN : '#c8d890' }));
      if (!c.done && d.rerolled && portal.rewardReady) {
        add(button(this, X0 + 790, y + 66, 110, 34, 'SWAP ▶ AD', () => {
          portal.rewarded(() => {
            profile.update((pd) => { rerollContract(pd, i, Date.now(), true); });
            this.say('NEW ORDER RECEIVED');
          }, () => this.draw());
        }, 10, 0x4a8ac8));
      }
      if (!c.done && !d.rerolled) {
        add(button(this, X0 + 790, y + 66, 110, 34, 'SWAP', () => {
          let ok = false;
          profile.update((pd) => { ok = rerollContract(pd, i, Date.now()); });
          if (ok) this.say('NEW ORDER RECEIVED');
          this.draw();
        }, 10, 0x6a7a8a));
      }
    });
    const all = d.contracts.length > 0 && d.contracts.every((c) => c.done);
    add(this.add.text(X0, 548, d.bonusPaid ? `ALL THREE DONE · BONUS PAID +${CONTRACT_SET_BONUS}` : `FINISH ALL THREE FOR A BONUS +${CONTRACT_SET_BONUS} SUPPLIES`, {
      fontFamily: STENCIL, fontSize: '22px', color: all ? GREEN : GOLD,
    }));
    if (d.rerolled) add(this.add.text(X0, 582, 'Swap used today.', { fontFamily: MONO, fontSize: '13px', color: DIM }));
  }

  // ------------------------------------------------------------ depot

  private drawDepot(add: Add): void {
    const p = profile.get();
    const lv = depotLevel(p);
    this.heading(add, 'SUPPLY DEPOT', "Dot's scavengers bring in Supplies while you are away. The depot fills over time and stops when it is full, so check in before it does.");
    add(this.add.text(X0, 200, `LEVEL ${p.meta.depot.level} / ${DEPOT_LEVELS.length}  ·  ${lv.rate} SUPPLIES AN HOUR  ·  HOLDS ${depotCap(p)} (${lv.capHours} HOURS)`, {
      fontFamily: MONO, fontSize: '15px', color: '#c8d890',
    }));
    add(this.add.rectangle(X0, 240, 604, 40, 0x0c0d0c).setOrigin(0).setStrokeStyle(2, 0x4a4c48));
    this.depotFill = add(this.add.rectangle(X0 + 2, 242, 600 * (depotStored(p, Date.now()) / depotCap(p)), 36, 0x8a9a50).setOrigin(0));
    const stored = add(this.add.text(X0 + 302, 260, '', { fontFamily: STENCIL, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
    this.liveText(stored, () => `${depotStored(profile.get(), Date.now())} / ${depotCap(profile.get())}`);
    const eta = add(this.add.text(X0, 292, '', { fontFamily: MONO, fontSize: '14px', color: '#a8a890' }));
    this.liveText(eta, () => {
      const q = profile.get();
      const left = depotCap(q) - depotStored(q, Date.now());
      return left <= 0 ? 'FULL: collect it, or production stops.' : `Full in about ${hm((left / depotLevel(q).rate) * 3_600_000)}`;
    });
    add(button(this, X0 + 150, 360, 300, 52, 'COLLECT', () => {
      let got = 0;
      profile.update((d) => { got = collectDepot(d, Date.now()); });
      if (got > 0) this.say(`+${got} SUPPLIES COLLECTED`);
      else this.say('NOTHING TO COLLECT YET', false);
      this.draw();
    }, 10, 0x5fae3c));

    const { cost, status } = depotUpgradeStatus(p);
    add(this.add.rectangle(X0, 430, 860, 120, 0x1e1f1c).setOrigin(0).setStrokeStyle(1, 0x3a3c38));
    add(this.add.text(X0 + 16, 444, 'EXPAND THE DEPOT', { fontFamily: STENCIL, fontSize: '22px', color: '#e0dcc0' }));
    if (status === 'maxed' || cost === null) {
      add(this.add.text(X0 + 16, 482, 'Fully expanded.', { fontFamily: MONO, fontSize: '14px', color: GREEN }));
      return;
    }
    const next = DEPOT_LEVELS[p.meta.depot.level];
    add(this.add.text(X0 + 16, 482, `Next level: ${next.rate} an hour, holds ${next.rate * next.capHours} (${next.capHours} hours).`, { fontFamily: MONO, fontSize: '14px', color: '#9a9a86' }));
    const b = add(button(this, X0 + 720, 490, 220, 44, `EXPAND  ${cost}`, () => {
      let r = '';
      profile.update((d) => { r = buyDepotUpgrade(d, Date.now()); });
      if (r === 'ok') this.say(`DEPOT LEVEL ${profile.get().meta.depot.level}`);
      else this.say('NOT ENOUGH SUPPLIES', false);
      this.draw();
    }, 10, status === 'ok' ? 0x5fae3c : 0x6a4a40));
    if (status !== 'ok') b.setAlpha(0.6);
  }

  // ------------------------------------------------------------ fog surge

  private drawSurge(add: Add): void {
    const p = profile.get();
    if (!surgeOpen(p)) {
      const m = missionById(SURGE_UNLOCK)!;
      this.heading(add, 'FOG SURGE', `Once a day the fog pushes hard somewhere on the line: one battle with two twists and a big reward.\n\nOpens when you win Act ${m.act} Mission ${m.number}, ${m.name}.`);
      return;
    }
    const m = surgeMission(p, this.day);
    const mods = surgeModifiers(this.day);
    const s = p.meta.surge;
    this.heading(add, `FOG SURGE — ${m.name.toUpperCase()}`, `${m.place}. Hold the line for ${m.waves.length} waves. The same surge all day, a new one at midnight.`);
    mods.forEach((id, i) => {
      const y = 196 + i * 62;
      add(this.add.rectangle(X0, y, 520, 52, 0x2a1e1c).setOrigin(0).setStrokeStyle(1, 0x7a4030));
      add(this.add.text(X0 + 16, y + 8, SURGE_MODIFIERS[id].name, { fontFamily: STENCIL, fontSize: '20px', color: '#f0a070' }));
      add(this.add.text(X0 + 16, y + 32, SURGE_MODIFIERS[id].text, { fontFamily: MONO, fontSize: '13px', color: '#c8b8a0' }));
    });
    const power = playerPower(p);
    const rating = threatRating(power, m.threat);
    add(this.add.text(X0 + 560, 200, `THREAT ${m.threat}`, { fontFamily: STENCIL, fontSize: '24px', color: '#e0dcc0' }));
    add(this.add.text(X0 + 560, 232, `YOUR POWER ${power}`, { fontFamily: MONO, fontSize: '15px', color: rating === 'ready' ? GREEN : rating === 'risky' ? GOLD : '#ff7050' }));
    add(this.add.text(X0, 340, s.won ? `WON TODAY ✓  ·  replays pay +${SURGE_REPLAY}` : `FIRST WIN TODAY: +${SURGE_FIRST_WIN} SUPPLIES`, {
      fontFamily: STENCIL, fontSize: '24px', color: s.won ? GREEN : '#c8d890',
    }));
    add(this.add.text(X0, 378, `TODAY'S BEST SCORE ${s.best.toLocaleString('en-US')}`, { fontFamily: MONO, fontSize: '15px', color: GOLD }));
    this.deployButtons(add, SURGE_ID, 450);
  }

  // ------------------------------------------------------------ last stand

  private drawEndless(add: Add): void {
    const p = profile.get();
    if (!endlessOpen(p)) {
      this.heading(add, 'LAST STAND', `The farm bunker, wave after wave, until it falls.\n\nOpens when you finish Act 1 (${missionById(ENDLESS_UNLOCK)!.name}).`);
      return;
    }
    const e = p.meta.endless;
    this.heading(add, 'LAST STAND', `The Harlow farm bunker, wave after wave, until it falls. Every wave adds more and tougher dead, with every kind you have met. Each wave survived pays ${ENDLESS_PER_WAVE} Supplies.`);
    add(this.add.text(X0, 210, `BEST WAVE ${e.best}`, { fontFamily: STENCIL, fontSize: '40px', color: GOLD, stroke: '#000', strokeThickness: 4 }));
    add(this.add.text(X0, 270, 'MILESTONES (paid once)', { fontFamily: MONO, fontSize: '14px', color: '#9a9a86' }));
    ENDLESS_MILESTONES.forEach((ms, i) => {
      const x = X0 + (i % 3) * 250;
      const y = 296 + Math.floor(i / 3) * 56;
      const got = e.milestones.includes(ms.wave);
      add(this.add.rectangle(x, y, 236, 46, got ? 0x1e2a1c : 0x1e1f1c).setOrigin(0).setStrokeStyle(1, got ? 0x4a7a3a : 0x3a3c38));
      add(this.add.text(x + 14, y + 12, `${got ? '✓ ' : ''}WAVE ${ms.wave}`, { fontFamily: STENCIL, fontSize: '20px', color: got ? GREEN : '#e0dcc0' }));
      add(this.add.text(x + 222, y + 14, `+${ms.supplies}`, { fontFamily: STENCIL, fontSize: '18px', color: '#c8d890' }).setOrigin(1, 0));
    });
    this.deployButtons(add, ENDLESS_ID, 470);
  }

  private deployButtons(add: Add, missionId: string, y: number): void {
    const loadout = needsLoadout(profile.get());
    add(button(this, X0 + 160, y, 300, 54, 'DEPLOY', () => {
      audio.play('radio', { volume: 0.6 });
      if (loadout) this.scene.start('Loadout', { missionId, deploy: true });
      else this.scene.start('Game', { missionId });
    }, 10, 0xc84030));
    if (loadout) add(button(this, X0 + 480, y, 240, 44, 'LOADOUT', () => this.scene.start('Loadout', { missionId, deploy: false }), 10, 0x6a7a8a));
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

    add(this.add.text(X0, 90, "FIELD NOTES — DR. VARGA'S CASEBOOK", { fontFamily: STENCIL, fontSize: '26px', color: '#e8e0c0' }));
    add(this.add.text(X0, 122, `Kills fill each page: ${CODEX_TIERS.map((t) => `${t.kills} kills (+${t.supplies})`).join(' · ')}.`, { fontFamily: MONO, fontSize: '13px', color: '#9a9a86' }));
    order.forEach((id, i) => {
      const x = X0 + (i % 3) * 288;
      const y = 150 + Math.floor(i / 3) * 56;
      const known = met.has(id);
      const sel = id === this.noteEnemy;
      const kills = p.meta.codex[id] ?? 0;
      const pages = codexPages(p, id);
      const bg = add(this.add.rectangle(x, y, 278, 48, sel ? 0x34362c : 0x1e1f1c).setOrigin(0).setStrokeStyle(sel ? 2 : 1, sel ? 0xc8a040 : 0x3a3c38));
      if (known) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          audio.play('ui_click', { volume: 0.6 });
          this.noteEnemy = id;
          this.draw();
        });
      }
      add(this.add.text(x + 12, y + 6, known ? ENEMIES[id].name.toUpperCase() : '???', { fontFamily: STENCIL, fontSize: '18px', color: known ? '#e0dcc0' : DIM }));
      add(this.add.text(x + 12, y + 28, known ? `${kills} KILLS` : 'NOT YET MET', { fontFamily: MONO, fontSize: '12px', color: '#a8a890' }));
      for (let k = 0; k < CODEX_TIERS.length; k++) {
        add(this.add.rectangle(x + 214 + k * 20, y + 16, 14, 18, k < pages ? 0xc8a040 : 0x2c2d2a).setOrigin(0).setStrokeStyle(1, 0x000000));
      }
    });

    // The open page.
    const id = this.noteEnemy;
    const e = ENEMIES[id];
    const pages = codexPages(p, id);
    const notes = [e.intel ?? e.description, FIELD_NOTES[id]?.tactic ?? '', FIELD_NOTES[id]?.lore ?? ''];
    const y0 = 150 + Math.ceil(order.length / 3) * 56 + 10;
    add(this.add.rectangle(X0, y0, 860, VIEW.height - 76 - y0, 0x1a1b18).setOrigin(0).setStrokeStyle(1, 0x5a5040));
    add(this.add.text(X0 + 16, y0 + 10, e.name.toUpperCase(), { fontFamily: STENCIL, fontSize: '20px', color: GOLD }));
    const body = notes.map((t, k) => (k < pages ? `${k + 1}. ${t}` : `${k + 1}. [ ${CODEX_TIERS[k].kills} kills to read ]`)).join('\n');
    add(this.add.text(X0 + 16, y0 + 38, body, { fontFamily: MONO, fontSize: '13px', color: '#d0ccb4', wordWrap: { width: 828 }, lineSpacing: 3 }));
  }
}

/** Shown on the map once a day: today's drop, claimed in one click. */
export function showDailyDrop(scene: Phaser.Scene, onDone: () => void): Phaser.GameObjects.Container | null {
  const p = profile.get();
  const now = Date.now();
  if (!hqOpen(p)) return null;
  const s = loginStatus(p, now);
  if (!s.ready) return null;
  const W = 560, H = 300;
  const cx = VIEW.centerX, cy = VIEW.height / 2;
  const parts: Phaser.GameObjects.GameObject[] = [];
  parts.push(scene.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.7).setOrigin(0).setInteractive());
  parts.push(scene.add.rectangle(cx, cy, W, H, 0x1c1d1a, 0.98).setStrokeStyle(2, 0xe8c060));
  parts.push(scene.add.text(cx, cy - H / 2 + 34, 'DAILY SUPPLY DROP', { fontFamily: STENCIL, fontSize: '32px', color: '#e8e0c0', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
  parts.push(scene.add.text(cx, cy - H / 2 + 70, s.reset ? 'Two days missed: the calendar starts again.' : `Day ${s.day} of 7`, { fontFamily: MONO, fontSize: '14px', color: '#b8b4a0' }).setOrigin(0.5));
  const crate = scene.add.image(cx, cy - 6, 'supply_crate').setScale(0.9);
  parts.push(crate);
  scene.tweens.add({ targets: crate, y: cy - 14, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.InOut' });
  parts.push(scene.add.text(cx, cy + 50, `+${s.reward.supplies} SUPPLIES${s.reward.skin ? '  +  CRIMSON SKIN' : ''}`, { fontFamily: STENCIL, fontSize: '24px', color: '#c8d890', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5));
  const box = scene.add.container(0, 0, parts).setDepth(60);
  const claim = (): void => {
    profile.update((d) => { claimLogin(d, Date.now()); });
    audio.play('buy', { volume: 0.8 });
    box.destroy();
    onDone();
  };
  box.add(button(scene, cx, cy + H / 2 - 40, 260, 48, 'CLAIM  [ENTER]', claim, 61, 0x5fae3c));
  scene.input.keyboard!.once('keydown-ENTER', () => { if (box.active) claim(); });
  return box;
}
