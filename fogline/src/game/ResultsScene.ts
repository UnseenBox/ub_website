import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { GearId, MISSIONS, MissionDef, missionById } from '../data/missions';
import { SKINS } from '../data/retention';
import { ModeOutcome, RunRewards } from '../systems/Retention';
import { MODS, SUPPORT, DEFENSES } from '../data/upgrades';
import { weaponById } from '../data/weapons';
import {
  BUNKER_STAR_FRACTION, MissionOutcome, MissionResult, campaignComplete, isActFinale, nextMission, playerPower, veteranMedals, workshopOpen,
} from '../systems/Campaign';
import { recruitById } from '../data/squad';
import { profile } from '../systems/Profile';
import { portal } from '../portal/Portal';
import { RETRY_CASH_BONUS } from '../portal/adRules';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';
import { bonusValue } from '../ui/messages';
import { ITEM_ICON, WEAPON_ICON, icon, iconWidth, type IconName } from '../ui/icons';
import { C, STENCIL, centreRow, chip, meter, pushButton, text, type Button, type Part } from '../ui/kit';
import { isTouchDevice } from './touchControls';

export interface ResultsData {
  missionId: string;
  /** The mission as played (Fog Surge and Last Stand are generated, not looked up). */
  mission?: MissionDef;
  result: MissionResult;
  outcome: MissionOutcome | ModeOutcome;
  /** Contracts, Field Notes pages and skins this battle earned. */
  rewards?: RunRewards;
  /** Supplies for retaking a contested node today. */
  contested?: number;
  /** False in test mode and training: the result is shown but not kept. */
  saved: boolean;
  /** Why a lost mission was lost (bunker, asset, evacuation). */
  failReason?: string;
}

/** One thing a battle earned. */
interface Reward {
  icon: IconName;
  value: string;
  label: string;
  /** The headline reward gets a brass border. */
  first?: boolean;
}

export function gearName(g: GearId | string): string {
  const [kind, id] = g.split(':');
  if (kind === 'mod') return MODS.find((m) => m.id === id)?.name ?? id;
  if (kind === 'support') return SUPPORT.find((s) => s.id === id)?.name ?? id;
  return DEFENSES.find((d) => d.id === id)?.name ?? id;
}

/** Mission results: stars, what earned them, Supplies, unlocks and what comes next. */
export class ResultsScene extends Phaser.Scene {
  private busy = false;
  private saved = false;
  private suppliesValue: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    this.busy = false;
    this.saved = data.saved;
    this.suppliesValue = null;
    const mission = data.mission ?? missionById(data.missionId)!;
    const training = mission.id === 'training';
    const mode = mission.mode;
    const { result, outcome } = data;
    const win = result.victory;
    this.input.setDefaultCursor('default');

    const title = mode === 'endless' ? 'THE LINE FELL'
      : win ? (training ? 'THE LINE HELD' : mode === 'surge' ? 'SURGE BROKEN' : 'MISSION COMPLETE')
      : data.failReason ?? 'BUNKER OVERRUN';
    backdrop(this, win || mode === 'endless' ? C.night : 0x1a100e).setInteractive();
    const heading = text(this, VIEW.centerX, 66, title, {
      size: 64, font: STENCIL, color: win || mode === 'endless' ? C.title : C.red,
    }).setOrigin(0.5);
    if (heading.width > VIEW.width - 80) heading.setScale((VIEW.width - 80) / heading.width);
    if (mission.veteran) centreRow([chip(this, { icon: 'medal', text: 'VETERAN', tone: 'gold', size: 18 })], VIEW.centerX, 116);

    if (mode) this.drawScore(mode, outcome as ModeOutcome, result.wavesCleared);
    else if (!training) this.drawStars(mission.bonus, data);

    // Battle stats: an icon and a number each. Waves only matter when they were not all cleared.
    const tiles: [IconName, string][] = [];
    if (!win && mode !== 'endless') tiles.push(['wave', `${result.wavesCleared}/${result.totalWaves}`]);
    tiles.push(['skull', `${result.kills}`], ['head', `${result.headshots}`], ['gauge', `${Math.round(result.accuracy * 100)}%`]);
    if (result.vehicles !== undefined) tiles.push(['truck', `${result.saved}/${result.vehicles}`]);
    if (result.assetFraction !== undefined) tiles.push(['mast', `${Math.round(result.assetFraction * 100)}%`]);
    this.drawTiles(tiles, training ? 220 : 268);

    const p = profile.get();
    if (!training) this.drawRewards(this.rewards(data, mission), 398);

    // A defeat shows the power the player had against the threat of the mission.
    if (!win && !mode && !training) this.drawGauge(playerPower(p), mission.threat, 548);
    if (!data.saved && !training) centreRow([chip(this, { icon: 'cross', text: 'NOT SAVED', tone: 'muted', size: 16 })], VIEW.centerX, 600);

    this.drawActions(data, mission);

    // CrazyGames: the portal's celebration for a boss kill, a finished act, a first three-star result.
    if (data.saved && win && !training) {
      const proud = mission.objective.kind === 'boss' || (outcome.stars === 3 && outcome.previousStars < 3) || (mode === 'surge' && outcome.firstClear);
      if (proud) portal.happytime();
    }
  }

  /** The buttons: the way on at the bottom right, the others at the bottom left. */
  private drawActions(data: ResultsData, mission: MissionDef): void {
    const training = mission.id === 'training';
    const mode = mission.mode;
    const { result, outcome } = data;
    const win = result.victory;
    const p = profile.get();
    // The Heart (Act 3) and the Bloom (Act 4) each end with an epilogue.
    const finale = win && outcome.firstClear && data.saved && !mode && !training && isActFinale(mission) && mission.act >= 3;
    const debrief = win && !mode && !training ? mission.debrief : [];
    const toMap = (): void => this.leave(() => (finale
      ? this.scene.start('Ending', { act: mission.act })
      : this.scene.start('Map', { reveal: win && outcome.firstClear && data.saved ? mission.id : undefined, debrief })));
    const retry = (): void => this.leave(() => this.scene.start('Game', training ? { tutorial: false, missionId: 'training' } : { missionId: mission.id, veteran: mission.veteran }));
    const menu = (): void => this.leave(() => this.scene.start('Menu'));
    const y = VIEW.height - 52;
    const left: Button[] = [];
    const small = (o: Omit<Parameters<typeof pushButton>[3], 'h'>): void => {
      left.push(pushButton(this, 0, y, { h: 48, size: 20, ...o }));
    };
    let primary: () => void;
    let way: Parameters<typeof pushButton>[3];
    if (mode) {
      primary = () => this.leave(() => this.scene.start('HQ', { tab: mode === 'surge' ? 'surge' : 'endless' }));
      way = { icon: 'play', label: 'HQ', onClick: primary, tone: 'go' };
      small({ icon: 'replay', label: 'AGAIN', onClick: () => this.leave(() => this.scene.start('Game', { missionId: mission.id })) });
    } else if (training) {
      primary = retry;
      way = { icon: 'replay', label: 'TRAIN AGAIN', onClick: retry, tone: 'go' };
    } else if (win) {
      primary = toMap;
      const next = data.saved && !campaignComplete(p) ? nextMission(p) : null;
      const prize = next ? next.firstClear.weapons[0] ?? null : null;
      const gear = next && !prize ? next.firstClear.gear[0] ?? null : null;
      const trail = prize ? WEAPON_ICON[prize] : gear ? ITEM_ICON[gear.split(':')[1]] : undefined;
      way = { icon: 'play', label: trail ? 'NEXT:' : 'CONTINUE', trail, onClick: toMap, tone: 'go' };
      small({ icon: 'replay', label: 'AGAIN', onClick: retry });
    } else {
      primary = retry;
      way = { icon: 'replay', label: 'RETRY', onClick: retry, tone: 'go' };
      small(workshopOpen(p)
        ? { icon: 'wrench', label: 'WORKSHOP', onClick: () => this.leave(() => this.scene.start('Workshop')), tone: 'brass' }
        : { icon: 'map', label: 'MAP', onClick: toMap });
    }
    small({ icon: 'home', label: 'MENU', onClick: menu });
    let x = 26;
    for (const b of left) {
      b.c.x = x + b.w / 2;
      x += b.w + 12;
    }
    const keyed = { ...way, h: 62, size: 28, key: isTouchDevice() ? undefined : 'ENTER' };
    const go = pushButton(this, 0, y - 6, keyed);
    go.c.x = VIEW.width - 26 - go.w / 2;
    this.input.keyboard!.on('keydown-ENTER', () => primary());
    // Optional rewarded ads (only in a CrazyGames build with ads on).
    if (data.saved && !training) this.rewardOffers(data, mission.id, win, VIEW.centerX + 60, y);
  }

  /** Double the Supplies after any finish, or retry a loss with extra cash: the player's choice, never forced. */
  private rewardOffers(data: ResultsData, missionId: string, win: boolean, x: number, y: number): void {
    if (!portal.rewardReady) return;
    const supplies = data.outcome.supplies;
    let cx = x;
    if (supplies > 0) {
      const b = pushButton(this, cx, y, {
        h: 48, size: 18, icon: 'crate', label: `×2  +${supplies}  ▶ AD`, tone: 'brass',
        onClick: () => {
          b.c.disableInteractive().setAlpha(0.5);
          const ok = portal.rewarded(() => {
            profile.update((d) => {
              d.supplies += supplies;
              d.suppliesEarned += supplies;
            });
            audio.play('buy', { volume: 0.8 });
            this.suppliesValue?.setText(`+${Number(this.suppliesValue.text.slice(1)) + supplies}`);
          }, () => b.c.destroy());
          if (!ok) b.c.destroy();
        },
      });
      cx += b.w + 12;
    }
    if (!win) {
      const r = pushButton(this, cx + 20, y, {
        h: 48, size: 18, icon: 'cash', label: `+${Math.round(RETRY_CASH_BONUS * 100)}%  ▶ AD`, tone: 'brass',
        onClick: () => {
          r.c.disableInteractive().setAlpha(0.5);
          let granted = false;
          const ok = portal.rewarded(() => { granted = true; }, () => {
            if (granted) this.leave(() => this.scene.start('Game', { missionId, bonusCash: RETRY_CASH_BONUS }), false);
            else r.c.destroy();
          });
          if (!ok) r.c.destroy();
        },
      });
    }
  }

  /** Three big stars; under each, the reason as an icon and a short value. */
  private drawStars(goal: Parameters<typeof bonusValue>[0], data: ResultsData): void {
    const { outcome, result } = data;
    const xs = [-122, 0, 122].map((d) => VIEW.centerX + d);
    xs.forEach((x, i) => {
      const lit = i < outcome.stars;
      const star = icon(this, 'star', x, 168, 82, lit ? 0x000000 : C.lineStrong, { fill: lit ? C.star : C.track, stroke: 1.3 });
      if (lit) {
        const full = star.scale;
        star.setScale(0);
        this.tweens.add({ targets: star, scale: full, duration: 260, delay: 350 + i * 260, ease: 'Back.Out', onStart: () => audio.play('ui_click', { volume: 0.8, rate: 1 + i * 0.12 }) });
      }
    });
    const reasons: [boolean, IconName, string][] = [
      [result.victory, 'check', ''],
      [outcome.bunkerStar, 'shield', `${Math.round(BUNKER_STAR_FRACTION * 100)}%`],
      [outcome.bonusMet, 'head', bonusValue(goal)],
    ];
    if (goal.kind !== 'headshots') {
      reasons[2][1] = goal.kind === 'accuracy' ? 'gauge' : goal.kind === 'saveAll' ? 'truck' : goal.kind === 'assetHealth' ? 'mast' : ITEM_ICON[goal.id];
    }
    reasons.forEach(([ok, name, value], i) => {
      const color = ok ? 0xd8d0b4 : C.lineStrong;
      const t = value ? text(this, 0, 232, value, { size: 20, color, bold: true }).setOrigin(0, 0.5) : null;
      const size = 28;
      const w = iconWidth(name, size) + (t ? 8 + t.width : 0);
      icon(this, name, xs[i] - w / 2 + iconWidth(name, size) / 2, 232, size, color);
      t?.setX(xs[i] - w / 2 + iconWidth(name, size) + 8);
    });
  }

  /** Fog Surge and Last Stand: the score and today's or all-time best instead of stars. */
  private drawScore(mode: 'surge' | 'endless', o: ModeOutcome, wave: number): void {
    const big = mode === 'surge' ? o.score.toLocaleString('en-US') : `WAVE ${wave}`;
    text(this, VIEW.centerX, 160, big, { size: 70, color: C.star, font: STENCIL }).setOrigin(0.5);
    const best = mode === 'surge' ? o.best.toLocaleString('en-US') : `${o.best}`;
    centreRow([chip(this, {
      icon: 'star', text: o.newBest && o.score > 0 ? `NEW BEST ${best}` : `BEST ${best}`, tone: o.newBest ? 'green' : 'plain', size: 20,
    })], VIEW.centerX, 226);
    if (o.newBest && o.score > 0) audio.play('wave_clear', { volume: 0.6, rate: 1.2 });
  }

  private drawTiles(tiles: [IconName, string][], top: number): void {
    const gap = 13, h = 106;
    const parts: Part[] = tiles.map(([name, value]) => {
      const t = text(this, 0, 75, value, { size: 36, font: STENCIL }).setOrigin(0.5);
      const w = Math.max(128, Math.ceil(t.width + 40));
      t.x = w / 2;
      const bg = this.add.rectangle(0, 0, w, h, C.tile).setOrigin(0).setStrokeStyle(1, C.lineSoft);
      return { c: this.add.container(0, 0, [bg, icon(this, name, w / 2, 31, 34, C.soft), t]), w, h };
    });
    centreRow(parts, VIEW.centerX, top + h / 2, gap);
  }

  /** What was earned, one card each: the item's icon, a number or name, a small word. */
  private drawRewards(rewards: Reward[], top: number): void {
    const gap = 13, h = 126;
    const parts: Part[] = rewards.map((r, i) => {
      const value = text(this, 0, 76, r.value, { size: 28, font: STENCIL }).setOrigin(0.5);
      const label = text(this, 0, 106, r.label, { size: 14, color: C.soft, bold: true, spacing: 1 }).setOrigin(0.5);
      const w = Math.max(138, Math.ceil(Math.max(value.width, label.width) + 32));
      value.x = label.x = w / 2;
      if (r.first) this.suppliesValue = value;
      const bg = this.add.rectangle(0, 0, w, h, C.raised).setOrigin(0).setStrokeStyle(2, r.first ? C.brass : C.lineReward);
      const c = this.add.container(0, 0, [bg, icon(this, r.icon, w / 2, 35, 44, C.brass), value, label]).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 220, delay: 900 + i * 120 });
      return { c, w, h };
    });
    // A very good battle can earn many things: the row shrinks to stay on screen.
    const width = parts.reduce((s, q) => s + q.w, 0) + gap * Math.max(0, parts.length - 1);
    const scale = Math.min(1, (VIEW.width - 60) / Math.max(1, width));
    let x = VIEW.centerX - (width * scale) / 2;
    for (const q of parts) {
      q.c.setPosition(x, top).setScale(scale);
      x += (q.w + gap) * scale;
    }
  }

  private rewards(data: ResultsData, mission: MissionDef): Reward[] {
    const p = profile.get();
    const rw = data.rewards;
    const mode = mission.mode;
    const outcome = data.outcome;
    // Last Stand milestones get cards of their own, so the first card shows the rest.
    const milestones = mode ? (outcome as ModeOutcome).milestones : [];
    const base = outcome.supplies - milestones.reduce((n, ms) => n + ms.supplies, 0);
    const out: Reward[] = [{
      icon: 'crate',
      value: `+${base}`,
      label: outcome.firstClear ? (mode === 'surge' ? 'FIRST TODAY' : mode ? 'SUPPLIES' : 'FIRST CLEAR') : 'SUPPLIES',
      first: true,
    }];
    if (data.contested) out.push({ icon: 'flame', value: `+${data.contested}`, label: 'RETAKEN' });
    if (mode) {
      for (const ms of milestones) out.push({ icon: 'wave', value: `+${ms.supplies}`, label: `WAVE ${ms.wave}` });
    } else {
      const o = outcome as MissionOutcome;
      if (o.veteranMedal) out.push({ icon: 'medal', value: `${veteranMedals(p)}/${MISSIONS.length}`, label: 'VETERAN' });
      for (const w of o.unlockedWeapons) out.push({ icon: WEAPON_ICON[w], value: weaponById(w).shortName, label: 'UNLOCKED' });
      for (const g of o.unlockedGear) {
        const id = g.split(':')[1];
        const short = MODS.find((m) => m.id === id)?.short ?? gearName(g).split(' ').pop()!.toUpperCase();
        out.push({ icon: ITEM_ICON[id], value: short, label: 'UNLOCKED' });
      }
      for (const r of o.unlockedRecruits ?? []) out.push({ icon: 'people', value: recruitById(r)!.name.split(' ')[0].toUpperCase(), label: 'JOINS' });
    }
    for (const c of rw?.contracts ?? []) out.push({ icon: 'check', value: `+${c.reward}`, label: 'CONTRACT' });
    if (rw?.setBonus) out.push({ icon: 'check', value: `+${rw.setBonus}`, label: 'ALL THREE' });
    if (rw?.codex.length) out.push({ icon: 'book', value: `+${rw.codex.reduce((n, c) => n + c.supplies, 0)}`, label: 'FIELD NOTES' });
    for (const skin of rw?.skins ?? []) out.push({ icon: WEAPON_ICON[skin.weapon], value: SKINS[skin.skin].name.toUpperCase(), label: 'NEW SKIN' });
    return out;
  }

  /** Power against threat: the bar is the player's power, the red mark the mission's threat. */
  private drawGauge(power: number, threat: number, y: number): void {
    const w = 440, x = VIEW.centerX - w / 2;
    const max = Math.max(power, threat) * 1.25;
    const g = this.add.graphics();
    meter(g, x, y, w, 18, power / max, 0xe0b040);
    g.fillStyle(0xff7a5a, 1).fillRect(x + w * (threat / max) - 2, y - 8, 5, 34);
    text(this, x, y + 24, `POWER ${power}`, { size: 17, color: 0xc8c2a6, bold: true });
    text(this, x + w, y + 24, `${threat}`, { size: 17, color: 0xff7a5a, bold: true }).setOrigin(1, 0);
  }

  /** Leaves the results; a CrazyGames midgame break may run first (never in the first missions, three minutes apart). */
  private leave(then: () => void, allowBreak = true): void {
    if (this.busy) return;
    this.busy = true;
    this.scene.stop('Game');
    const wins = Object.values(profile.get().missions).filter((r) => r.wins > 0).length;
    if (allowBreak && this.saved && portal.midgame(wins, then)) return;
    then();
  }
}
